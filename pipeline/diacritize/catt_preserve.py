"""Helpers for CATT diacritization that preserve punctuation, ﷺ, and spacing."""

import re

DIACRITICS = re.compile(r"[ً-ْٰـ]")


def strip_diacritics(text):
    return DIACRITICS.sub("", text)


def split_runs(text):
    """Split into [Arabic run, separator, Arabic run, ...]."""
    return re.split(r"([^ء-ي]+)", text)


def chunk_run(run, max_chars=600):
    """Split a long Arabic run at word boundaries."""
    if len(run) <= max_chars:
        return [run]
    chunks, buf = [], ""
    for word in run.split():
        if len(buf) + len(word) + 1 <= max_chars:
            buf = f"{buf} {word}".strip()
        else:
            if buf:
                chunks.append(buf)
            buf = word
    if buf:
        chunks.append(buf)
    return chunks


def collect(texts, max_chars=600):
    """Return (jobs, plan) where jobs are CATT inputs and plan allows rebuilding."""
    jobs, plan = [], []
    for ti, text in enumerate(texts):
        parts = split_runs(strip_diacritics(text))
        entry = {"parts": parts, "runs": {}}
        for pi in range(0, len(parts), 2):
            run = parts[pi]
            if not run:
                continue
            chunks = chunk_run(run, max_chars)
            entry["runs"][pi] = [(len(jobs) + k, chunk) for k, chunk in enumerate(chunks)]
            jobs.extend(chunks)
        plan.append(entry)
    return jobs, plan


def rebuild(plan, outputs, text_index):
    """Rebuild one text from its plan and the CATT outputs."""
    entry = plan[text_index]
    parts = list(entry["parts"])
    for pi, chunk_refs in entry["runs"].items():
        parts[pi] = " ".join(outputs[job_idx] for job_idx, _ in chunk_refs)
    return "".join(parts).strip()
