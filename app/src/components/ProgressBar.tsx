import React from 'react';
import { StyleSheet, View } from 'react-native';
import { theme } from '../constants/theme';

interface ProgressBarProps {
  ratio: number; // 0..1
  height?: number;
}

export function ProgressBar({ ratio, height = 6 }: ProgressBarProps) {
  const pct = Math.max(0, Math.min(1, ratio)) * 100;
  return (
    <View style={[styles.track, { height, borderRadius: height / 2 }]}>
      <View style={[styles.fill, { width: `${pct}%`, height, borderRadius: height / 2 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  // A row's first child sits at the line start, which is the right edge in RTL.
  track: {
    backgroundColor: theme.colors.progressTrack,
    overflow: 'hidden',
    width: '100%',
    flexDirection: 'row',
  },
  fill: {
    backgroundColor: theme.colors.gold,
  },
});
