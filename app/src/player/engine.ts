import { Asset } from 'expo-asset';
import { createAudioPlaylist, setAudioModeAsync } from 'expo-audio';
import { useSyncExternalStore } from 'react';
import type { AudioAsset } from '../data';
import type { Segment } from './segments';

const STATUS_EVENT = 'playlistStatusUpdate';

export interface PlayerState {
  bookId: string | null;
  hadithNumber: number | null;
  segments: Segment[];
  playing: boolean;
  currentTime: number;
  duration: number;
  currentIndex: number;
  finished: boolean;
  autoplayBlocked: boolean;
}

const INITIAL: PlayerState = {
  bookId: null,
  hadithNumber: null,
  segments: [],
  playing: false,
  currentTime: 0,
  duration: 0,
  currentIndex: 0,
  finished: false,
  autoplayBlocked: false,
};

// The native playlist accepts only resolved sources; a require() asset id is a bare number.
function toSource(source: AudioAsset) {
  if (typeof source === 'string') return { uri: source };
  const asset = Asset.fromModule(source);
  return { uri: asset.localUri ?? asset.uri, name: asset.name ?? undefined };
}

function sameSegments(a: Segment[], b: Segment[]) {
  return (
    a.length === b.length &&
    a.every((segment, i) => segment.source === b[i].source && segment.label === b[i].label)
  );
}

/**
 * Owns the audio queue outside React so playback can continue while screens
 * unmount — and later be driven by the car integrations.
 */
class PlayerEngine {
  private playlist = createAudioPlaylist({ sources: [], loop: 'none', updateInterval: 250 });
  private state: PlayerState = INITIAL;
  private listeners = new Set<() => void>();
  private blockedTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.playlist.addListener(STATUS_EVENT, (status: unknown) => this.handleStatus(status as Record<string, never>));
  }

  getState = () => this.state;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private set(patch: Partial<PlayerState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener());
  }

  private handleStatus(status: Record<string, never>) {
    const s = status as unknown as {
      playing: boolean;
      currentTime: number;
      duration: number;
      currentIndex: number;
      didJustFinish: boolean;
    };
    const patch: Partial<PlayerState> = {
      playing: s.playing,
      currentTime: s.currentTime,
      duration: s.duration,
      currentIndex: s.currentIndex,
    };
    if (s.currentTime > 0.05 && this.state.autoplayBlocked) patch.autoplayBlocked = false;
    if (s.didJustFinish && !this.state.finished) patch.finished = true;
    this.set(patch);
  }

  play(bookId: string, hadithNumber: number, segments: Segment[]) {
    const unchanged =
      this.state.bookId === bookId &&
      this.state.hadithNumber === hadithNumber &&
      sameSegments(this.state.segments, segments);
    if (unchanged) return;

    this.clearBlockedTimer();
    this.playlist.clear();
    this.set({
      bookId,
      hadithNumber,
      segments,
      playing: false,
      currentTime: 0,
      duration: 0,
      currentIndex: 0,
      finished: false,
      autoplayBlocked: false,
    });
    if (segments.length === 0) return;

    for (const segment of segments) this.playlist.add(toSource(segment.source));
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
    this.playlist.play();

    this.blockedTimer = setTimeout(() => {
      this.blockedTimer = null;
      if (this.playlist.currentTime < 0.05 && !this.state.playing) {
        this.set({ autoplayBlocked: true });
      }
    }, 2000);
  }

  playOrPause() {
    if (this.state.finished) {
      this.replay();
      return;
    }
    if (this.state.playing) {
      this.playlist.pause();
    } else {
      this.set({ autoplayBlocked: false });
      this.playlist.play();
    }
  }

  replay() {
    this.clearBlockedTimer();
    this.set({ finished: false, autoplayBlocked: false });
    this.playlist.skipTo(0);
    this.playlist.play();
  }

  seekTo(seconds: number) {
    this.playlist.seekTo(seconds).catch(() => {});
  }

  private clearBlockedTimer() {
    if (this.blockedTimer) {
      clearTimeout(this.blockedTimer);
      this.blockedTimer = null;
    }
  }
}

export const player = new PlayerEngine();

export function usePlayer(): PlayerState {
  return useSyncExternalStore(player.subscribe, player.getState);
}
