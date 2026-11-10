"""Process the editor's Drive-backed batch queue from an active Colab notebook."""

from __future__ import annotations

import json
import math
import os
import shutil
import subprocess
import tempfile
import time
from collections import Counter
from pathlib import Path

import torch
from ultralytics import YOLO


DRIVE_ROOT = Path("/content/drive/MyDrive/best2_training/colab_jobs")
MODEL_PATH = Path("/content/drive/MyDrive/best2_training/input/best2.pt")
DEFAULT_FPS = 1.0
DEFAULT_IMAGE_SIZE = 320
DEFAULT_MIN_DURATION = 2.0
DEFAULT_SMOOTH_WINDOW = 3
IDLE_EXIT_SECONDS = 60
DEVICE = 0 if torch.cuda.is_available() else "cpu"


def atomic_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + f".{os.getpid()}.tmp")
    temporary.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(temporary, path)


def normalize_label(label: str) -> str:
    value = str(label or "").strip().lower().replace("-", "_").replace(" ", "_")
    thermal = "thermal" in value or "infrared" in value or value.startswith("ir_")
    if thermal and "analog" in value:
        return "thermal_analog"
    if thermal and "digital" in value:
        return "thermal_digital"
    if "analog" in value:
        return "analog"
    if "digital" in value:
        return "digital"
    return value


def smooth_labels(labels: list[str], window: int) -> list[str]:
    if len(labels) < 3 or window <= 1:
        return list(labels)
    window = max(1, int(window))
    if window % 2 == 0:
        window += 1
    radius = window // 2
    smoothed = []
    for index, current in enumerate(labels):
        counts = Counter(labels[max(0, index - radius):min(len(labels), index + radius + 1)])
        smoothed.append(max(counts, key=lambda label: (counts[label], label == current)))
    return smoothed


def build_segments(labels: list[str], fps: float, min_duration: float) -> tuple[dict, int]:
    if not labels:
        return {}, 0
    minimum_frames = max(1, math.ceil(min_duration * fps))
    segments: dict[str, list[dict]] = {}
    dropped_runs = 0
    start = 0
    current = labels[0]

    def add_run(label: str, first: int, end: int) -> None:
        nonlocal dropped_runs
        if end - first < minimum_frames:
            dropped_runs += 1
            return
        segments.setdefault(label, []).append({
            "id": f"{label}_{first}_{end}",
            "start": round(first / fps, 3),
            "end": round(end / fps, 3),
        })

    for index in range(1, len(labels)):
        if labels[index] != current:
            add_run(current, start, index)
            start, current = index, labels[index]
    add_run(current, start, len(labels))
    return segments, dropped_runs


def save_job(job_path: Path, job: dict) -> None:
    previous_status = None
    if job_path.is_file():
        try:
            previous_status = json.loads(job_path.read_text(encoding="utf-8")).get("status")
        except Exception:
            pass
    atomic_json(job_path, job)
    if previous_status == job.get("status") and job.get("status") not in {"done", "error"}:
        return
    batch_dir = job_path.parents[1]
    current_jobs = []
    for item_path in sorted((batch_dir / "jobs").glob("*.json")):
        if item_path == job_path:
            current_jobs.append(job)
            continue
        try:
            current_jobs.append(json.loads(item_path.read_text(encoding="utf-8")))
        except Exception:
            continue
    atomic_json(batch_dir / "result_manifest.json", {
        "batch_id": job.get("batch_id"),
        "updated_at": time.time(),
        "items": current_jobs,
    })


def cancellation_requested(job_path: Path) -> bool:
    try:
        current = json.loads(job_path.read_text(encoding="utf-8"))
        return current.get("status") == "cancelled" or bool(current.get("cancel_requested"))
    except Exception:
        return False


def extract_frames(video_path: Path, frames_dir: Path, fps: float, image_size: int) -> list[Path]:
    frames_dir.mkdir(parents=True, exist_ok=True)
    pattern = frames_dir / "%06d.jpg"
    command = [
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-nostdin", "-i", str(video_path),
        "-vf", f"fps={fps},scale={image_size}:-2", "-q:v", "2", str(pattern),
    ]
    result = subprocess.run(command, capture_output=True, text=True)
    if result.returncode:
        raise RuntimeError(f"FFmpeg failed: {(result.stderr or 'unknown error')[-1200:]}")
    frames = sorted(frames_dir.glob("*.jpg"))
    if not frames:
        raise RuntimeError("FFmpeg витягнув 0 кадрів")
    return frames


