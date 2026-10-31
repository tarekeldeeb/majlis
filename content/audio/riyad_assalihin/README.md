---
license: other
license_name: waqf-public-license
license_link: https://github.com/tarekeldeeb/majlis/blob/main/LICENSE-en
language:
- ar
pretty_name: Majlis — Riyad al-Salihin narration
tags:
- audio
- audiobook
- hadith
- arabic
- text-to-speech
size_categories:
- 10K<n<100K
viewer: false
---

# Majlis — Riyad al-Salihin narration (رياض الصالحين)

The narration of *Riyāḍ al-Ṣāliḥīn* by Imam al-Nawawī used by
[Majlis (مجلس)](https://github.com/tarekeldeeb/majlis), an open-source Arabic hadith
audiobook. Each of the book's 1,896 hadiths is read aloud, followed by its ādāb
(manners), fawāʾid (benefits) and overall meaning.

The Majlis apps ship the first 50 hadiths; the web app streams the rest from this
dataset, and the iOS and Android apps download it on demand.

## Files

| Path | Content |
|---|---|
| `NNNN-number.m4a` | The hadith's number, announced |
| `NNNN-matn.m4a` | The hadith text (matn) |
| `NNNN-adab.m4a` | Its ādāb |
| `NNNN-fawaid.m4a` | Its fawāʾid |
| `NNNN-meaning.m4a` | Its overall meaning |
| `covers/NNNN-cover.jpg` | Car artwork: the matn over the Majlis background, 1024×1024 |

`NNNN` is the hadith number in four digits (`0001`–`1896`). The text each clip reads is
in `content/books/riyad_assalihin/hadith/NNNN.json` in the Majlis repository.

Audio is HE-AAC v1, 32 kbps, mono, 24 kHz, in MP4 (`.m4a`) with its index at the front
for streaming. A clip can be fetched directly:

```
https://huggingface.co/datasets/quranquiznet/majlis-riyad_assalihin/resolve/main/0001-matn.m4a
```

## How it was made

- **Text.** The matn comes from [AhmedBaset/hadith-json](https://github.com/AhmedBaset/hadith-json),
  fully diacritized for reading aloud. The commentary was drafted with an LLM grounded in
  Ibn ʿUthaymīn's *Sharḥ Riyāḍ al-Ṣāliḥīn*. Tarek Eldeeb reviewed the corpus on 2026-10-23;
  a second scholarly review is pending.
- **Voices.** Generated with [SILMA TTS v1](https://huggingface.co/silma-ai/silma-tts)
  (Apache-2.0) by zero-shot voice cloning. The number and matn are read in a male voice
  from [ClArTTS](https://huggingface.co/datasets/MBZUAI/ClArTTS) (CC-BY-4.0; Kulkarni et al.,
  *ClArTTS: An Open-Source Classical Arabic Text-to-Speech Corpus*, Interspeech 2023), and
  the commentary in the male voice of the
  [Arabic Speech Corpus](https://huggingface.co/datasets/halabi2016/arabic_speech_corpus)
  (CC-BY-4.0; Nawar Halabi).
- **Checks.** Every chunk was transcribed with Whisper (`openai/whisper-base`) and generated
  again, up to four takes, when a word was missing.

## License

The Waqf General Public License 2.0 (رخصة وقف العامّة): see
[LICENSE](https://github.com/tarekeldeeb/majlis/blob/main/LICENSE) (Arabic, authoritative)
and [LICENSE-en](https://github.com/tarekeldeeb/majlis/blob/main/LICENSE-en). The voices'
source corpora are CC-BY-4.0 and are credited above.
