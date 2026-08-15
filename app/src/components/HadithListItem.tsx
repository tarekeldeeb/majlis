import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatHadithTitle, theme, toArabicDigits } from '../constants/theme';
import type { Hadith } from '../types/content';
import { ReviewBadge } from './ReviewBadge';

interface HadithListItemProps {
  hadith: Hadith;
  onPress: () => void;
}

export function HadithListItem({ hadith, onPress }: HadithListItemProps) {
  // Extract a clean short excerpt of the matn
  const fullMatn = hadith.matn?.arabic || '';
  const cleanMatn = fullMatn.replace(/\s+/g, ' ').trim();
  const excerpt = cleanMatn.length > 130 ? cleanMatn.slice(0, 130) + '...' : cleanMatn;

  const hasCommentary =
    (hadith.commentary?.adab && hadith.commentary.adab.length > 0) ||
    (hadith.commentary?.fawaid && hadith.commentary.fawaid.length > 0) ||
    !!hadith.commentary?.meaning;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.topRow}>
        <View style={styles.titleGroup}>
          <View style={styles.numberPill}>
            <Text style={styles.numberText}>{toArabicDigits(hadith.number)}</Text>
          </View>
          <Text style={styles.titleText}>{formatHadithTitle(hadith.number)}</Text>
        </View>

        <ReviewBadge status={hadith.review?.status} size="small" />
      </View>

      <Text style={styles.excerptText} numberOfLines={3}>
        {excerpt}
      </Text>

      <View style={styles.footerRow}>
        {hasCommentary ? (
          <View style={styles.tag}>
            <Text style={styles.tagText}>مع الشرح والفوائد</Text>
          </View>
        ) : (
          <View style={styles.tagSubtle}>
            <Text style={styles.tagSubtleText}>المتن فقط</Text>
          </View>
        )}

        <View style={styles.readMoreGroup}>
          <Text style={styles.readMoreText}>قراءة واستماع</Text>
          <Text style={styles.chevron}>←</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  cardPressed: {
    backgroundColor: theme.colors.surfaceSubtle,
    borderColor: theme.colors.primaryBorder,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  numberPill: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.primaryLight,
    borderWidth: 1,
    borderColor: theme.colors.primaryBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  titleText: {
    ...theme.typography.subtitle,
    color: theme.colors.text,
  },
  excerptText: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
    lineHeight: 22,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: theme.spacing.xs,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderSubtle,
  },
  tag: {
    backgroundColor: theme.colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.radius.sm,
  },
  tagText: {
    fontSize: 11,
    color: theme.colors.primary,
    fontWeight: '600',
    writingDirection: 'rtl',
  },
  tagSubtle: {
    backgroundColor: theme.colors.backgroundSecondary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.radius.sm,
  },
  tagSubtleText: {
    fontSize: 11,
    color: theme.colors.textMuted,
    writingDirection: 'rtl',
  },
  readMoreGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  readMoreText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.primary,
    writingDirection: 'rtl',
  },
  chevron: {
    fontSize: 12,
    color: theme.colors.primary,
  },
});
