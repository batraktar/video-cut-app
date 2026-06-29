import { describe, expect, it } from 'vitest';
import {
  buildLinkFilenameMap,
  buildSheetRows,
  normalizeTelegramLink,
  resolveSheetFilenames
} from './sheetRows.js';

describe('sheet row mapping', () => {
  it('fills a blank tg_file_name from links_map.csv data', () => {
    const sheetRows = buildSheetRows([
      ['link', 'status', 'camera_type', 'Labels', 'analog_digital', 'cutted_link', 'date_video', 'tg_file_name'],
      ['https://t.me/example/42', 'to cut', 'Thermal', 'snow', 'Digital', '', '', '']
    ]);
    const linkMap = buildLinkFilenameMap([
      { link: 'https://t.me/example/42/', filename: 'IMG_0042.MP4' }
    ]);

    expect(resolveSheetFilenames(sheetRows, linkMap)).toEqual({
      rows: [
        {
          rowIndex: 2,
          link: 'https://t.me/example/42',
          fileName: 'IMG_0042.MP4',
          analogDigital: 'Digital',
          status: 'to cut',
          cameraType: 'Thermal',
          labels: 'snow'
        }
      ],
      totalRows: 1,
      resolvedFromLinksMap: 1,
      unresolvedRows: 0
    });
  });

  it('keeps an existing tg_file_name and normalizes Telegram links', () => {
    expect(normalizeTelegramLink('https://www.t.me/Example/42/?single=1')).toBe(
      't.me/example/42'
    );
    const result = resolveSheetFilenames(
      [{ link: 'https://t.me/example/42', fileName: 'existing.mp4' }],
      new Map([['t.me/example/42', 'fallback.mp4']])
    );
    expect(result.rows[0].fileName).toBe('existing.mp4');
    expect(result.resolvedFromLinksMap).toBe(0);
  });
});
