import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../constants/theme';
import type { ReviewStatus } from '../types/content';

interface ReviewBadgeProps {
  status?: ReviewStatus;
  size?: 'small' | 'medium';
}

export function ReviewBadge({ status = 'ingested', size = 'small' }: ReviewBadgeProps) {
  if (status === 'approved') {
    return null;
  }

  const isSmall = size === 'small';

  return (
    <View style={[styles.badge, isSmall ? styles.badgeSmall : styles.badgeMedium]}>
      <View style={styles.dot} />
      <Text style={[styles.text, isSmall ? styles.textSmall : styles.textMedium]}>غير مُراجَع</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.unreviewedBg,
    borderColor: theme.colors.unreviewedBorder,
    borderWidth: 1,
    borderRadius: theme.radius.full,
    alignSelf: 'flex-start',
  },
  badgeSmall: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    gap: 4,
  },
  badgeMedium: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.unreviewedText,
  },
  text: {
    color: theme.colors.unreviewedText,
    fontWeight: '600',
    writingDirection: 'rtl',
    textAlign: 'right',
  },
  textSmall: {
    fontSize: 11,
    lineHeight: 16,
  },
  textMedium: {
    fontSize: 13,
    lineHeight: 18,
  },
});
