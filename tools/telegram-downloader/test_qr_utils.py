import unittest

from qr_utils import qr_box_size


class QRBoxSizeTests(unittest.TestCase):
    def test_qr_fits_display_without_fractional_module_scaling(self):
        self.assertEqual(qr_box_size(53), 6)

    def test_qr_keeps_a_readable_minimum_module_size_for_dense_codes(self):
        self.assertEqual(qr_box_size(120), 3)

    def test_qr_rejects_invalid_dimensions(self):
        with self.assertRaises(ValueError):
            qr_box_size(0)


if __name__ == "__main__":
    unittest.main()
