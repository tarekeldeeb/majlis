import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SeekBar } from './SeekBar';
import { theme, toArabicDigits } from '../constants/theme';
import { player, usePlayer } from '../player/engine';
import type { Segment } from '../player/segments';

interface HadithAudioPlayerProps {
  segments: Segment[];
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '٠:٠٠';
  const total = Math.floor(seconds);
  const minutes = Math.floor(total / 60);
  const rest = String(total % 60).padStart(2, '0');
  return toArabicDigits(`${minutes}:${rest}`);
}

export function HadithAudioPlayer({ segments }: HadithAudioPlayerProps) {
  const state = usePlayer();

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

  const playing = state.playing && !state.autoplayBlocked;
  const ratio = state.duration > 0 ? state.currentTime / state.duration : 0;
  const current = segments[state.currentIndex];
  const segmentLabel = state.finished
    ? 'انتهى التسجيل'
    : current?.label ?? segments[0]?.label ?? 'التسجيل';
  const icon: 'play' | 'pause' | 'refresh' = state.finished ? 'refresh' : playing ? 'pause' : 'play';

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Pressable
          onPress={() => player.playOrPause()}
          accessibilityRole="button"
          accessibilityLabel={
            state.finished ? 'إعادة الاستماع' : playing ? 'إيقاف مؤقت' : 'تشغيل الاستماع'
          }
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
            {formatTime(state.currentTime)} / {formatTime(state.duration)}
          </Text>
        </View>

        {segments.length > 1 && !state.finished && (
          <Text style={styles.counter}>
            {toArabicDigits(state.currentIndex + 1)} / {toArabicDigits(segments.length)}
          </Text>
        )}
      </View>

      <SeekBar
        ratio={ratio}
        duration={state.duration}
        onSeek={(seconds) => player.seekTo(seconds)}
        height={5}
      />

      {state.autoplayBlocked && (
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
