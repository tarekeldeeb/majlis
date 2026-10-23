import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { setAudioModeAsync, useAudioPlaylist, useAudioPlaylistStatus } from 'expo-audio';
import { ProgressBar } from './ProgressBar';
import { theme, toArabicDigits } from '../constants/theme';
import { getAudioAsset, type AudioAsset } from '../data';

interface HadithAudioPlayerProps {
  matnPath?: string | null;
  commentaryPath?: string | null;
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '٠:٠٠';
  const total = Math.floor(seconds);
  const minutes = Math.floor(total / 60);
  const rest = String(total % 60).padStart(2, '0');
  return toArabicDigits(`${minutes}:${rest}`);
}

export function HadithAudioPlayer({ matnPath, commentaryPath }: HadithAudioPlayerProps) {
  const matnSource = getAudioAsset(matnPath);
  const commentarySource = getAudioAsset(commentaryPath);

  const sources = useMemo<AudioAsset[]>(() => {
    const list: AudioAsset[] = [];
    if (matnSource !== undefined) list.push(matnSource);
    if (commentarySource !== undefined) list.push(commentarySource);
    return list;
  }, [matnSource, commentarySource]);

  const segmentLabels = useMemo(() => {
    const list: string[] = [];
    if (matnSource !== undefined) list.push('نص الحديث');
    if (commentarySource !== undefined) list.push('الشرح والفوائد');
    return list;
  }, [matnSource, commentarySource]);

  const playlist = useAudioPlaylist({ sources, loop: 'none', updateInterval: 250 });
  const status = useAudioPlaylistStatus(playlist);

  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [finished, setFinished] = useState(false);

  const playlistId = playlist.id;

  useEffect(() => {
    if (sources.length === 0) return;

    setAutoplayBlocked(false);
    setFinished(false);

    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
    playlist.play();

    // Browsers can refuse autoplay; if the position never moves, ask for a tap.
    const timer = setTimeout(() => {
      if (playlist.currentTime < 0.05) setAutoplayBlocked(true);
    }, 2000);

    return () => clearTimeout(timer);
    // A new playlist instance means a different hadith is on screen.
  }, [playlistId]);

  useEffect(() => {
    if (status.currentTime > 0.05) setAutoplayBlocked(false);
  }, [status.currentTime]);

  useEffect(() => {
    if (status.didJustFinish) setFinished(true);
  }, [status.didJustFinish]);

  if (sources.length === 0) {
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
  const segmentLabel = finished
    ? 'انتهى التسجيل'
    : segmentLabels[status.currentIndex] ?? segmentLabels[0];
  const icon: 'play' | 'pause' | 'refresh' = finished ? 'refresh' : playing ? 'pause' : 'play';

  const handlePress = () => {
    if (finished) {
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

        {playlist.trackCount > 1 && !finished && (
          <Text style={styles.counter}>
            {toArabicDigits(status.currentIndex + 1)} / {toArabicDigits(playlist.trackCount)}
          </Text>
        )}
      </View>

      <ProgressBar ratio={ratio} height={5} />

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
