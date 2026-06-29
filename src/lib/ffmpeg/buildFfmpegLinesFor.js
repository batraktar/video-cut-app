import { DEFAULT_EDIT_STATE } from '../editorConstants';
import { clamp, filterElementsForMode, getSegmentsForMode } from '../editorUtils';
import { buildFilterGraph } from './buildFilterGraph';

export const buildFfmpegLinesFor = (video, edit, options = {}) => {
  const {
    batchSuffix = '',
    getVideoOutputDir,
    getVideoDoneDir,
    getSegmentModeForVideo,
    buildRcloneCopyLine,
    segmentsOverride
  } = options;

  const outputDir = options.outputDir || getVideoOutputDir?.(video);
  const useBatchSuffix = options.useBatchSuffix || false;
  const allowRenameOriginal = options.allowRenameOriginal !== false;
  const includeRenameLine = options.includeRenameLine !== false;
  const doneDir = options.doneDir || getVideoDoneDir?.(video);
  const overwriteOutput = options.overwriteOutput;
  const overwriteFlag = overwriteOutput === true ? '-y ' : overwriteOutput === false ? '-n ' : '';

  if (!video || !edit) return { lines: [], usesTemp: false, error: 'missing' };
  if (!outputDir) return { lines: [], usesTemp: false, error: 'missingOutputDir' };
  if (!doneDir) return { lines: [], usesTemp: false, error: 'missingDoneDir' };
  if (!getSegmentModeForVideo) return { lines: [], usesTemp: false, error: 'missingSegmentMode' };

  const meta = edit.meta || {};
  const crop = edit.crop || DEFAULT_EDIT_STATE.crop;
  const segmentMode = options.segmentMode || getSegmentModeForVideo(video);
  const elements = filterElementsForMode(edit.elements, segmentMode);
  const hasCrop = !!(crop.t || crop.b || crop.l || crop.r);
  const hasElements = elements.length > 0;
  const hasFilters = hasCrop || hasElements;

  const safeDuration = Number.isFinite(meta.duration) && meta.duration > 0 ? meta.duration : null;
  const clampTime = val => (safeDuration ? clamp(val, 0, safeDuration) : Math.max(0, val));

  const modeSegments = Array.isArray(segmentsOverride)
    ? segmentsOverride
    : getSegmentsForMode(edit, segmentMode);
  const baseSegments =
    Array.isArray(modeSegments) && modeSegments.length > 0
      ? modeSegments
      : [
          {
            start: edit.trim?.start ?? 0,
            end: edit.trim?.end ?? safeDuration ?? 0
          }
        ];
  const exportSegments = baseSegments
    .map(seg => {
      const rawStart = Number.isFinite(seg.start) ? seg.start : 0;
      const rawEnd = Number.isFinite(seg.end) ? seg.end : safeDuration ?? rawStart + 0.1;
      const start = clampTime(Math.min(rawStart, rawEnd));
      const end = clampTime(Math.max(rawStart, rawEnd));
      return { start, end };
    })
    .filter(seg => seg.end > seg.start);
  if (exportSegments.length === 0) exportSegments.push({ start: 0, end: safeDuration ?? 0 });

  const sourcePath = video.sourcePath || video.name || 'input.mp4';
  const fileName = sourcePath.split('/').pop() || sourcePath;
  const dot = fileName.lastIndexOf('.');
  const baseName = dot > 0 ? fileName.slice(0, dot) : fileName;
  const ext = dot > 0 ? fileName.slice(dot + 1) : 'mp4';
  const perVideoSuffix = video?.suffix || '';
  const extraBatchSuffix = useBatchSuffix && batchSuffix ? batchSuffix : '';
  const suffix = `${perVideoSuffix}${extraBatchSuffix}`;
  const outputName = `${baseName}${suffix}.${ext}`;
  const inputPath = sourcePath.startsWith('./') ? sourcePath : `./${sourcePath}`;
  const outputPath = `${outputDir}/${outputName}`;

  if (video.notRelevant) {
    const notRelevantPath = `${doneDir}/${baseName}_not_relevant.${ext}`;
    const moveLine = `[ -e "${inputPath}" ] && [ ! -e "${notRelevantPath}" ] && mkdir -p "${doneDir}" && mv "${inputPath}" "${notRelevantPath}"`;
    return {
      lines: [moveLine],
      usesTemp: false,
      needsOutputDir: false,
      outputDir,
      doneDir
    };
  }

  const sourceDonePath =
    allowRenameOriginal && !baseName.endsWith('_done') ? `${doneDir}/${baseName}_done.${ext}` : null;
  const renameLine = sourceDonePath
    ? `[ -f "${outputPath}" ] && [ -e "${inputPath}" ] && [ ! -e "${sourceDonePath}" ] && mkdir -p "${doneDir}" && mv "${inputPath}" "${sourceDonePath}"`
    : null;

  if (!hasFilters) {
    if (exportSegments.length === 1) {
      const seg = exportSegments[0];
      const rcloneLine = buildRcloneCopyLine?.(outputPath);
      return {
        lines: [
          `ffmpeg ${overwriteFlag}-ss ${seg.start.toFixed(3)} -to ${seg.end.toFixed(
            3
          )} -i "${inputPath}" -c copy -an -movflags +faststart "${outputPath}"`,
          ...(rcloneLine ? [rcloneLine] : []),
          ...(includeRenameLine && renameLine ? [renameLine] : [])
        ],
        usesTemp: false,
        outputName,
        outputPath,
        needsOutputDir: true,
        outputDir,
        doneDir,
        renameLine
      };
    }

    const tmpDir = `${outputDir}/_tmp`;
    const listPath = `${tmpDir}/${baseName}_list.txt`;
    const segmentFiles = exportSegments.map((seg, idx) => ({
      path: `${tmpDir}/${baseName}_seg${idx + 1}.${ext}`,
      start: seg.start,
      end: seg.end
    }));
    const listLines = segmentFiles.map(seg => `file '${seg.path.split('/').pop()}'`).join('\\n');
    const rcloneLine = buildRcloneCopyLine?.(outputPath);
    const lines = [
      ...segmentFiles.map(
        seg =>
          `ffmpeg ${overwriteFlag}-ss ${seg.start.toFixed(3)} -to ${seg.end.toFixed(
            3
          )} -i "${inputPath}" -c copy -an "${seg.path}"`
      ),
      `printf "${listLines}\\n" > "${listPath}"`,
      `ffmpeg ${overwriteFlag}-f concat -safe 0 -i "${listPath}" -c copy -an "${outputPath}"`,
      ...(rcloneLine ? [rcloneLine] : []),
      `rm -f "${listPath}" ${segmentFiles.map(seg => `"${seg.path}"`).join(' ')}`,
      ...(includeRenameLine && renameLine ? [renameLine] : [])
    ];

    return {
      lines,
      usesTemp: true,
      outputName,
      outputPath,
      needsOutputDir: true,
      outputDir,
      tmpDir,
      doneDir,
      renameLine
    };
  }

  const built = buildFilterGraph({ meta, crop, elements, segments: exportSegments });
  if (built.error) return { lines: [], usesTemp: false, error: built.error };
  const { graph, outputLabel } = built;
  const rcloneLine = buildRcloneCopyLine?.(outputPath);

  return {
    lines: [
      `ffmpeg ${overwriteFlag}-i "${inputPath}" -filter_complex "${graph}" -map "[${outputLabel}]" -an -c:v libx264 -crf 18 -preset slow -movflags +faststart "${outputPath}"`,
      ...(rcloneLine ? [rcloneLine] : []),
      ...(includeRenameLine && renameLine ? [renameLine] : [])
    ],
    usesTemp: false,
    outputName,
    outputPath,
    needsOutputDir: true,
    outputDir,
    doneDir,
    renameLine
  };
};
