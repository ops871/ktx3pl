#!/usr/bin/env python3
# ============================================================
#  KTX 3PL Warehouse Tracker - PWA icon generator
#  ------------------------------------------------------------
#  Generates icon-192.png and icon-512.png using ONLY the
#  Python standard library (zlib + struct), because this
#  machine has no image tooling (no Pillow / cairosvg /
#  ImageMagick / rsvg-convert, and sips can't rasterize SVG).
#
#  The icon is a maskable square: navy field, a maroon accent
#  ring, and a white Texas star centered in the safe zone.
#  Replace these with real KTX 3PL exports any time (see README).
# ============================================================
import math
import struct
import zlib

# Brand palette (RGB)
NAVY = (26, 36, 86)      # #1a2456  background
MAROON = (122, 31, 43)   # #7a1f2b  accent ring
STAR = (255, 255, 255)   # white    Texas star


def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def point_in_star(px, py, cx, cy, r_out, r_in, points=5, rot=-math.pi / 2):
    """Even-odd test for a regular star polygon."""
    verts = []
    for i in range(points * 2):
        r = r_out if i % 2 == 0 else r_in
        a = rot + i * math.pi / points
        verts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    inside = False
    j = len(verts) - 1
    for i in range(len(verts)):
        xi, yi = verts[i]
        xj, yj = verts[j]
        if ((yi > py) != (yj > py)) and (
            px < (xj - xi) * (py - yi) / (yj - yi + 1e-9) + xi
        ):
            inside = not inside
        j = i
    return inside


def make_icon(size):
    cx = cy = (size - 1) / 2.0
    # Maskable safe zone: keep art within the central ~80%.
    ring_outer = size * 0.40
    ring_inner = size * 0.345
    star_out = size * 0.30
    star_in = star_out * 0.40
    aa = 1.5  # antialias falloff in px

    rows = []
    for y in range(size):
        row = bytearray()
        for x in range(size):
            r, g, b = NAVY
            dx = x - cx
            dy = y - cy
            dist = math.hypot(dx, dy)

            # Maroon accent ring (soft edges).
            ring_t = 0.0
            if ring_inner - aa <= dist <= ring_outer + aa:
                inner_edge = min(max((dist - (ring_inner - aa)) / (2 * aa), 0), 1)
                outer_edge = min(max(((ring_outer + aa) - dist) / (2 * aa), 0), 1)
                ring_t = min(inner_edge, outer_edge)
            if ring_t > 0:
                r, g, b = lerp((r, g, b), MAROON, ring_t)

            # White Texas star (supersampled for clean edges).
            hits = 0
            for ox, oy in ((0.25, 0.25), (0.75, 0.25), (0.25, 0.75), (0.75, 0.75)):
                if point_in_star(x + ox, y + oy, cx, cy, star_out, star_in):
                    hits += 1
            if hits:
                r, g, b = lerp((r, g, b), STAR, hits / 4.0)

            row += bytes((r, g, b))
        rows.append(row)
    return rows


def write_png(path, rows):
    size = len(rows)
    raw = bytearray()
    for row in rows:
        raw.append(0)  # filter type 0 (none)
        raw += row

    def chunk(tag, data):
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)  # 8-bit RGB
    idat = zlib.compress(bytes(raw), 9)
    with open(path, "wb") as f:
        f.write(sig)
        f.write(chunk(b"IHDR", ihdr))
        f.write(chunk(b"IDAT", idat))
        f.write(chunk(b"IEND", b""))


if __name__ == "__main__":
    import os

    here = os.path.dirname(os.path.abspath(__file__))
    for s in (192, 512):
        out = os.path.join(here, f"icon-{s}.png")
        write_png(out, make_icon(s))
        print(f"wrote {out}")
