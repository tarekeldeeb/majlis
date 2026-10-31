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
  fully diacritized for reading aloud and corrected where the source or the diacritizer was
  wrong (listed below). The commentary was drafted with an LLM grounded in
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

## Corrections to the source text

The source text is kept verbatim (`matn.arabic` in the repository) and never changed. What is
read aloud, and shown in the app, is the reading text `matn.diacritized`: the source fully
diacritized, then corrected where the source or the machine diacritizer was wrong. Every
correction, with its hadith and the text before and after, is in
[`content/books/riyad_assalihin/reading-text-fixes.json`](https://github.com/tarekeldeeb/majlis/blob/main/content/books/riyad_assalihin/reading-text-fixes.json):
3,026 corrections in 1,851 hadiths, made (and reproducible from the uncorrected text) by
[`pipeline/diacritize/fix_reading_text.py`](https://github.com/tarekeldeeb/majlis/blob/main/pipeline/diacritize/fix_reading_text.py).

| Correction | Count | Example |
|---|---:|---|
| A full stop before the closing citation, which is not part of the hadith | 1,739 | «الْإِيمَانِ. ((مُتَّفَقٌ عَلَيْهِ))» |
| A final ya the source writes dotless («ى»), which the narrator read as «ā», written «ي» | 496 | «يَأْتِى» → «يَأْتِي» |
| «رَضِيَ اللَّهُ», not «رَضِيَ اللَّهِ» | 446 | |
| Words reviewed in context: a ya-word given a fatha, an active verb read as passive, or a wrong case beside them | 134 | «فَاتَّقَى اللَّهَ وَاصْبَرَى» → «فَاتَّقِي اللَّهَ وَاصْبِرِي» |
| «عَنِ ابْنِ», not «عَنْ ابْنُ» | 68 | |
| The kunya «أَبِي» the source writes «أبى», read as the verb «أَبَى» | 37 | «عَنْ أَبَى هُرَيْرَةَ» → «عَنْ أَبِي هُرَيْرَةَ» |
| «رَضِيَ اللَّهُ» the source writes «رضى», read as the noun «رِضًى اللَّهِ» | 31 | |
| The source repeats half the honorific, «وسلمى الله عليه وسلم»; read «وَسَلَّمَ» | 27 | |
| Words misspelt in the source: «حتي»، «إلىس»، «امراتى» | 18 | «حُتِّي» → «حَتَّى» |
| «حَتَّى» and «عَلَى» given another word's marks | 13 | «حَتّى» → «حَتَّى» |
| Allah as the subject: «قَالَ اللَّهُ»، «يَقُولُ اللَّهُ»، «رَحِمَهُ اللَّهُ» | 8 | |
| «عَزَّ وَجَلَّ», not «عِزٌّ وَجَلَّ» | 6 | |
| «ظَنِّ عَبْدِي», not «ظُنَّ عَبْدِي» | 2 | |
| «صَلَّى اللَّهُ», not «صَلَّى اللَّهِ» | 1 | |

Other slips of the machine diacritization remain; they await the scholarly review.

## License

The Waqf General Public License 2.0 (رخصة وقف العامّة): see
[LICENSE](https://github.com/tarekeldeeb/majlis/blob/main/LICENSE) (Arabic, authoritative)
and [LICENSE-en](https://github.com/tarekeldeeb/majlis/blob/main/LICENSE-en). The voices'
source corpora are CC-BY-4.0 and are credited above.
