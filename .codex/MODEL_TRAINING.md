# best2 model and training status

Updated: 2026-10-30

## Current checkpoint

- `best2.pt` is a local 2.8 MB checkpoint used by `colab_ngrok_inference_fixed.ipynb` through `YOLO(MODEL_PATH)`.
- The inference path expects a classification result (`prediction.probs`) and reads the predicted class from `model.names`; it normalizes names into `analog`, `digital`, `thermal_analog`, or `thermal_digital`.
- Colab loaded the checkpoint as `YOLOv8n-cls` (1,443,412 parameters), transferred 158/158 pretrained items, and found four classes in each split with no corrupt images.
- The first Colab attempt stopped after epoch 1/80 when runtime RAM was exhausted. Its train loss 1.936 was not an accuracy score. The safe rerun used fixed `batch=32`, `workers=0`, and `cache=False`; it stopped after epoch 13 by early stopping (patience 12).
- Safe-run validation top-1 was 0.895. The original checkpoint validation top-1 was 0.7567316889762878, a +13.83 percentage-point gain on the same validation split. Fine-tuned test top-1 was 0.867859363559082 across 3,186 images. The notebook's earlier printed comparison of this test result to baseline validation was cross-split and should not be used.
- Same-split test comparison is now complete: fine-tuned `best.pt` scored 0.867859363559082 (86.79%) and original `best2.pt` scored 0.7209667563438416 (72.10%) on the same 3,186 test images, a +14.689 percentage-point improvement. Both runs found four classes and zero corrupt test images. This is strong dataset evidence, but confusion-matrix and real-video checks remain before application replacement.
- Do not start another training run just because of the measured gain. First inspect confusion matrices and check representative real clips; use the saved fine-tuned checkpoint as the current candidate. Train again when new, distinct source videos or confirmed error examples have been added.
- The trained checkpoint was saved to Drive at `best2_training/runs/thermal_finetune_v1_safe/weights/best.pt`; `last.pt` is the recovery checkpoint. The original `best2.pt` remains unchanged in the app. Top-5 accuracy of 1.0 is not informative with only four classes.
- `best2.pt` has not been replaced in the application.

## Dataset

Canonical local data: `datasets/best2_thermal_v1/` (ignored by Git).

- 21,256 JPEG frames, approximately 0.99 GiB.
- Four classes: `analog`, `digital`, `thermal_analog`, `thermal_digital`. Snow is a condition, not a class.
- Sampling: 2 frames/second, longest edge 1024 pixels, JPEG quality 3; exact duplicate frames removed.
- Split is grouped by normalized source-video name: 70% train, 15% validation, 15% test; paired exports remain together.
- Thermal is 72.5% by frame count, close to the requested thermal-heavy target; analog/digital balance depends on available source clips.
- The pre-existing local `ммм_crop_analog.mp4` contributed an additional optical source.
- Per-class counts are recorded in `datasets/best2_thermal_v1/README.md`.

## Prepared Colab workflow

Notebook: `notebooks/colab_finetune_best2.ipynb`.

Automatic source-video dataset builder: `notebooks/colab_build_dataset_from_drive.ipynb`. It scans the previously shared Drive folder recursively, recognizes class suffixes in filenames/folder names, samples two frames per second, creates video-grouped train/validation/test splits, and writes a new ZIP to `MyDrive/best2_training/input/`. It reserves approximately 70% of the 1.8 GiB output budget for the two thermal classes. It carries over source-group splits from `best2_thermal_v1.zip` when that archive is present, to reduce leakage between dataset versions. Check the class counts and unknown-name report before using the generated ZIP for another training run.

Progress on 2026-10-30: `best2_thermal_v1.zip` was created locally and passed `unzip -t`. Colab initially reported `best2.pt` missing; the user uploaded both required inputs to `My Drive/best2_training/input/`. A T4 run completed successfully with the safe settings.

