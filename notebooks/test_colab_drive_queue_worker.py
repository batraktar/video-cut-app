import importlib.util
import json
import sys
import tempfile
import types
import unittest
from pathlib import Path
from unittest.mock import patch


if "torch" not in sys.modules:
    torch = types.ModuleType("torch")
    torch.cuda = types.SimpleNamespace(is_available=lambda: False)
    sys.modules["torch"] = torch
if "ultralytics" not in sys.modules:
    ultralytics = types.ModuleType("ultralytics")
    ultralytics.YOLO = object
    sys.modules["ultralytics"] = ultralytics

MODULE_PATH = Path(__file__).with_name("colab_drive_queue_worker.py")
SPEC = importlib.util.spec_from_file_location("colab_drive_queue_worker", MODULE_PATH)
worker = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(worker)


class DriveQueueCancellationTests(unittest.TestCase):
    def test_cancel_requested_is_detected_from_drive_job_json(self):
        with tempfile.TemporaryDirectory() as directory:
            job_path = Path(directory) / "job.json"
            job_path.write_text(json.dumps({"status": "processing", "cancel_requested": True}))

            self.assertTrue(worker.cancellation_requested(job_path))

    def test_cancelled_jobs_are_not_returned_to_the_pending_queue(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            cancelled_path = root / "batch" / "jobs" / "cancelled.json"
            cancelled_path.parent.mkdir(parents=True)
            cancelled_path.write_text(json.dumps({"task_id": "cancelled", "status": "cancelled"}))
            active_path = root / "batch" / "jobs" / "active.json"
            active_path.write_text(json.dumps({"task_id": "active", "status": "accepted"}))

            with patch.object(worker, "DRIVE_ROOT", root):
                self.assertEqual(worker.pending_jobs(), [active_path])

    def test_processing_job_with_stop_request_is_cancelled_on_resume(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            job_path = root / "batch" / "jobs" / "resume.json"
            job_path.parent.mkdir(parents=True)
            job_path.write_text(json.dumps({"task_id": "resume", "status": "processing", "cancel_requested": True}))

            with patch.object(worker, "DRIVE_ROOT", root):
                self.assertEqual(worker.pending_jobs(), [])

            saved = json.loads(job_path.read_text())
            self.assertEqual(saved["status"], "cancelled")
            self.assertFalse(saved["cancel_requested"])


if __name__ == "__main__":
    unittest.main()
