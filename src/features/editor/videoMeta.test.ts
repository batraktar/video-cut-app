import { describe, expect, it } from 'vitest';
import { getFileKeyVariants, getSegmentModeForVideo, isThermalVariant } from './videoMeta';

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
});

