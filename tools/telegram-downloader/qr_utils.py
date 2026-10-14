def qr_box_size(matrix_size: int, display_size: int = 320) -> int:
    """Choose an integer QR module size to avoid interpolation blur."""
    if matrix_size < 1 or display_size < 1:
        raise ValueError("QR matrix and display sizes must be positive")
    return max(3, display_size // matrix_size)
