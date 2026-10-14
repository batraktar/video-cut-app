import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from openpyxl import load_workbook
from telegram_batch_downloader_qr import append_xlsx_rows, qr_box_size


class QRBoxSizeTests(unittest.TestCase):
    def test_qr_fits_display_without_fractional_module_scaling(self):
        self.assertEqual(qr_box_size(53), 6)

    def test_qr_keeps_a_readable_minimum_module_size_for_dense_codes(self):
        self.assertEqual(qr_box_size(120), 3)

    def test_qr_rejects_invalid_dimensions(self):
        with self.assertRaises(ValueError):
            qr_box_size(0)

    def test_mapping_rows_are_appended_as_a_batch(self):
        with TemporaryDirectory() as temp_dir:
            path = Path(temp_dir) / "links_map.xlsx"
            append_xlsx_rows(path, [["now", "t.me/a/1", "downloaded", "a.mp4", ""]])
            append_xlsx_rows(path, [["later", "t.me/a/2", "downloaded", "b.mp4", ""]])

            workbook = load_workbook(path, read_only=True)
            rows = list(workbook.active.values)
            workbook.close()

        self.assertEqual(rows[0], ("timestamp", "link", "status", "filename", "detail"))
        self.assertEqual(len(rows), 3)
        self.assertEqual(rows[-1][1], "t.me/a/2")


if __name__ == "__main__":
    unittest.main()
