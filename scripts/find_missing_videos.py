#!/usr/bin/env python3

import csv
import os
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Iterable
from urllib.request import urlopen


SHEET_ID = "1hyGuwwz_x6gkvt587yox4EPsK00Mtk_cvtNoX6hU6bQ"
GID = "1633760181"
ROOT = Path("/Users/mac/Desktop/video_cut/Telegram Uploads")
SEARCH_WIDER_ROOT = Path("/Users/mac/Desktop/video_cut")


def norm(s: str) -> str:
    s = str(s or "").strip()
    s = re.sub(r"\s+", " ", s)
    return s.casefold()


def strip_copy_suffix(base: str) -> str:
    # Telegram/macOS duplicates: "name (1).mp4"
    return re.sub(r"\s*\(\d+\)$", "", base)

SUFFIX_CANON_RE = re.compile(
    r"(?i)(?:"
    r"(?:_done)$|"
    r"(?:_crop(?:_digital|_analog)?)$|"
    r"(?:_thermal(?:_digital|_analog)?)$"
    r")"
)


def canonical_base(name_or_base: str) -> str:
    base, _ = os.path.splitext(name_or_base)
    base = base.strip()
    while True:
        next_base = SUFFIX_CANON_RE.sub("", base).strip()
        if next_base == base:
            break
        base = next_base
    # strip "(1)" after removing suffixes like "_done"
    base = strip_copy_suffix(base).strip()
    return base


def sheet_csv_url(sheet_id: str, gid: str) -> str:
    return f"https://docs.google.com/spreadsheets/d/{sheet_id}/export?format=csv&gid={gid}"


@dataclass(frozen=True)
class SheetRow:
    link: str
    tg_file_name: str
    status: str
    camera_type: str
    analog_digital: str
    drive_filename: str
    drive_link: str


def fetch_sheet_rows() -> List[SheetRow]:
    url = sheet_csv_url(SHEET_ID, GID)
    data = urlopen(url, timeout=30).read().decode("utf-8", errors="replace")
    rows = list(csv.reader(data.splitlines()))
    if not rows:
        raise RuntimeError("sheet_empty")
    headers = [h.strip().lower() for h in rows[0]]

    def idx(name: str) -> int:
        try:
            return headers.index(name)
        except ValueError:
            return -1

    i_link = idx("link")
    i_name = idx("tg_file_name")
    i_status = idx("status")
    i_cam = idx("camera_type")
    i_mode = idx("analog_digital")
    i_drive_name = idx("drive_filename (matched)")
    i_drive_link = idx("drive link")
    if i_name == -1:
        raise RuntimeError(f"tg_file_name missing in headers: {headers}")

    out: List[SheetRow] = []
    for r in rows[1:]:
        if i_name >= len(r):
            continue
        name = (r[i_name] or "").strip()
        if not name:
            continue
        out.append(
            SheetRow(
                link=(r[i_link].strip() if 0 <= i_link < len(r) else ""),
                tg_file_name=name,
                status=(r[i_status].strip() if 0 <= i_status < len(r) else ""),
                camera_type=(r[i_cam].strip() if 0 <= i_cam < len(r) else ""),
                analog_digital=(r[i_mode].strip() if 0 <= i_mode < len(r) else ""),
                drive_filename=(r[i_drive_name].strip() if 0 <= i_drive_name < len(r) else ""),
                drive_link=(r[i_drive_link].strip() if 0 <= i_drive_link < len(r) else ""),
            )
        )
    return out


def index_files(
    root: Path,
) -> Tuple[Dict[str, List[str]], Dict[str, List[str]], Dict[str, List[str]]]:
    by_filename: Dict[str, List[str]] = {}
    by_base: Dict[str, List[str]] = {}
    by_canon: Dict[str, List[str]] = {}
    for dirpath, _, filenames in os.walk(root):
        for fn in filenames:
            path = str(Path(dirpath) / fn)
            by_filename.setdefault(norm(fn), []).append(path)
            base, _ = os.path.splitext(fn)
            by_base.setdefault(norm(base), []).append(path)
            by_base.setdefault(norm(strip_copy_suffix(base)), []).append(path)
            by_canon.setdefault(norm(canonical_base(fn)), []).append(path)
    return by_filename, by_base, by_canon


SUFFIX_VARIANTS = [
    "_done",
    "_crop_digital",
    "_crop_analog",
    "_thermal_digital",
    "_thermal_analog",
    "_crop",
    "_thermal",
]


def candidate_names(name: str) -> List[str]:
    base, ext = os.path.splitext(name)
    base2 = strip_copy_suffix(base)
    out = []
    for b in {base, base2, canonical_base(base)}:
        out.append(b + ext)
        for s in SUFFIX_VARIANTS:
            out.append(b + s + ext)
    return list(dict.fromkeys(out))

