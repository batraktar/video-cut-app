# Video Cut App Project Index

## Scope

React/Vite video editor with a local Express/SQLite service and Colab notebooks. GitHub repository: `batraktar/video-cut-app`.

## AI model routes

- Read [MODEL_TRAINING.md](MODEL_TRAINING.md) for the verified `best2.pt` contract, dataset status, fine-tuning workflow, and unresolved validation.
- `best2.pt` is the local checkpoint consumed by `colab_ngrok_inference_fixed.ipynb`.
- `notebooks/colab_finetune_best2.ipynb` is the prepared Colab fine-tuning workflow.
- `notebooks/colab_build_dataset_from_drive.ipynb` builds a labeled, frame-sampled dataset from the shared Drive source videos before future fine-tuning.
- `notebooks/colab_durable_batch_inference.ipynb` runs a Drive-backed batch worker; its processing logic is in `notebooks/colab_drive_queue_worker.py`. Drive batch folder names carry a sortable UTC timestamp, and the worker skips completed jobs and exits after one idle minute.
- `server/server.js` exposes local `/ai/drive-batch/*` routes that verify the dedicated `aiDriveRemote`, create Drive batches, stream per-file rclone progress through `/progress`, read results back, and cancel queued/active Colab jobs; Clipchamp export keeps its separate `clipchampDriveRemote` and `clipchampDriveFolderId` settings (default folder `1p7uEPZ8WIWWvzbAmy9sV3-L4hWLj-ieb`) and copies rendered video files directly into that folder.
- `server/rcloneProgress.js` parses rclone transfer-stat lines for the per-file upload progress endpoint; `src/features/export/clipchampJobStatus.js` turns Clipchamp render/upload markers and rclone stats into Ukrainian phase, file-count, speed, and per-file summaries. `src/components/AdminModal.jsx` shows those summaries while keeping the copyable technical log collapsed; `src/components/AdminHistoryModal.jsx` translates job states and reports parsed progress.
- Export jobs run in their own process group so stopping a job terminates its shell and child tools; canceled Clipchamp progress is labeled as a snapshot at stop time.
- The Clipchamp job view tracks rendering and Drive upload separately for each output file. Failed or canceled jobs expose `/jobs/:id/retry-incomplete`, which rebuilds a job from its saved command and log, skips completed uploads, and reuses rendered local files when they still exist.
- The AI tab keeps local inference and lets the user switch the Colab action between the legacy ngrok endpoint and the Drive-backed batch queue. The top-bar upload icon follows the selected Colab mode. Drive-backed predictions keep the class labels returned by the model even if stored video metadata names another channel.
- The legacy URL-based AI route accepts the notebook's current Cloudflare Quick Tunnel or ngrok URL. `/ai/remote-proxy/:remote/{health,predict,result/:taskId}` streams requests through the local Express server to avoid browser CORS preflights; only HTTPS hosts on the supported tunnel domains are accepted. Quick Tunnel addresses change when restarted.
- AI inference and imported Colab segments are restricted to channels already assigned to the video by a Google Sheets row. AI no longer adds channels to playlist metadata.
- FFmpeg commands and Clipchamp exports include only sheet-assigned channels with saved segments; a channel with no segments does not export the full source video. AI row proposals are hidden and `/sheet/append-ai-channel-row` is disabled while sheet additions are paused.
- The editor's shape context menu can send a confirmed current frame and normalized cover box through `/ai/cover-example` into `best2_training/cover_region_dataset/inbox/` for a separate detector dataset.
- Rectangles and ellipses rotate through an on-canvas handle and resize from corners or edges; new circles start at half the previous size. The saved angle is rendered in browser exports and FFmpeg filter graphs. Playlist checkbox selection is restored from local storage when loading local data.
- `datasets/best2_thermal_v1/README.md` describes the frame dataset; `manifest.csv` maps each image to its source and split.

## Maintenance

Keep model checkpoint facts, training status, dataset scope, and next validation action in `MODEL_TRAINING.md`. Update it after a verified training run or any change to classes, dataset, or inference integration.

- `START.command` runs `scripts/start-local.mjs`; the launcher checks the editor title on port 5173 and the app marker in the API health response on port 7071 before reusing either service. If another app owns a port, it exits with a clear error.
