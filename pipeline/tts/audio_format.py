"""Narration clip format, shared by the generator and the audio tools.

HE-AAC v1 at 32 kbps, mono, 24 kHz: speech stays clear at a third of 96 kbps
MP3's size (Riyad's ~43 h fit in ~0.65 GB). ffmpeg's built-in aac encoder has
no HE profile, so encode() uses the first of these it finds:
  - aac_at: Apple's AudioToolbox, in macOS builds of ffmpeg (Homebrew's);
  - libfdk_aac: Fraunhofer FDK, in ffmpeg builds that include it;
  - fdkaac: FDK's own command-line encoder (Ubuntu: apt install fdkaac).
"""

import functools
import shutil
import subprocess
import tempfile
from pathlib import Path

AUDIO_EXT = ".m4a"
FADE_IN = "afade=t=in:st=0:d=0.02"


@functools.lru_cache(maxsize=1)
def encoder():
    listing = subprocess.run(["ffmpeg", "-hide_banner", "-encoders"], capture_output=True, text=True).stdout
    for name in ("aac_at", "libfdk_aac"):
        if f" {name} " in listing:
            return name
    if shutil.which("fdkaac"):
        return "fdkaac"
    raise RuntimeError("No HE-AAC encoder found: on macOS use Homebrew's ffmpeg (aac_at); "
                       "on Ubuntu run `sudo apt install fdkaac`.")


def encode(src, dst, fade_in=False):
    """Encode any audio file `src` to an HE-AAC clip at `dst`."""
    decode = ["ffmpeg", "-nostdin", "-y", "-loglevel", "error", "-threads", "1", "-i", str(src),
              *(["-af", FADE_IN] if fade_in else []), "-ac", "1", "-ar", "24000"]
    name = encoder()
    if name == "aac_at":
        options = ["-c:a", "aac_at", "-profile:a", "4", "-b:a", "32k"]
    elif name == "libfdk_aac":
        options = ["-c:a", "libfdk_aac", "-profile:a", "aac_he", "-b:a", "32k"]
    else:
        with tempfile.TemporaryDirectory() as tmp:
            pcm = Path(tmp) / "clip.wav"
            subprocess.run([*decode, "-c:a", "pcm_s16le", str(pcm)], check=True)
            subprocess.run(["fdkaac", "-S", "-p", "5", "-b", "32000", "--moov-before-mdat",
                            "-o", str(dst), str(pcm)], check=True)
        return
    subprocess.run([*decode, *options, "-movflags", "+faststart", str(dst)], check=True)