def process_job(job_path: Path, model: YOLO) -> None:
    job = json.loads(job_path.read_text(encoding="utf-8"))
    if job.get("status") == "cancelled":
        return
    job.update(status="processing", started_at=time.time(), attempts=int(job.get("attempts", 0)) + 1)
    save_job(job_path, job)
    batch_dir = job_path.parents[1]
    video_path = batch_dir / job["input_relpath"]
    fps = float(job.get("fps", DEFAULT_FPS))
    image_size = int(job.get("image_size", DEFAULT_IMAGE_SIZE))
    min_duration = float(job.get("min_duration", DEFAULT_MIN_DURATION))
    smooth_window = int(job.get("smooth_window", DEFAULT_SMOOTH_WINDOW))
    try:
        if not video_path.is_file():
            raise FileNotFoundError(f"Drive input is missing: {video_path}")
        with tempfile.TemporaryDirectory(prefix="video-cut-frames-") as temp_dir:
            local_video = Path(temp_dir) / video_path.name
            shutil.copy2(video_path, local_video)
            frames = extract_frames(local_video, Path(temp_dir) / "frames", fps, image_size)
            labels, confidences = [], []
            for offset in range(0, len(frames), 32):
                if cancellation_requested(job_path):
                    job.update(status="cancelled", cancelled_at=time.time(), cancel_requested=False)
                    save_job(job_path, job)
                    return
                predictions = model.predict(
                    [str(path) for path in frames[offset:offset + 32]],
                    verbose=False,
                    device=DEVICE,
                )
                for prediction in predictions:
                    if prediction.probs is None:
                        raise RuntimeError("Модель має бути класифікатором із result.probs")
                    labels.append(normalize_label(model.names[int(prediction.probs.top1)]))
                    confidences.append(float(prediction.probs.top1conf))
                if cancellation_requested(job_path):
                    job.update(status="cancelled", cancelled_at=time.time(), cancel_requested=False)
                    save_job(job_path, job)
                    return
                job["processed_frames"] = min(offset + 32, len(frames))
                job["frame_count"] = len(frames)
                save_job(job_path, job)
            smoothed = smooth_labels(labels, smooth_window)
            segments, dropped_runs = build_segments(smoothed, fps, min_duration)
            allowed_modes = set(job.get("allowed_modes") or [])
            segments = {mode: ranges for mode, ranges in segments.items() if mode in allowed_modes}
        job.update(
            status="done",
            result=segments,
            label_counts=dict(Counter(smoothed)),
            average_confidence=round(sum(confidences) / len(confidences), 4) if confidences else None,
            dropped_runs=dropped_runs,
            finished_at=time.time(),
            error=None,
        )
    except Exception as error:
        job.update(status="error", error=str(error), finished_at=time.time())
    save_job(job_path, job)


def pending_jobs() -> list[Path]:
    paths = sorted(DRIVE_ROOT.glob("*/jobs/*.json"))
    queued = []
    for path in paths:
        try:
            job = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            continue
        if job.get("status") in {"accepted", "queued", "processing"}:
            if job.get("status") == "processing":
                if job.get("cancel_requested"):
                    job.update(status="cancelled", cancelled_at=time.time(), cancel_requested=False)
                    save_job(path, job)
                    continue
                job.update(status="queued", recovered_at=time.time())
                save_job(path, job)
            queued.append(path)
    return queued


def main() -> None:
    if not MODEL_PATH.is_file():
        raise FileNotFoundError(f"Не знайдено best2.pt: {MODEL_PATH}")
    print(f"Завантажую модель на {DEVICE}: {MODEL_PATH}")
    model = YOLO(str(MODEL_PATH))
    print("Класи:", model.names)
    print("Читаю нові й незавершені черги з Google Drive. Готові задачі повторно не запускаються.")
    print("Якщо нових задач немає 1 хвилину, ця комірка зупиниться; уже збережені результати залишаться в Drive.")
    last_work = time.monotonic()
    completed_ids = set()
    while True:
        queue_paths = pending_jobs()
        if queue_paths:
            for job_path in queue_paths:
                try:
                    # Re-read immediately before processing in case a retried job changed.
                    job = json.loads(job_path.read_text(encoding="utf-8"))
                    if job.get("status") not in {"accepted", "queued", "processing"}:
                        continue
                    print(f"Обробка: {job.get('file_name')} [{job.get('task_id')}]")
                    process_job(job_path, model)
                    final = json.loads(job_path.read_text(encoding="utf-8"))
                    print(f"{final.get('status')}: {final.get('file_name')} — {final.get('error') or len(final.get('result', {}))} ")
                    completed_ids.add(job.get("task_id"))
                    last_work = time.monotonic()
                except Exception as error:
                    print(f"Не вдалося прочитати задачу {job_path}: {error}")
            continue
        if time.monotonic() - last_work >= IDLE_EXIT_SECONDS:
            print("Черга порожня. Усі оригінали й результати залишились у Google Drive.")
            break
        time.sleep(10)


if __name__ == "__main__":
    main()
