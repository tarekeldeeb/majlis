# TTS reference voices

Majlis uses two voices: the **matn and hadith number** are read in the male
ClArTTS voice, and the **commentary** (ādāb / fawāʾid / meaning) in the male
Arabic Speech Corpus voice. `generate_audio.py` uses these by default; override
either with `--matn-ref-*` / `--comm-ref-*`.

## `clartts107` — male matn/number reference

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

## `arabic-speech-corpus-male` — male commentary reference

- **Source:** Arabic Speech Corpus (Nawar Halabi), Modern Standard Arabic with a
  Damascene accent, single male speaker
- **Dataset:** https://huggingface.co/datasets/halabi2016/arabic_speech_corpus
  (mirrored as `tunis-ai/arabic_speech_corpus`)
- **Clip:** `ARA NORM 0013.wav` (row 11), 7.62 s
- **License:** CC-BY-4.0 — https://creativecommons.org/licenses/by/4.0/
- **Attribution:** Nawar Halabi, *Modern Standard Arabic phonetics for speech
  synthesis* (PhD thesis, University of Southampton).
- **Changes:** transcript converted from the corpus's Buckwalter encoding to
  Arabic script; audio re-encoded as 16-bit PCM WAV.

Transcript:

> لِيَتَمَكَّنَ الْقَارِئُ مِنْ مُتَابَعَةِ تَطَوُّرِ الْقِصَّةِ الْخَبَرِيَّةِ بِشَكْلٍ سَلِسٍ وَفَعَّالٍ

## `silma-default-female` — legacy/control reference

- **Source:** SILMA TTS v1 bundled reference sample
  (`silma_tts/infer/ref_audio_samples/ar.ref.24k.wav`)
- **License:** Apache-2.0 (SILMA TTS v1)
- **Used for:** A/B comparison only; no longer the commentary default.

Transcript:

> ويدقق النظر في القرآن الكريم وسائر الكتب السماوية ويتبع مسالك الرسل العظام عليهم الصلاة والسلام.

All clips are build-time conditioning material for SILMA; they are not shipped
in the app. ClArTTS and the Arabic Speech Corpus require attribution in
distributed builds. Voice-likeness rights are separate from copyright; confirm
them before a public release.
