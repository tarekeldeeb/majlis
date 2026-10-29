#!/usr/bin/env python3
"""Punctuation-aware chunking and gap-free concatenation for SILMA.

SILMA's internal multi-chunk path inserts 0.5-1.3 s of silence between chunks.
For long Arabic verses that sounds like repeated annoying pauses. This module
splits text at punctuation/clause boundaries, keeps long narrator chains from
being generated as one fragile chunk, and joins the waves with a short
equal-power crossfade and no inserted silence. `synthesize_items` adds explicit
pauses between bullet items.
"""

import re

import numpy as np

# SILMA's internal fast_trim uses top_db=40 (1% of peak) and can cut quiet
# onsets such as the "ال" in "الآداب". Trim less aggressively; our own
# _trim_silence below keeps an explicit onset margin.
try:
    import silma_tts.infer.utils_infer as _ui

    _orig_fast_trim = _ui.fast_trim

    def _fast_trim_gentle(wave, top_db=60, dont_trim_end=False):
        return _orig_fast_trim(wave, top_db=60, dont_trim_end=dont_trim_end)

    _ui.fast_trim = _fast_trim_gentle
except Exception:
    pass

SENTENCE_END = re.compile(r"(?<=[.!؟؛:])\s+")
COMMA = re.compile(r"(?<=[،])\s+")
CONJUNCTION = re.compile(
    r"\s+(?=(?:وَ|فَ|ثُمَّ|لَكِنَّ|بَلْ|أَمَّا|إِنَّ|لِأَنَّ|حَتَّى|إِذَا|لَمَّا|حَيْثُ)\b)"
)
IBN = re.compile(r"\s+(?=(?:بن|بنُ|بِن|بْن)\s)")
LETTER = re.compile(r"[ء-ي]")


def _hard_split(part: str, max_chars: int):
    out = []
    connectors = {"بن", "بنُ", "بْن", "بِن", "ابن", "أبو", "أبي", "عبد"}
    while len(part) > max_chars:
        cut = part.rfind(" ", 0, max_chars)
        if cut < max_chars // 2:
            cut = max_chars
        # Do not strand a connector such as "بن" at the end of a chunk.
        prev_word = part[:cut].rsplit(" ", 1)[-1]
        if prev_word in connectors:
            previous = part.rfind(" ", 0, cut)
            if previous > max_chars // 2:
                cut = previous
        out.append(part[:cut].strip())
        part = part[cut:].strip()
    if part:
        out.append(part)
    return out


def _merge_short(pieces, max_chars: int, min_chars: int = 60):
    """Merge tiny clauses so each TTS call has enough context."""
    out = []
    buf = ""
    for piece in pieces:
        piece = piece.strip()
        if not piece:
            continue
        if not buf:
            buf = piece
            continue
        fits = len(buf) + 1 + len(piece) <= max_chars
        keep_sentence_break = bool(re.search(r"[.!؟؛:]$", buf)) and len(buf) >= min_chars
        if fits and (len(buf) < min_chars or not keep_sentence_break):
            buf += " " + piece
        else:
            out.append(buf)
            buf = piece
    if buf:
        out.append(buf)
    return out


def _split_name_chain(part: str, max_chars: int):
    """Split a long narrator chain before 'بن' without stranding the connector."""
    groups = IBN.split(part)
    if len(groups) <= 1:
        return _hard_split(part, max_chars)
    out = []
    buf = groups[0]
    for group in groups[1:]:
        if len(buf) + 1 + len(group) <= max_chars:
            buf += " " + group
        else:
            out.append(buf)
            buf = group
    if buf:
        out.append(buf)
    return out


def split_text(text: str, max_chars: int = 180):
    """Split at sentence ends, then commas, then conjunctions, then spaces."""
    text = re.sub(r"\s+", " ", text).strip()
    if not text:
        return []
    chunks = []
    for sentence in SENTENCE_END.split(text):
        sentence = sentence.strip()
        if not sentence:
            continue
        if len(sentence) <= max_chars:
            chunks.append(sentence)
            continue
        for clause in COMMA.split(sentence):
            clause = clause.strip()
            if not clause:
                continue
            if len(clause) <= max_chars:
                chunks.append(clause)
                continue
            for piece in CONJUNCTION.split(clause):
                piece = piece.strip()
                if not piece:
                    continue
                chunks.extend(_hard_split(piece, max_chars) if len(piece) > max_chars else [piece])
    merged = _merge_short(chunks, max_chars)
    out = []
    for chunk in merged:
        if IBN.search(chunk) and len(chunk) > 140:
            out.extend(_split_name_chain(chunk, 120))
        else:
            out.append(chunk)
    # Punctuation left alone, like the ". ." after a stripped citation, has nothing
    # to read; sending it to SILMA only risks a stray sound at the end of the clip.
    return [chunk for chunk in out if LETTER.search(chunk)]


def _trim_silence(wave, sample_rate: int, keep_start: float = 0.15, keep_end: float = 0.12):
    """Trim model-generated leading/trailing silence, keeping a safe onset margin."""
    peak = float(np.max(np.abs(wave))) if len(wave) else 0.0
    if peak <= 0:
        return wave
    threshold = max(1e-5, peak * 0.002)
    loud = np.where(np.abs(wave) > threshold)[0]
    if len(loud) == 0:
        return wave
    start = max(0, int(loud[0] - keep_start * sample_rate))
    end = min(len(wave), int(loud[-1] + keep_end * sample_rate))
    return wave[start:end]


