import { describe, expect, it } from 'vitest';
import {
  buildClipchampExportCommand,
  buildLinksMapCsv,
  extractDriveFolderId,
  formatClipchampFolderName
} from './clipchampExport';

describe('Clipchamp Drive export', () => {
  it('extracts the folder id from a Google Drive URL', () => {
    expect(
      extractDriveFolderId(
        'https://drive.google.com/drive/folders/1_bNIOZBZfbHQU9oEC2e_5Xqu5lSC4D2H?usp=sharing'
      )
    ).toBe('1_bNIOZBZfbHQU9oEC2e_5Xqu5lSC4D2H');
  });

  it('creates a stable dated folder name', () => {
    expect(formatClipchampFolderName(new Date(2026, 5, 29, 16, 7, 9), 'Clipchamp GR')).toBe(
      'Clipchamp_GR_2026-06-29_16-07-09'
    );
  });

  it('writes a compatible links map', () => {
    expect(
      buildLinksMapCsv([{ link: 'https://t.me/example/1', filename: 'video_crop_analog.mp4' }])
    ).toBe('link,filename\nhttps://t.me/example/1,video_crop_analog.mp4\n');
  });

  it('builds one upload command rooted at the provided Drive folder', () => {
    const command = buildClipchampExportCommand({
      localDir: '.clipchamp_exports/session',
      remoteName: 'lqd-kotyk-helper',
      rootFolderId: 'folder-id',
      folderName: 'Clipchamp_2026-06-29_16-07-09',
      processingLines: ['ffmpeg test'],
      linksRows: [{ link: 'https://t.me/example/1', filename: 'video.mp4' }],
      manifest: { files: [{ filename: 'video.mp4' }] }
    });

    expect(command).toContain('ffmpeg test');
    expect(command).toContain('links_map.csv');
    expect(command).toContain('export_manifest.json');
    expect(command).toContain("'lqd-kotyk-helper:Clipchamp_2026-06-29_16-07-09'");
    expect(command).toContain("--drive-root-folder-id 'folder-id'");
  });

  it('builds a local-only export without requiring or invoking rclone', () => {
    const command = buildClipchampExportCommand({
      localDir: 'Clipchamp_exports/session',
      folderName: 'session',
      uploadToDrive: false,
      processingLines: ['ffmpeg test'],
      linksRows: [{ link: '', filename: 'video.mp4' }],
      manifest: { files: [{ filename: 'video.mp4' }] }
    });

    expect(command).toContain("mkdir -p 'Clipchamp_exports/session'");
    expect(command).toContain('ffmpeg test');
    expect(command).toContain('CLIPCHAMP_EXPORT_DONE');
    expect(command).not.toContain('rclone');
  });
});