def classify_paths(paths: Iterable[str]) -> str:
    if not paths:
        return "missing"
    lowered = [p.lower() for p in paths]
    has_done = any("/done/" in p for p in lowered)
    has_cutted = any("/cutted/" in p for p in lowered)
    has_root = any(not ("/done/" in p or "/cutted/" in p) for p in lowered)
    if has_root:
        return "ok"
    if has_done and not has_cutted:
        return "only_done"
    if has_cutted and not has_done:
        return "only_cutted"
    if has_done and has_cutted:
        return "done_and_cutted"
    return "unknown"

def find_paths_for(
    name: str,
    by_filename: Dict[str, List[str]],
    by_base: Dict[str, List[str]],
    by_canon: Dict[str, List[str]],
) -> Optional[List[str]]:
    for c in candidate_names(name):
        k = norm(c)
        if k in by_filename:
            return by_filename[k]
    base, _ = os.path.splitext(name)
    for b in {base, strip_copy_suffix(base)}:
        kb = norm(b)
        if kb in by_base:
            return by_base[kb]
    kc = norm(canonical_base(name))
    if kc in by_canon:
        return by_canon[kc]
    return None


def wider_search(name: str, wider_root: Path, limit: int = 20) -> List[str]:
    # very cheap partial token search (no full scan of contents)
    base, _ = os.path.splitext(name)
    token = strip_copy_suffix(base)
    token = re.sub(r"[\\[\\]{}()]+", " ", token)
    token = re.sub(r"\\s+", " ", token).strip()
    if not token:
        return []
    # try find by filename contains first 30 chars
    needle = token[:30]
    matches = []
    for dirpath, _, filenames in os.walk(wider_root):
        for fn in filenames:
            if needle.casefold() in fn.casefold():
                matches.append(str(Path(dirpath) / fn))
                if len(matches) >= limit:
                    return matches
    return matches


def main() -> int:
    rows = fetch_sheet_rows()
    # unique by tg_file_name (normalized)
    seen = set()
    ordered: List[SheetRow] = []
    for r in rows:
        k = norm(r.tg_file_name)
        if k in seen:
            continue
        seen.add(k)
        ordered.append(r)

    by_filename, by_base, by_canon = index_files(ROOT)

    found: List[Tuple[SheetRow, List[str]]] = []
    missing: List[SheetRow] = []
    for r in ordered:
        paths = find_paths_for(r.tg_file_name, by_filename, by_base, by_canon)
        if paths:
            found.append((r, paths))
        else:
            missing.append(r)

    out_dir = Path(__file__).resolve().parent.parent / "tmp"
    out_dir.mkdir(parents=True, exist_ok=True)

    missing_path = out_dir / "missing_from_telegram_uploads_detailed.txt"
    with missing_path.open("w", encoding="utf-8") as f:
        for r in missing:
            f.write(r.tg_file_name + "\n")
            if r.link:
                f.write("  link: " + r.link + "\n")
            if r.drive_link:
                f.write("  drive: " + r.drive_link + "\n")
            if r.drive_filename:
                f.write("  drive_filename: " + r.drive_filename + "\n")
            if r.status or r.camera_type or r.analog_digital:
                f.write(f"  meta: status={r.status} camera={r.camera_type} mode={r.analog_digital}\n")
            wider = wider_search(r.tg_file_name, SEARCH_WIDER_ROOT)
            if wider:
                f.write("  maybe_elsewhere:\n")
                for p in wider:
                    f.write("    " + p + "\n")
            f.write("\n")

    report_path = out_dir / "sheet_vs_local_report.csv"
    with report_path.open("w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(
            [
                "tg_file_name",
                "telegram_link",
                "status",
                "camera_type",
                "analog_digital",
                "found_category",
                "matched_paths",
                "drive_link",
                "drive_filename",
            ]
        )
        for r in ordered:
            paths = find_paths_for(r.tg_file_name, by_filename, by_base, by_canon) or []
            category = classify_paths(paths)
            w.writerow(
                [
                    r.tg_file_name,
                    r.link,
                    r.status,
                    r.camera_type,
                    r.analog_digital,
                    category,
                    " | ".join(paths[:10]),
                    r.drive_link,
                    r.drive_filename,
                ]
            )

    missing_links_path = out_dir / "missing_telegram_links.txt"
    with missing_links_path.open("w", encoding="utf-8") as f:
        for r in missing:
            if r.link:
                f.write(r.link.strip() + "\n")

    print(f"Sheet unique names: {len(ordered)}")
    print(f"Found under '{ROOT}': {len(found)}")
    print(f"Missing: {len(missing)}")
    print(f"Missing detailed report: {missing_path}")
    print(f"Report CSV: {report_path}")
    print(f"Missing telegram links: {missing_links_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
