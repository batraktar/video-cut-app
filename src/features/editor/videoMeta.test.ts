import { describe, expect, it } from 'vitest';
import { getExpectedModesForAi, getFileKeyVariants, getSegmentModeForVideo, isThermalVariant } from './videoMeta';

describe('videoMeta', () => {
  it('detects segment mode from explicit channelMode', () => {
    expect(getSegmentModeForVideo({ channelMode: 'analog' })).toBe('analog');
  });

  it('detects thermal variant via camera type', () => {
    expect(isThermalVariant({ sheetCameraType: 'thermal' })).toBe(true);
  });

  it('computes fileKey variants', () => {
    const variants = getFileKeyVariants([
      { fileKey: 'a', sheetCameraType: 'thermal' },
      { fileKey: 'a', sheetCameraType: 'digital' },
      { fileKey: 'b', sheetCameraType: 'digital' }
    ]);
    expect(variants.get('a')?.hasThermal).toBe(true);
    expect(variants.get('b')?.hasThermal).toBe(false);
  });

  it('uses sheet channel metadata instead of unassigned AI-predicted channel additions', () => {
    expect(getExpectedModesForAi({
      suffix: '_crop_analog',
      channels: [
        { mode: 'analog', sheetMode: 'Analog', sheetRow: 12 },
        { mode: 'digital', suffix: '_crop_digital', sheetMode: '' }
      ]
    })).toEqual(['analog']);
  });

  it('keeps multiple explicitly assigned sheet channels', () => {
    expect(getExpectedModesForAi({
      channels: [
        { mode: 'analog', sheetMode: 'Analog', sheetRow: 12 },
        { mode: 'digital', sheetMode: 'Digital', sheetRow: 13 }
      ]
    })).toEqual(['analog', 'digital']);
  });

  it('does not infer an AI channel from a suffix without a sheet row', () => {
    expect(getExpectedModesForAi({ suffix: '_crop_digital' })).toEqual([]);
    expect(getExpectedModesForAi({ channels: [{ mode: 'analog', suffix: '_crop_analog' }] })).toEqual([]);
  });
});

