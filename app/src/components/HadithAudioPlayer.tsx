import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { setAudioModeAsync, useAudioPlaylist, useAudioPlaylistStatus } from 'expo-audio';
import { SeekBar } from './SeekBar';
import { theme, toArabicDigits } from '../constants/theme';
import { getAudioAsset, type AudioAsset } from '../data';
import { useSettings } from '../settings/settings';
import type { HadithAudio } from '../types/content';

export type PlayerSection = 'matn' | 'adab' | 'fawaid' | 'meaning';

interface HadithAudioPlayerProps {
  audio?: HadithAudio;
  onCompleted?: () => void;
  onSegmentChange?: (target: PlayerSection) => void;
}

interface Segment {
  source: AudioAsset;
  label: string;
  target: PlayerSection;
}

const EMPTY_SOURCES: AudioAsset[] = [];

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '٠:٠٠';
  const total = Math.floor(seconds);
  const minutes = Math.floor(total / 60);
  const rest = String(total % 60).padStart(2, '0');
  return toArabicDigits(`${minutes}:${rest}`);
}

export function HadithAudioPlayer({ audio, onCompleted, onSegmentChange }: HadithAudioPlayerProps) {
  const { settings } = useSettings();

  const segments = useMemo<Segment[]>(() => {
    const list: Segment[] = [];
    const push = (path: string | null | undefined, label: string, target: PlayerSection) => {
      const source = getAudioAsset(path);
      if (source !== undefined) list.push({ source, label, target });
    };

    push(audio?.number, 'رقم الحديث', 'matn');
    push(audio?.matn, 'نص الحديث', 'matn');

    const c = settings.commentary;
    if (c.adab) {
      push('titles/adab.mp3', 'الآداب', 'adab');
      push(audio?.adab, 'الآداب المستفادة', 'adab');
    }
    if (c.fawaid) {
      push('titles/fawaid.mp3', 'الفوائد', 'fawaid');
      push(audio?.fawaid, 'الفوائد', 'fawaid');
    }
    if (c.meaning) {
      push('titles/meaning.mp3', 'المعنى الإجمالي', 'meaning');
      push(audio?.meaning, 'المعنى الإجمالي', 'meaning');
    }

    // Backward compatibility with the pre-split single commentary file.
    if (!audio?.adab && !audio?.fawaid && !audio?.meaning) {
      push(audio?.commentary, 'الشرح والفوائد', 'adab');
    }
    return list;
  }, [audio, settings.commentary]);

  const segmentKey = useMemo(
    () => segments.map((segment) => `${segment.label}:${segment.source}`).join('|'),
    [segments]
  );
  const playlist = useAudioPlaylist({ sources: EMPTY_SOURCES, loop: 'none', updateInterval: 250 });
  const status = useAudioPlaylistStatus(playlist);

  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [finished, setFinished] = useState(false);

  const onCompletedRef = useRef(onCompleted);
  const onSegmentChangeRef = useRef(onSegmentChange);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    onCompletedRef.current = onCompleted;
  }, [onCompleted]);

  useEffect(() => {
    onSegmentChangeRef.current = onSegmentChange;
  }, [onSegmentChange]);

  useEffect(() => {
    const segment = segments[status.currentIndex];
    if (segment) onSegmentChangeRef.current?.(segment.target);
  }, [status.currentIndex, segmentKey]);

  useEffect(() => {
    playlist.clear();
    setAutoplayBlocked(false);
    setFinished(false);
    if (segments.length === 0) return;

    for (const segment of segments) playlist.add(segment.source);
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
    playlist.play();

    // Browsers can refuse autoplay; if the position never moves, ask for a tap.
    const timer = setTimeout(() => {
      if (playlist.currentTime < 0.05) setAutoplayBlocked(true);
    }, 2000);
    return () => clearTimeout(timer);
    // segmentKey encodes both the selected parts and their audio sources.
  }, [segmentKey]);

  useEffect(() => {
    if (status.currentTime > 0.05) setAutoplayBlocked(false);
  }, [status.currentTime]);

  useEffect(() => {
    if (!status.didJustFinish) return;
    setFinished(true);

    const advance = onCompletedRef.current;
    if (!advance) return;

    // Brief pause on "finished" before moving on, so the transition isn't abrupt.
    advanceTimer.current = setTimeout(() => {
      advanceTimer.current = null;
      advance();
    }, 900);

    return () => {
      if (advanceTimer.current) {
        clearTimeout(advanceTimer.current);
        advanceTimer.current = null;
      }
    };
  }, [status.didJustFinish]);

  const handleSeek = useCallback(
    (seconds: number) => {
      playlist.seekTo(seconds).catch(() => {});
    },
    [playlist]
  );

  if (segments.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.unavailableRow}>
          <Ionicons name="volume-mute-outline" size={16} color={theme.colors.textMuted} />
          <Text style={styles.unavailableText}>التسجيل الصوتي لهذا الحديث قيد الإعداد</Text>
        </View>
      </View>
    );
  }

  const playing = status.playing && !autoplayBlocked;
  const ratio = status.duration > 0 ? status.currentTime / status.duration : 0;
  const current = segments[status.currentIndex];
  const segmentLabel = finished
    ? 'انتهى التسجيل'
    : current?.label ?? segments[0]?.label ?? 'التسجيل';
  const icon: 'play' | 'pause' | 'refresh' = finished ? 'refresh' : playing ? 'pause' : 'play';

  const handlePress = () => {
    if (finished) {
      if (advanceTimer.current) {
        clearTimeout(advanceTimer.current);
        advanceTimer.current = null;
      }
      setFinished(false);
      playlist.skipTo(0);
      playlist.play();
      return;
    }
    if (playing) {
      playlist.pause();
    } else {
      setAutoplayBlocked(false);
      playlist.play();
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Pressable
          onPress={handlePress}
          accessibilityRole="button"
          accessibilityLabel={finished ? 'إعادة الاستماع' : playing ? 'إيقاف مؤقت' : 'تشغيل الاستماع'}
          style={({ pressed }) => [styles.playBtn, pressed && styles.playBtnPressed]}
        >
          <Ionicons
            name={icon}
            size={20}
            color="#FAF9F6"
            style={icon === 'play' ? styles.playIconOffset : undefined}
          />
        </Pressable>

        <View style={styles.meta}>
          <Text style={styles.segmentLabel}>{segmentLabel}</Text>
          <Text style={styles.timeLabel}>
            {formatTime(status.currentTime)} / {formatTime(status.duration)}
          </Text>
        </View>

        {segments.length > 1 && !finished && (
          <Text style={styles.counter}>
            {toArabicDigits(status.currentIndex + 1)} / {toArabicDigits(segments.length)}
          </Text>
        )}
      </View>

      <SeekBar ratio={ratio} duration={status.duration} onSeek={handleSeek} height={5} />

      {autoplayBlocked && (
        <Text style={styles.hint}>اضغط زر التشغيل لبدء الاستماع — المتصفح أوقف التشغيل التلقائي</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.sm + 2,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderSubtle,
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm + 2,
  },
  playBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtnPressed: {
    opacity: 0.85,
  },
  playIconOffset: {
    marginStart: 3,
  },
  meta: {
    flex: 1,
    gap: 1,
  },
  segmentLabel: {
    ...theme.typography.subtitle,
    fontSize: 14,
    color: theme.colors.text,
  },
  timeLabel: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  counter: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
  },
  hint: {
    ...theme.typography.caption,
    color: theme.colors.accent,
  },
  unavailableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  unavailableText: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    flex: 1,
  },
});