1. Upload `best2.pt` and a ZIP containing `best2_thermal_v1/` to `MyDrive/best2_training/input/`.
2. Start a Colab GPU runtime; the notebook checks class folders, checkpoint task, and class order before training.
3. Measure the original checkpoint on validation, then fine-tune with validation-based early stopping. The successful safe run used 80 epochs maximum, patience 12, 224-pixel input, fixed batch 32, AdamW, learning rate 0.001, and per-epoch checkpoint saving to Drive.
4. If a Colab session ends, set `RESUME = True` and resume from Drive's `last.pt`.
5. Compare original and fine-tuned checkpoints on the same held-out test split, inspect per-class confusion, and compare on real videos. Completed on 2026-10-30: fine-tuned test top-1 0.8679 vs original 0.7210 (+14.69 percentage points). Since the test split has now been used to inspect the fine-tuned model, keep it fixed and use new source videos for any future final holdout.

The training process runs on a remote Colab VM, so the local computer can be off after the runtime is started; local internet loss does not inherently require the computer to stay online. The remote runtime can still disconnect or be recycled. Google documents variable availability and limits, including up to 12 hours for free runtimes; treat Drive checkpoints and `last.pt` resume as required recovery steps, not optional backups.

The same-split test gain is promising. Keep the current application model until per-class confusion, class-name order, and representative real-video checks are reviewed. If those checks pass, install the saved `best.pt` as a versioned replacement while preserving the original checkpoint for rollback.

## Quality work still needed

- Inspect the fine-tuned and baseline confusion matrices, confirm class-name order, and test representative real videos before any application replacement.
- Use the Drive dataset builder for newly added labeled videos; do not retrain on an unchanged export of the same source clips as if it were new evidence.
- Review errors by class and sensor type; add diverse, correctly labeled source videos for weak thermal and optical cases.
- Keep source videos isolated across train/validation/test. Do not split adjacent frames from one source video between splits.
- Record the selected checkpoint hash, dataset version, same-split baseline comparison, and deployment decision before replacing the application model.

## Reviewable video-to-dataset loop

The user clarified that all videos they upload to Google Drive for this workflow are eligible source material for both submission processing and future datasets. Keep labels/crops reviewable, avoid ambiguous blurred pixels as labels, and preserve source-video split provenance.

Recommended direction:

- Start with deterministic region metadata and candidate crops from the original, unblurred source frame: source/video ID, timestamp, normalized box coordinates, sensor/channel, and a human-confirmed class. Keep candidate examples in a review queue; do not silently auto-train or mix unreviewed submissions into the training set.
- A manually specified fixed edge/band mask does not need a learned blur detector. For logos, train a separate object detector on reviewed bounding boxes; the current `best2.pt` classifier predicts one class for a whole image and does not localize objects. Tracking can associate detections across adjacent video frames, but does not replace detector training.
- Do not expect a model to recover logo details hidden by an already-applied blur. Crop from the clean source before export. Keep video-level train/validation/test splits to avoid near-duplicate frames crossing splits.
- The repository has `/ai/logo` UI/API wiring and template-match settings; its default helper path points to `ml/detect_logo.py`, which is not tracked in this repository. Verify whether an external helper is configured before extending that feature.
- Privacy and storage need an explicit retention choice: keep only reviewed crops/annotations when possible, retain the source only when needed and authorized, and provide a way to exclude a video from collection.

Initial collector implementation added 2026-10-31: right-click a selected rectangle or circle and choose **Зберегти кадр у датасет**, or use the configurable **G** hotkey (change it in hotkey settings). The app captures the current clean video frame (without drawing the overlay into the pixels), normalizes the shape bounds, and immediately uploads an image, YOLO label, and JSON provenance through the local server/rclone to `best2_training/cover_region_dataset/inbox/`. This upload is separate from the Clipchamp export folder and is not automatically triggered by exporting a video. All examples use the single detection class `cover_region`, which means “a human-confirmed area to cover”; original kind/source/time metadata is retained. This is separate from `best2.pt` and does not train automatically. The connected Drive/rclone transfer still needs an end-to-end user run before claiming it works against the user's account.

The collector does not yet scan old videos automatically, track boxes across frames, train a detector, or propose automatic covers. A later detector should be trained from the reviewed examples with video-grouped splits and real-video validation. Blurred pixels are not a source for recovering hidden logo details.

