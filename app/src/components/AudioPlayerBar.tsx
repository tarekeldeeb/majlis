import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme, toArabicDigits } from '../constants/theme';

interface AudioPlayerBarProps {
  hadithNumber?: number;
  totalHadiths?: number;
}

export function AudioPlayerBar({ hadithNumber, totalHadiths }: AudioPlayerBarProps) {
  return (
    <View style={styles.wrapper}>
      <View style={styles.container}>
        {/* Top bar with audio coming soon notice */}
        <View style={styles.headerRow}>
          <View style={styles.hintBadge}>
            <View style={styles.hintDot} />
            <Text style={styles.hintText}>الصوت قريبًا</Text>
          </View>
          <Text style={styles.subtext}>
            {hadithNumber && totalHadiths
              ? `الحديث ${toArabicDigits(hadithNumber)} من ${toArabicDigits(totalHadiths)}`
              : 'تسجيلات تفاعلية للمتن والشروح'}
          </Text>
        </View>

        {/* Dummy Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBarBackground}>
            <View style={styles.progressBarFill} />
          </View>
          <View style={styles.timeRow}>
            <Text style={styles.timeText}>{toArabicDigits('00:00')}</Text>
            <Text style={styles.timeText}>{toArabicDigits('--:--')}</Text>
          </View>
        </View>

        {/* Controls (Disabled) */}
        <View style={styles.controlsRow}>
          {/* Segment forward (in RTL, next segment) */}
          <View style={[styles.controlBtn, styles.disabledBtn]}>
            <Text style={styles.controlIcon}>⏭</Text>
          </View>

          {/* Play / Pause button */}
          <View style={[styles.playBtn, styles.disabledBtn]}>
            <Text style={styles.playIcon}>▶</Text>
          </View>

          {/* Segment back (in RTL, prev segment) */}
          <View style={[styles.controlBtn, styles.disabledBtn]}>
            <Text style={styles.controlIcon}>⏮</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.md,
    paddingTop: theme.spacing.xs,
    backgroundColor: 'transparent',
  },
  container: {
    backgroundColor: theme.colors.playerBarBg,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    borderColor: theme.colors.playerBarBorder,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  hintBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(254, 243, 199, 0.15)',
    borderColor: 'rgba(252, 211, 77, 0.4)',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.full,
    gap: 5,
  },
  hintDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FCD34D',
  },
  hintText: {
    color: '#FDE68A',
    fontSize: 12,
    fontWeight: '600',
    writingDirection: 'rtl',
  },
  subtext: {
    color: theme.colors.playerBarTextMuted,
    fontSize: 12,
    writingDirection: 'rtl',
  },
  progressContainer: {
    marginVertical: theme.spacing.xs,
  },
  progressBarBackground: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    width: '0%',
    height: '100%',
    backgroundColor: theme.colors.accentLight,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  timeText: {
    color: theme.colors.playerBarTextMuted,
    fontSize: 10,
    fontVariant: ['tabular-nums'],
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.lg,
    marginTop: theme.spacing.xs,
  },
  controlBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.playerBarSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.playerBarSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledBtn: {
    opacity: 0.45,
  },
  controlIcon: {
    color: theme.colors.playerBarText,
    fontSize: 16,
  },
  playIcon: {
    color: theme.colors.playerBarText,
    fontSize: 20,
    marginLeft: 2,
  },
});
