# TTS reference voices

Majlis uses two voices: the **matn** is read in the male ClArTTS voice, and the
**commentary** (ādāb / fawāʾid / meaning) in SILMA's bundled female voice.
`generate_audio.py` uses these by default; override either with
`--matn-ref-*` / `--comm-ref-*`.

## `clartts107` — male matn reference

- **Source:** ClArTTS — Classical Arabic Text-to-Speech corpus (MBZUAI)
- **Dataset:** https://huggingface.co/datasets/MBZUAI/ClArTTS
- **Clip:** `ch_05_arabic_tts_dataset_177.wav` (row 107), 4.64 s, 40,100 Hz
- **Speaker:** single male speaker (LibriVox audiobook source)
- **License:** CC-BY-4.0 — https://creativecommons.org/licenses/by/4.0/
- **Attribution:** Kulkarni et al., *ClArTTS: An Open-Source Classical Arabic
  Text-to-Speech Corpus*, Interspeech 2023.
- **Changes:** extracted from the dataset and re-encoded as 16-bit PCM WAV.

Transcript:

> أَنَّ النَّبِيَّ صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ قَالَ شَرُّ مَا أُعْطِيَ الْعَبْدُ

## `silma-default-female` — female commentary reference

- **Source:** SILMA TTS v1 bundled reference sample
  (`silma_tts/infer/ref_audio_samples/ar.ref.24k.wav`)
- **License:** Apache-2.0 (SILMA TTS v1)
- **Used for:** commentary only (ādāb, fawāʾid, meaning).

Transcript:

> ويدقق النظر في القرآن الكريم وسائر الكتب السماوية ويتبع مسالك الرسل العظام عليهم الصلاة والسلام.

Both clips are build-time conditioning material for SILMA; they are not shipped
in the app. ClArTTS requires attribution in distributed builds. Voice-likeness
rights are separate from copyright; confirm them before a public release.
