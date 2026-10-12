import { describe, expect, it } from 'vitest';
import {
  buildLinkFilenameMap,
  buildTelegramSheetSyncPlan,
  buildSheetRows,
  normalizeTelegramLink,
  resolveSheetRangeByGid,
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

  it('prefers the latest filename for a repeated Telegram link', () => {
    const map = buildLinkFilenameMap([
      { link: 'https://t.me/example/42', filename: 'old.mp4' },
      { link: 'https://t.me/example/42/', filename: 'new.mp4' }
    ]);

    expect(map.get('t.me/example/42')).toBe('new.mp4');
  });

  it('uses the configured sheet GID instead of a stale saved range', () => {
    const sheets = [
      { properties: { sheetId: 0, title: 'parse' } },
      { properties: { sheetId: 1651996986, title: 'pre-final' } }
    ];

    expect(resolveSheetRangeByGid(sheets, '0', 'pre!A:K')).toBe("'parse'!A:K");
  });

  it('updates parse mappings from the latest CSV rows and fills pre-final column H by link', () => {
    const plan = buildTelegramSheetSyncPlan(
      [
        ['tg_link', 'tg_file_name'],
        ['https://t.me/example/1', 'old.mp4'],
        ['https://t.me/example/2', 'same.mp4']
      ],
      [
        ['link'],
        ['https://t.me/example/1'],
        ['https://t.me/example/2/'],
        ['https://t.me/example/3']
      ],
      [
        { link: 'https://t.me/example/1', filename: 'older.mp4' },
        { link: 'https://t.me/example/1/', filename: 'latest.mp4' },
        { link: 'https://t.me/example/3', filename: 'new.mp4' }
      ]
    );

    expect(plan).toEqual({
      parseUpdates: [{ rowIndex: 2, filename: 'latest.mp4' }],
      parseAppends: [['https://t.me/example/3', 'new.mp4']],
      preFinalNames: [['latest.mp4'], ['same.mp4'], ['new.mp4']]
    });
  });

  it('leaves a pre-final filename blank when no link match exists', () => {
    const plan = buildTelegramSheetSyncPlan(
      [['link', 'tg_file_name']],
      [['link'], ['https://t.me/example/missing']],
      []
    );

    expect(plan.preFinalNames).toEqual([['']]);
  });
});
