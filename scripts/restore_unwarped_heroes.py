#!/usr/bin/env python3
"""Restore undistorted AL hero art from original sources, retouch navigation pixels only.

NEVER use cv2.remap or alter the geometry of artwork. The original image pixels from
row 58 onward, including every face, sign, shelf, and object, remain unchanged.
"""
from pathlib import Path
import json
import cv2
import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
CONFIG = {
    "hunt": ("assets/treasure-hunt.jpg", "assets/treasure-hunt-navfree-fixed.jpg", .410, .648, 56),
    "fresh": ("assets/fresh-finds.jpg", "assets/fresh-finds-navfree-fixed.jpg", .402, .643, 56),
    "apothecary": ("rachaels-apothecary.jpg", "assets/rachaels-apothecary-navfree-fixed.jpg", .420, .655, 57),
    "underground": ("assets/autumns-underground.jpg", "assets/autumns-underground-navfree-fixed.jpg", .410, .645, 56),
    "journal": ("assets/treasure-journal.jpg", "assets/treasure-journal-navfree-fixed.jpg", .408, .648, 33),
}

def repair(src, left_end, right_start, header_height):
    h, w = src.shape[:2]
    if h < 450 or w < 800:
        raise ValueError(f"Unexpectedly small source artwork: {w} x {h}")
    mask = np.zeros((h, w), dtype=np.uint8)
    mask[:header_height, :round(w * left_end)] = 255
    mask[:header_height, round(w * right_start):] = 255

    # Fill only the pixels containing baked-in navigation. No resampling, remapping,
    # stretching, scaling, shifting, or repainting of the rest of the artwork.
    out = cv2.inpaint(src, mask, 5, cv2.INPAINT_TELEA)
    assert np.array_equal(src[header_height:], out[header_height:]), "Art below header was altered"
    assert np.array_equal(src[:, round(w * .45):round(w * .59)], out[:, round(w * .45):round(w * .59)]), "Genie logo was altered"
    return out, mask

def main():
    review = ROOT / "artifacts" / "unwarped-review"
    review.mkdir(parents=True, exist_ok=True)
    report = []
    sheet = Image.new("RGB", (1600, 3 * 510), "#0b201e")
    pen = ImageDraw.Draw(sheet)
    for i, (name, (src_path, dest_path, left, right, header)) in enumerate(CONFIG.items()):
        original = cv2.imread(str(ROOT / src_path), cv2.IMREAD_COLOR)
        if original is None:
            raise FileNotFoundError(src_path)
        fixed, mask = repair(original, left, right, header)
        dest = ROOT / dest_path
        dest.parent.mkdir(parents=True, exist_ok=True)
        if not cv2.imwrite(str(dest), fixed, [cv2.IMWRITE_JPEG_QUALITY, 94]):
            raise OSError(dest)
        readback = cv2.imread(str(dest), cv2.IMREAD_COLOR)
        if readback.shape != original.shape:
            raise AssertionError("Output dimensions changed")
        delta = float(np.abs(readback[header:].astype(np.int16) - original[header:].astype(np.int16)).mean())
        if delta >= 5.0:
            raise AssertionError(f"Image fidelity below header unexpectedly low: {name} {delta:.2f}")
        report.append({"room": name, "source": src_path, "output": dest_path,
                       "width": original.shape[1], "height": original.shape[0],
                       "retouched_rows": header, "geometry_below_header": "pixel-identical before JPEG export",
                       "decoded_mean_difference_below_header": round(delta, 3)})
        preview = Image.open(dest).convert("RGB")
        preview.thumbnail((760, 455), Image.Resampling.LANCZOS)
        x, y = (i % 2) * 800 + 18, (i // 2) * 510 + 36
        sheet.paste(preview, (x, y))
        pen.text((x, y - 23), name + " — restored source geometry", fill="#f5d7a3")
        print(f"RESTORED {name}: {dest_path}, {delta:.2f} pixel fidelity delta")
    sheet.save(review / "five-room-geometry-review.jpg", quality=90)
    (review / "audit.json").write_text(json.dumps(report, indent=2) + "\n")
    print("All five restored without moving characters, signs, logos or objects.")

if __name__ == "__main__":
    main()
