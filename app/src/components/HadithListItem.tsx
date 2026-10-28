import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatHadithTitle, theme, toArabicDigits } from '../constants/theme';
import { matnText } from '../data';
import type { Hadith } from '../types/content';

interface HadithListItemProps {
  hadith: Hadith;
  done?: boolean;
  onPress: () => void;
}

export function HadithListItem({ hadith, done = false, onPress }: HadithListItemProps) {
  // Extract a clean short excerpt of the matn
  const fullMatn = matnText(hadith);
  const cleanMatn = fullMatn.replace(/\s+/g, ' ').trim();
  const excerpt = cleanMatn.length > 130 ? cleanMatn.slice(0, 130) + '...' : cleanMatn;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.topRow}>
        <View style={styles.titleGroup}>
          <View style={[styles.numberPill, done && styles.numberPillDone]}>
            <Text style={[styles.numberText, done && styles.numberTextDone]}>
              {done ? '✓' : toArabicDigits(hadith.number)}
            </Text>
          </View>
          <View style={styles.titleTexts}>
            <Text style={styles.titleText}>{formatHadithTitle(hadith.number)}</Text>
            {hadith.chapter?.title ? (
              <Text style={styles.chapterText} numberOfLines={1}>
                {hadith.chapter.title}
              </Text>
            ) : null}
          </View>
        </View>
        {done && (
          <View style={styles.doneTag}>
            <Text style={styles.doneTagText}>تَمَّ</Text>
          </View>
        )}
      </View>

      <Text style={styles.excerptText} numberOfLines={3}>
        {excerpt}
      </Text>
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
    gap: theme.spacing.sm,
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    flex: 1,
  },
  titleTexts: {
    flex: 1,
    gap: 1,
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
  numberPillDone: {
    backgroundColor: theme.colors.gold,
    borderColor: theme.colors.goldDeep,
  },
  numberText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  numberTextDone: {
    color: '#FFFDF7',
  },
  titleText: {
    ...theme.typography.subtitle,
    color: theme.colors.text,
  },
  chapterText: {
    ...theme.typography.caption,
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  doneTag: {
    backgroundColor: theme.colors.goldLight,
    borderColor: theme.colors.gold,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.radius.full,
  },
  doneTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.goldDeep,
    writingDirection: 'rtl',
  },
  excerptText: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    lineHeight: 22,
  },
});
