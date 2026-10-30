"""Whisper check for TTS chunks: did every word of the text come out?

SILMA generates a chunk in one pass sized by its character count, and now and
then skips a short word wedged between punctuation («قَالَ: قُلْ: …»), leaving
a pause in its place. This transcribes each chunk with Whisper and scores it by
the weakest word: the share of that word's letters found, in order, in the
transcript. Measuring letters rather than words means Whisper fusing or
misspelling words ("قليف" for «قُلْ لِي فِي») does not count as missing; a
dropped word scores 0.
"""

import difflib
import re

import numpy as np
import torch
import torchaudio
from transformers import pipeline

MARKS = re.compile(r"[ؐ-ًؚ-ٰٟۖ-ۭـ]")
NON_LETTER = re.compile(r"[^ء-ي]")


def norm(word):
    """Bare letters, with hamza seats and final forms folded the way Whisper spells them."""
    w = MARKS.sub("", word)
    w = re.sub("[أإآٱ]", "ا", w).replace("ة", "ه").replace("ى", "ي").replace("ؤ", "و").replace("ئ", "ي")
    return NON_LETTER.sub("", w)


def word_coverage(text, heard):
    """Per word of `text`, the share of its letters that align, in order, with `heard`."""
    words = [norm(w) for w in text.split() if norm(w)]
    target = "".join(words)
    matcher = difflib.SequenceMatcher(None, target, "".join(norm(w) for w in heard.split()), autojunk=False)
    matched = np.zeros(len(target), bool)
    for a, _, n in matcher.get_matching_blocks():
        matched[a:a + n] = True
    coverage, pos = [], 0
    for w in words:
        coverage.append(float(matched[pos:pos + len(w)].mean()))
        pos += len(w)
    return coverage


class SttCheck:
    """Callable scorer for `synth.synthesize(check=...)`: 1.0 when every word is heard.

    `last_heard` keeps the latest transcript so callers can log what Whisper heard.
    """

    def __init__(self, model="openai/whisper-base"):
        # On an NVIDIA GPU Whisper runs there too, so it keeps up with SILMA.
        device = 0 if torch.cuda.is_available() else -1
        self.asr = pipeline("automatic-speech-recognition", model=model, device=device)
        self.last_heard = ""

    def __call__(self, text, wave, sample_rate):
        audio = torchaudio.functional.resample(torch.from_numpy(wave).float(), sample_rate, 16000).numpy()
        self.last_heard = self.asr({"raw": audio, "sampling_rate": 16000},
                                   generate_kwargs={"language": "arabic", "task": "transcribe"})["text"].strip()
        coverage = word_coverage(text, self.last_heard)
        return min(coverage) if coverage else 1.0
