import { requireNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

export interface CarQueueItem {
  id: string;
  uri: string;
  title: string;
  artist: string;
  artworkUri?: string;
}

export interface CarPlaybackState {
  available: boolean;
  playing?: boolean;
  positionMs?: number;
  durationMs?: number;
  index?: number;
  count?: number;
  ended?: boolean;
}

// Native on both mobile platforms; the web build keeps expo-audio.
const native =
  Platform.OS === 'android' || Platform.OS === 'ios' ? requireNativeModule('MajlisCar') : null;

export function isSupported(): boolean {
  return native != null;
}

export function start(): boolean {
  return native?.start() ?? false;
}

export function setQueue(items: CarQueueItem[]): boolean {
  return native?.setQueue(JSON.stringify(items)) ?? false;
}

export function play(): void {
  native?.play();
}

export function pause(): void {
  native?.pause();
}

export function seekTo(seconds: number): void {
  native?.seekTo(seconds);
}

export function next(): void {
  native?.next();
}

export function previous(): void {
  native?.previous();
}

// Android answers asynchronously (main-thread hop); iOS answers synchronously.
export function getState(): Promise<CarPlaybackState> {
  return Promise.resolve(native?.getState() ?? { available: false });
}

export function addPlaybackListener(listener: (state: CarPlaybackState) => void) {
  return native?.addListener('playbackState', listener) ?? { remove: () => {} };
}