## Drive-backed batch Colab processing from the editor

The user explicitly authorized implementation on 2026-10-31. They select videos as usual in the editor; local server copies all selected videos to `best2_training/colab_jobs/<batch-id>/` using the configured rclone remote. The app shows per-video upload/accept/processing/done/error states. Once every intended video is accepted into Drive, the local app/host can be closed. The user runs the Drive queue notebook in Colab, which processes jobs sequentially and stores results alongside the original videos.

Implementation added 2026-10-31: `server/server.js` exposes `/ai/drive-batch/start`, `/ai/drive-batch/:batchId/files`, and `/ai/drive-batch/:batchId`. The AI queue and cover dataset use the dedicated `aiDriveRemote` setting, which must point to the user's personal My Drive containing `best2_training`; Clipchamp exports retain the separate `clipchampDriveRemote` setting. The editor uploads two files at a time and persists the last batch in browser local storage; it can refresh Drive job states and apply completed segments after reopening. Each accepted job JSON and original video are stored in Drive. `notebooks/colab_durable_batch_inference.ipynb` mounts Drive and runs `notebooks/colab_drive_queue_worker.py`; a killed runtime can requeue jobs left in `processing`. Completed jobs include segments and diagnostics; the worker writes a batch `result_manifest.json`.

The editor top-bar upload icon sends selected videos through the currently selected Colab mode. `AI інспекція` opens the AI tab directly so the queue and results are visible; the AI tab provides the legacy ngrok and Drive-backed actions as well as a separate local inference action.

The queue Stop action aborts local uploads/polling and calls the Drive stop endpoint. Colab marks queued jobs cancelled and flags active inference for cancellation at its next frame batch check; Drive originals and completed outputs remain. The legacy Ngrok Stop aborts the active request/poll in the editor; it does not promise server-side cancellation once the old Colab has accepted work.

The user asked whether idle limits can be disabled. They cannot be overridden by notebook code; do not add keep-alive hacks. The initial worker waited 8 minutes with no active jobs; this behavior was superseded on 2026-10-31 to exit after 1 idle minute. Google may still terminate a runtime earlier. Drive persists uploaded videos and job state; rerunning the notebook recovers interrupted jobs and skips completed ones. Uploads require the local host/internet until each file shows accepted. The live rclone/Drive/Colab path has not yet been run against the user's account. See the [official Colab FAQ](https://research.google.com/colaboratory/faq.html).

Superseding workflow note (2026-10-31): AI settings preserve the local segmenter and provide an explicit choice between the legacy Colab/ngrok endpoint and the newer Drive-backed Colab batch queue. The top-bar AI action follows the selected Colab mode. New Drive batch folders start with a sortable UTC timestamp; rerunning the notebook skips jobs already marked `done`. The Drive queue worker exits after one idle minute. Stop requests cancel queued Drive jobs and are checked between inference frame batches for active jobs.

Channel integrity correction (2026-10-31): classifier predictions must not change a video's assigned channel list. Apply returned segments only for modes supported by explicit spreadsheet channel metadata or the video's authoritative mode/suffix. If old AI imports added unassigned channel entries, remove only those unsupported entries when applying a later AI result; preserve spreadsheet-assigned channels. A Colab prediction such as `digital` on an Analog-only source is a model false positive and must not relabel that video.

## Assisted logo covering

User example on 2026-10-31 shows logos with different designs, sizes, and positions, including corner badges and a small lower-frame mark. The user wants faster assisted covering and wants manually confirmed cover areas to build a separate dataset.

The editor now saves a manually confirmed current frame and shape bounds from the shape context menu. The cover is not baked into the saved image; the box is stored as YOLO annotation for a one-class `cover_region` detector. Next stages still needed: scan older segmented videos, track/propagate the first box through a clip, curate/review enough examples, split by source video, train a separate detector, and validate suggested covers. `best2.pt` remains a whole-frame channel classifier and cannot localize logos. Existing `/ai/logo` template matching only helps for sufficiently similar stable marks. Do not infer hidden logo details from blurred pixels.
