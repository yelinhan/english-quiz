#!/usr/bin/env python3
"""PWA 아이콘 생성 (stdlib만 사용) — 민트 배경 + 흰 말풍선 + 점 3개"""
import struct
import zlib
from pathlib import Path

MINT = (46, 196, 182)
WHITE = (255, 255, 255)
OUT_DIR = Path(__file__).resolve().parent.parent / "icons"


def write_png(path: Path, size: int, pixels: list):
    raw = b""
    for y in range(size):
        raw += b"\x00" + bytes(v for px in pixels[y] for v in px)

    def chunk(tag: bytes, data: bytes) -> bytes:
        return (struct.pack(">I", len(data)) + tag + data
                + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF))

    png = (b"\x89PNG\r\n\x1a\n"
           + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
           + chunk(b"IDAT", zlib.compress(raw, 9))
           + chunk(b"IEND", b""))
    path.write_bytes(png)


def make_icon(size: int, rounded: bool) -> list:
    s = size
    corner = s * 0.22
    cx, cy = s * 0.5, s * 0.46          # 말풍선 중심
    rx, ry = s * 0.30, s * 0.24          # 말풍선 타원 반경
    dot_r = s * 0.035
    dots = [(cx - s * 0.11, cy), (cx, cy), (cx + s * 0.11, cy)]
    # 꼬리 삼각형
    tail = [(cx - s * 0.05, cy + ry * 0.85), (cx + s * 0.13, cy + ry * 0.8),
            (cx + s * 0.02, cy + ry * 1.45)]

    def in_rounded_rect(x, y):
        if not rounded:
            return True
        px = min(max(x, corner), s - corner)
        py = min(max(y, corner), s - corner)
        return (x - px) ** 2 + (y - py) ** 2 <= corner ** 2 or (
            corner <= x <= s - corner or corner <= y <= s - corner)

    def in_ellipse(x, y):
        return ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1

    def in_tri(x, y):
        (x1, y1), (x2, y2), (x3, y3) = tail
        d1 = (x - x2) * (y1 - y2) - (x1 - x2) * (y - y2)
        d2 = (x - x3) * (y2 - y3) - (x2 - x3) * (y - y3)
        d3 = (x - x1) * (y3 - y1) - (x3 - x1) * (y - y1)
        neg = d1 < 0 or d2 < 0 or d3 < 0
        pos = d1 > 0 or d2 > 0 or d3 > 0
        return not (neg and pos)

    rows = []
    for y in range(s):
        row = []
        for x in range(s):
            if not in_rounded_rect(x + 0.5, y + 0.5):
                row.append((0, 0, 0, 0))
                continue
            color = MINT
            if in_ellipse(x, y) or in_tri(x, y):
                color = WHITE
                for dx, dy in dots:
                    if (x - dx) ** 2 + (y - dy) ** 2 <= dot_r ** 2:
                        color = MINT
                        break
            row.append((*color, 255))
        rows.append(row)
    return rows


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    write_png(OUT_DIR / "icon-192.png", 192, make_icon(192, rounded=True))
    write_png(OUT_DIR / "icon-512.png", 512, make_icon(512, rounded=True))
    write_png(OUT_DIR / "icon-maskable-512.png", 512, make_icon(512, rounded=False))
    print("✓ icons/icon-192.png, icon-512.png, icon-maskable-512.png 생성")


if __name__ == "__main__":
    main()
