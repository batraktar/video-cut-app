import { normalizeName, resolveSegmentModeFromMeta, resolveSegmentModeFromSuffix } from '../../lib/editorUtils';

export type VideoChannelLike = {
  mode?: string;
};

export type VideoLike = {
  fileKey?: string;
  channelMode?: string;
  channels?: VideoChannelLike[];
  sheetMode?: string;
  sheetCameraType?: string;
  suffix?: string;
};

export type FileKeyVariants = {
  hasThermal: boolean;
};

export const isAnalogVariant = (video: VideoLike) => {
  if (video?.channelMode) return normalizeName(video.channelMode).includes('analog');
  if (Array.isArray(video?.channels) && video.channels.length > 0) {
    return video.channels.some(channel => normalizeName(channel.mode).includes('analog'));
  }
  const mode = normalizeName(video?.sheetMode);
  if (mode.includes('analog')) return true;
  const suffix = normalizeName(video?.suffix);
  return suffix.includes('analog');
};

export const isThermalVariant = (video: VideoLike) => {
  if (video?.channelMode) return normalizeName(video.channelMode).includes('thermal');
  if (Array.isArray(video?.channels) && video.channels.length > 0) {
    return video.channels.some(channel => normalizeName(channel.mode).includes('thermal'));
  }
  const camera = normalizeName(video?.sheetCameraType);
  if (camera.includes('thermal') || camera.includes('infrared')) return true;
  const suffix = normalizeName(video?.suffix);
  return suffix.includes('thermal');
};

export const getFileKeyVariants = (list: VideoLike[]) => {
  const variants = new Map<string, FileKeyVariants>();
  (list || []).forEach(item => {
    if (!item?.fileKey) return;
    const entry = variants.get(item.fileKey) || { hasThermal: false };
    if (isThermalVariant(item)) entry.hasThermal = true;
    variants.set(item.fileKey, entry);
  });
  return variants;
};

export const getSegmentModeForVideo = (video: VideoLike): string => {
  if (video?.channelMode) return video.channelMode;
  if (Array.isArray(video?.channels) && video.channels.length > 0) {
    return video.channels[0].mode || 'digital';
  }
  const metaMode = resolveSegmentModeFromMeta(video?.sheetMode, video?.sheetCameraType);
  if (metaMode) return metaMode;
  const suffixMode = resolveSegmentModeFromSuffix(video?.suffix);
  if (suffixMode) return suffixMode;
  const isThermal = isThermalVariant(video);
  const isAnalog = isAnalogVariant(video);
  if (isThermal && isAnalog) return 'thermal_analog';
  if (isThermal && !isAnalog) return 'thermal_digital';
  if (!isThermal && isAnalog) return 'analog';
  return 'digital';
};

export const getExpectedModesForAi = (video: VideoLike): string[] => {
  if (!video) return [];
  if (video.channelMode) return [video.channelMode];
  if (Array.isArray(video.channels) && video.channels.length > 0) {
    return video.channels.map(channel => channel.mode).filter(Boolean) as string[];
  }
  const metaMode = resolveSegmentModeFromMeta(video.sheetMode, video.sheetCameraType);
  const suffixMode = resolveSegmentModeFromSuffix(video.suffix);
  const hint = metaMode || suffixMode;
  return hint ? [hint] : [];
};