def _edge_fade(wave, sample_rate: int, seconds: float = 0.008):
    """Fade each chunk's own edges so vocoder cut-offs cannot click."""
    n = int(seconds * sample_rate)
    if n <= 1 or len(wave) <= 2 * n:
        return wave
    out = wave.copy()
    out[:n] *= np.linspace(0.0, 1.0, n, dtype=out.dtype)
    out[-n:] *= np.linspace(1.0, 0.0, n, dtype=out.dtype)
    return out


def crossfade_concat(waves, sample_rate: int, fade_seconds: float = 0.08):
    """Join waves with an equal-power crossfade, without inserted silence."""
    if not waves:
        raise ValueError("no waves to concatenate")
    waves = [_edge_fade(wave, sample_rate) for wave in waves]
    if len(waves) == 1:
        out = waves[0]
    else:
        fade_samples = max(1, int(fade_seconds * sample_rate))
        out = waves[0]
        for nxt in waves[1:]:
            n = min(fade_samples, len(out), len(nxt))
            if n <= 0:
                out = np.concatenate([out, nxt])
                continue
            # cos/sin keep the summed power constant across the overlap.
            t = np.linspace(0.0, np.pi / 2, n)
            fade_out = np.cos(t)
            fade_in = np.sin(t)
            overlap = out[-n:] * fade_out + nxt[:n] * fade_in
            out = np.concatenate([out[:-n], overlap, nxt[n:]])
    peak = float(np.max(np.abs(out))) if len(out) else 0.0
    if peak > 0.98:
        out = out * (0.98 / peak)
    return out.astype(np.float32, copy=False)


def synthesize(tts, ref_audio: str, ref_text: str, text: str, nfe_step: int,
               speed: float, max_chars: int = 180, fade_seconds: float = 0.08,
               keep_start: float = 0.15, sentence_keep_end: float = 0.25,
               lead_in: float = 0.0, check=None, attempts: int = 1, report=None):
    """Synthesize text chunk-by-chunk without SILMA's inter-chunk pauses.

    With `check(chunk, wave, sample_rate)` (a 0-1 score, e.g. stt_check.SttCheck),
    a chunk scoring under 0.5 is generated again, up to `attempts` times, and the
    best take is kept; each chunk's best score is appended to `report`.
    """
    chunks = split_text(text, max_chars=max_chars)
    waves = []
    sample_rate = None
    for chunk in chunks:
        best = None
        for attempt in range(1, (attempts if check else 1) + 1):
            wav, sr, _ = tts.infer(
                ref_file=str(ref_audio),
                ref_text=ref_text,
                gen_text=chunk,
                cross_fade_duration=0,
                nfe_step=nfe_step,
                speed=speed,
                normalize_numbers=False,
                force_tashkeel=False,
            )
            sample_rate = sr
            keep_end = sentence_keep_end if chunk.rstrip().endswith((".", "!", "؟", "؛", ":")) else 0.10
            wav = _trim_silence(wav, sr, keep_start=keep_start, keep_end=keep_end)
            score = check(chunk, wav, sr) if check else 1.0
            if best is None or score > best[0]:
                best = (score, wav, attempt)
            if score >= 0.5:
                break
        waves.append(best[1])
        if report is not None:
            report.append({"chunk": chunk, "score": round(best[0], 2), "attempts": attempt})
    out = crossfade_concat(waves, sample_rate, fade_seconds)
    if lead_in > 0:
        out = np.concatenate([
            np.zeros(int(lead_in * sample_rate), dtype=out.dtype),
            out,
        ])
    return out, sample_rate


def join_with_pauses(waves, sample_rate: int, pause_seconds: float = 0.4):
    """Join whole bullet clips with an explicit silence between them."""
    if not waves:
        raise ValueError("no waves to concatenate")
    out = waves[0]
    silence = np.zeros(int(pause_seconds * sample_rate), dtype=out.dtype)
    for wave in waves[1:]:
        out = np.concatenate([out, silence, wave])
    peak = float(np.max(np.abs(out))) if len(out) else 0.0
    if peak > 0.98:
        out = out * (0.98 / peak)
    return out.astype(np.float32, copy=False)


def synthesize_items(tts, ref_audio: str, ref_text: str, items, nfe_step: int,
                     speed: float, max_chars: int = 180, fade_seconds: float = 0.08,
                     pause_seconds: float = 0.4, check=None, attempts: int = 1, report=None):
    """Synthesize bullet items independently with a clear pause between them."""
    waves = []
    sample_rate = None
    for item in items:
        if not item or not item.strip():
            continue
        wav, sr = synthesize(
            tts,
            ref_audio,
            ref_text,
            item,
            nfe_step,
            speed,
            max_chars=max_chars,
            fade_seconds=fade_seconds,
            keep_start=0.15,
            sentence_keep_end=0.12,
            check=check,
            attempts=attempts,
            report=report,
        )
        sample_rate = sr
        waves.append(wav)
    if not waves:
        raise ValueError("no commentary items to synthesize")
    return join_with_pauses(waves, sample_rate, pause_seconds), sample_rate
