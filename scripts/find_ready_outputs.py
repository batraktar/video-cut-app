#!/usr/bin/env python3

"""
Given the files we restored into:
  /Users/mac/Desktop/video_cut/Telegram Uploads/recovered_from_done

This script searches Telegram Uploads for already-produced outputs for those videos:
- cutted versions (typically the "ready" outputs)
- any _crop/_thermal variants
- done versions

Writes a CSV report to video-cut-app/tmp/ready_outputs_report.csv
"""

from __future__ import annotations

import csv
import os
import re
from pathlib import Path
from typing import Dict, List, Tuple


ROOT = Path("/Users/mac/Desktop/video_cut/Telegram Uploads")
RESTORED_DIR = Path("/Users/mac/Desktop/video_cut/Telegram Uploads/recovered_from_done")
OUT_DIR = Path(__file__).resolve().parent.parent / "tmp"


def norm(s: str) -> str:
    s = str(s or "").strip()
    s = re.sub(r"\s+", " ", s)
    return s.casefold()


SUFFIX_CANON_RE = re.compile(
    r"(?i)(?:"
    r"(?:_done)$|"
    r"(?:_crop(?:_digital|_analog)?)$|"
    r"(?:_thermal(?:_digital|_analog)?)$"
    r")"
)


def strip_copy_suffix(base: str) -> str:
    return re.sub(r"\s*\(\d+\)$", "", base)


def canonical_base(filename: str) -> str:
    base, _ = os.path.splitext(filename)
    base = base.strip()
    while True:
        next_base = SUFFIX_CANON_RE.sub("", base).strip()
        if next_base == base:
            break
        base = next_base
    base = strip_copy_suffix(base).strip()
    return base


def index_by_canon(root: Path) -> Dict[str, List[str]]:
    by_canon: Dict[str, List[str]] = {}
    for dirpath, _, filenames in os.walk(root):
        for fn in filenames:
            key = norm(canonical_base(fn))
            by_canon.setdefault(key, []).append(str(Path(dirpath) / fn))
    return by_canon


def classify(paths: List[str]) -> Tuple[bool, bool, bool, bool]:
    # (has_ready, has_cutted, has_done, has_variants)
    lp = [p.lower() for p in paths]
    has_cutted = any("/cutted/" in p for p in lp)
    has_done = any("/done/" in p for p in lp)
    has_variants = any(("_crop_" in p) or ("_thermal_" in p) for p in lp)
    has_ready = has_cutted  # treat cutted as "ready output"
    return has_ready, has_cutted, has_done, has_variants


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    if not RESTORED_DIR.exists():
        raise SystemExit(f"Missing restored dir: {RESTORED_DIR}")

    restored_files = sorted([p for p in RESTORED_DIR.iterdir() if p.is_file() and not p.name.startswith("_")])
    if not restored_files:
        raise SystemExit(f"No files in: {RESTORED_DIR}")

    by_canon = index_by_canon(ROOT)

    out_path = OUT_DIR / "ready_outputs_report.csv"
    total = 0
    ready_count = 0
    cutted_count = 0
    done_count = 0
    variants_count = 0

    with out_path.open("w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(["name", "has_ready", "has_cutted", "has_done", "has_variants", "paths_sample"])
        for file_path in restored_files:
            total += 1
            name = file_path.name
            canon = norm(canonical_base(name))
            paths = sorted(by_canon.get(canon, []))
            has_ready, has_cutted, has_done, has_variants = classify(paths)
            if has_ready:
                ready_count += 1
            if has_cutted:
                cutted_count += 1
            if has_done:
                done_count += 1
            if has_variants:
                variants_count += 1
            w.writerow([name, int(has_ready), int(has_cutted), int(has_done), int(has_variants), " | ".join(paths[:8])])

    print(f"Restored files: {total}")
    print(f"Has ready(cutted): {ready_count}")
    print(f"Has cutted: {cutted_count}")
    print(f"Has done: {done_count}")
    print(f"Has variants(_crop/_thermal): {variants_count}")
    print(f"Report: {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

