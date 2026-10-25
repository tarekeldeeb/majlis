#!/usr/bin/env python3
"""Build the media index the car integrations browse.

One JSON document listing every hadith with its artwork, shared thumbnail and
per-segment durations, so Android Auto and CarPlay can answer browsing and
now-playing queries without a screen or a React instance.
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

BOOK_ID = 'nawawi40'
THUMBNAIL = 'car/thumbnail.jpg'
SEGMENT_ORDER = ['number', 'matn', 'adab', 'fawaid', 'meaning']


def load_ordinals(theme_path: Path) -> dict[int, str]:
    """Reuse the app's Arabic ordinals so the car and the UI name hadiths alike."""
    source = theme_path.read_text(encoding='utf-8')
    block = source.split('formatHadithTitle', 1)[1]
    return {int(n): title for n, title in re.findall(r"(\d+):\s*'([^']+)'", block)}


def duration(path: Path) -> float:
    out = subprocess.run(
        ['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
         '-of', 'default=nw=1:nk=1', str(path)],
        check=True, capture_output=True, text=True,
    ).stdout.strip()
    return round(float(out), 2)


def main() -> int:
    root = Path(__file__).resolve().parents[2]
    content = root / 'content'
    audio_dir = content / 'audio'
    book_dir = content / 'books' / BOOK_ID

    book = json.loads((book_dir / 'book.json').read_text(encoding='utf-8'))
    ordinals = load_ordinals(root / 'app/src/constants/theme.ts')

    hadiths = []
    missing = []
    for path in sorted((book_dir / 'hadith').glob('*.json')):
        data = json.loads(path.read_text(encoding='utf-8'))
        number = data['number']
        artwork = audio_dir / BOOK_ID / f'{path.stem}-cover.jpg'
        if not artwork.exists():
            missing.append(str(artwork.relative_to(root)))

        segments = []
        for kind in SEGMENT_ORDER:
            rel = data['audio'].get(kind)
            if not rel:
                continue
            file = audio_dir / rel
            if not file.exists():
                missing.append(rel)
                continue
            segments.append({'kind': kind, 'path': rel, 'duration': duration(file)})

        hadiths.append({
            'number': number,
            'title': ordinals.get(number, f'الحديث {number}'),
            'subtitle': book['title'],
            'artwork': f'{BOOK_ID}/{path.stem}-cover.jpg',
            'thumbnail': THUMBNAIL,
            'duration': round(sum(s['duration'] for s in segments), 2),
            'segments': segments,
        })

    if missing:
        print('missing assets:', *missing, sep='\n  ', file=sys.stderr)

    index = {
        'version': 1,
        'generatedAt': datetime.now(timezone.utc).isoformat(timespec='seconds'),
        'book': {'id': BOOK_ID, 'title': book['title'], 'author': book['author']},
        'thumbnail': THUMBNAIL,
        'hadiths': hadiths,
    }

    out = audio_dir / 'car' / 'media-index.json'
    out.write_text(json.dumps(index, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    total = sum(h['duration'] for h in hadiths)
    print(f'{len(hadiths)} hadiths, {sum(len(h["segments"]) for h in hadiths)} segments')
    print(f'total audio {total/3600:.2f} h -> {out.relative_to(root)}')
    return 1 if missing else 0


if __name__ == '__main__':
    raise SystemExit(main())
