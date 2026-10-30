"""Narration clip format, shared by the generator and the audio tools."""

# HE-AAC v1 at 32 kbps, mono: speech stays clear at a third of 96 kbps MP3's size
# (Riyad's ~43 h fit in ~0.65 GB). Apple's AudioToolbox encoder, so encoding runs
# on macOS; ffmpeg's built-in aac encoder has no HE profile.
AUDIO_EXT = ".m4a"
ENCODE = ["-c:a", "aac_at", "-profile:a", "4", "-b:a", "32k", "-ac", "1", "-ar", "24000",
          "-movflags", "+faststart"]
