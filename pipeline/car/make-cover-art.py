#!/usr/bin/env python3
"""Compose per-hadith cover art for car head units.

Renders the hadith matn with Pango (HarfBuzz shaping, so Arabic joins and
diacritics are correct) over the shared car background, fading the bottom of
any text that overflows the frame.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageChops

SIZE = 1024
MARGIN_X = 110
MARGIN_TOP = 90
MARGIN_BOTTOM = 90
FADE_PX = 150
INK = "#1C1917"


def render_text(text: str, workdir: Path, width: int, size: int, font: str) -> Image.Image:
    src = workdir / "matn.txt"
    dst = workdir / "matn.png"
    src.write_text(text, encoding="utf-8")
    subprocess.run(
        [
            "pango-view",
            "-q",
            "--pixels",
            f"--font={font} {size}",
            f"--foreground={INK}",
            "--background=transparent",
            f"--width={width}",
            "--wrap=word",
            "--rtl",
            "--language=ar",
            "--align=right",
            "--margin=0",
            "-o",
            str(dst),
            str(src),
        ],
        check=True,
    )
    return Image.open(dst).convert("RGBA")


def fade_bottom(layer: Image.Image, box_height: int) -> Image.Image:
    if layer.height <= box_height:
        return layer

    layer = layer.crop((0, 0, layer.width, box_height))
    ramp = Image.new("L", (1, box_height), 255)
    px = ramp.load()
    fade_start = box_height - FADE_PX
    for y in range(fade_start, box_height):
        px[0, y] = int(255 * (1.0 - (y - fade_start) / FADE_PX))
    mask = ramp.resize(layer.size, Image.BILINEAR)
    layer.putalpha(ImageChops.multiply(layer.getchannel("A"), mask))
    return layer


def compose(background: Image.Image, layer: Image.Image, box_height: int) -> Image.Image:
    canvas = background.convert("RGB").copy()
    x = (SIZE - layer.width) // 2
    y = (SIZE - layer.height) // 2
    y = max(MARGIN_TOP, min(y, MARGIN_TOP + box_height - layer.height))
    canvas.paste(layer, (x, y), layer)
    return canvas


def main() -> int:
    root = Path(__file__).resolve().parents[2]
    parser = argparse.ArgumentParser()
    parser.add_argument("--size", type=int, default=24, help="font size in pixels")
    parser.add_argument("--font", default="Amiri")
    parser.add_argument("--only", nargs="*", help="hadith numbers, e.g. 1 42")
    parser.add_argument("--book", type=Path, default=root / "content/books/nawawi40")
    parser.add_argument(
        "--background", type=Path, default=root / "content/audio/car/art-background.jpg"
    )
    parser.add_argument("--out", type=Path, default=root / "content/audio/nawawi40")
    args = parser.parse_args()

    background = Image.open(args.background)
    if background.size != (SIZE, SIZE):
        sys.exit(f"background is {background.size}, expected {SIZE}x{SIZE}")

    width = SIZE - 2 * MARGIN_X
    box_height = SIZE - MARGIN_TOP - MARGIN_BOTTOM

    files = sorted((args.book / "hadith").glob("*.json"))
    if args.only:
        wanted = {int(n) for n in args.only}
        files = [f for f in files if int(f.stem) in wanted]
    if not files:
        sys.exit("no hadith files matched")

    args.out.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        workdir = Path(tmp)
        for path in files:
            matn = json.loads(path.read_text(encoding="utf-8"))["matn"]["arabic"]
            layer = fade_bottom(render_text(matn, workdir, width, args.size, args.font), box_height)
            compose(background, layer, box_height).save(
                args.out / f"{path.stem}-cover.jpg", quality=92, optimize=True
            )
            print(f"{path.stem}-cover.jpg  text {layer.size[0]}x{layer.size[1]}")

    print(f"wrote {len(files)} covers to {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
