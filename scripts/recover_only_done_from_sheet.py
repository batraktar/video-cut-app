#!/usr/bin/env python3

"""
Copies videos that exist only under */done/* (per sheet_vs_local_report.csv)
into a single folder so they can be re-imported / reprocessed.

Source of truth:
  video-cut-app/tmp/sheet_vs_local_report.csv

Default destination:
  /Users/mac/Desktop/video_cut/Telegram Uploads/recovered_from_done

Behavior:
- For rows where found_category == "only_done", pick a source path from matched_paths (prefer /done/).
- Copy it to destination using tg_file_name as filename (so names match the sheet).
- Never overwrite existing files (logs SKIP if destination exists).
"""

from __future__ import annotations

import csv
import os
import shutil
from pathlib import Path


REPORT_CSV = Path(__file__).resolve().parent.parent / "tmp" / "sheet_vs_local_report.csv"
DEST_DIR = Path("/Users/mac/Desktop/video_cut/Telegram Uploads/recovered_from_done")


def pick_done_path(paths: list[str]) -> str | None:
    if not paths:
        return None
    done = [p for p in paths if "/done/" in p.lower()]
    return (done[0] if done else paths[0]).strip()


def main() -> int:
    if not REPORT_CSV.exists():
        raise SystemExit(f"Missing report: {REPORT_CSV}")

    DEST_DIR.mkdir(parents=True, exist_ok=True)

    copied = 0
    skipped_exists = 0
    skipped_missing_source = 0
    total = 0

    manifest = DEST_DIR / "_manifest.txt"
    with REPORT_CSV.open("r", encoding="utf-8") as f, manifest.open("w", encoding="utf-8") as m:
        reader = csv.DictReader(f)
        for row in reader:
            if row.get("found_category") != "only_done":
                continue
            total += 1
            tg_name = (row.get("tg_file_name") or "").strip()
            if not tg_name:
                continue
            raw_paths = row.get("matched_paths") or ""
            paths = [p.strip() for p in raw_paths.split(" | ") if p.strip()]
            src = pick_done_path(paths)
            if not src or not os.path.exists(src):
                skipped_missing_source += 1
                m.write(f"MISS_SOURCE\t{tg_name}\t{src or ''}\n")
                continue

            dst = DEST_DIR / tg_name
            if dst.exists():
                skipped_exists += 1
                m.write(f"SKIP_EXISTS\t{tg_name}\t{src}\t{dst}\n")
                continue

            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dst)
            copied += 1
            m.write(f"OK\t{tg_name}\t{src}\t{dst}\n")

    print(f"Report: {REPORT_CSV}")
    print(f"Dest:   {DEST_DIR}")
    print(f"Total only_done rows: {total}")
    print(f"Copied: {copied}")
    print(f"Skipped (dest exists): {skipped_exists}")
    print(f"Skipped (missing source): {skipped_missing_source}")
    print(f"Manifest: {manifest}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

