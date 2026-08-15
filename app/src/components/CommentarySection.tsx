import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme, toArabicDigits } from '../constants/theme';
import type { HadithCommentary } from '../types/content';

interface CommentarySectionProps {
  commentary?: HadithCommentary;
}

export function CommentarySection({ commentary }: CommentarySectionProps) {
  if (!commentary) return null;

  const hasAdab = Array.isArray(commentary.adab) && commentary.adab.length > 0;
  const hasFawaid = Array.isArray(commentary.fawaid) && commentary.fawaid.length > 0;
  const hasMeaning = typeof commentary.meaning === 'string' && commentary.meaning.trim().length > 0;
  const hasAyat = Array.isArray(commentary.relatedAyat) && commentary.relatedAyat.length > 0;
  const hasSources = Array.isArray(commentary.sources) && commentary.sources.length > 0;

  if (!hasAdab && !hasFawaid && !hasMeaning && !hasAyat && !hasSources) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>الشرح والتعليق</Text>
        <Text style={styles.emptyText}>
          يتم حاليًا إعداد الشروح المعتمدة (الآداب والفوائد والمعنى الإجمالي) لهذا الحديث ضمن خطة المراجعة.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* المعنى الإجمالي */}
      {hasMeaning && (
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.iconCircle}>
              <Text style={styles.iconText}>📖</Text>
            </View>
            <Text style={styles.sectionTitle}>المعنى الإجمالي</Text>
          </View>
          <Text style={styles.meaningText}>{commentary.meaning}</Text>
        </View>
      )}

      {/* الآداب */}
      {hasAdab && (
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.iconCircle}>
              <Text style={styles.iconText}>🌱</Text>
            </View>
            <Text style={styles.sectionTitle}>الآداب المستفادة</Text>
          </View>
          <View style={styles.list}>
            {commentary.adab!.map((item, idx) => (
              <View key={`adab-${idx}`} style={styles.listItem}>
                <View style={styles.bulletNumber}>
                  <Text style={styles.bulletText}>{toArabicDigits(idx + 1)}</Text>
                </View>
                <Text style={styles.itemText}>{item}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* الفوائد */}
      {hasFawaid && (
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.iconCircle}>
              <Text style={styles.iconText}>💡</Text>
            </View>
            <Text style={styles.sectionTitle}>الفوائد والعِبر</Text>
          </View>
          <View style={styles.list}>
            {commentary.fawaid!.map((item, idx) => (
              <View key={`fawaid-${idx}`} style={styles.listItem}>
                <View style={styles.bulletNumber}>
                  <Text style={styles.bulletText}>{toArabicDigits(idx + 1)}</Text>
                </View>
                <Text style={styles.itemText}>{item}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* الآيات الكريمة ذات الصلة */}
      {hasAyat && (
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.iconCircle}>
              <Text style={styles.iconText}>📜</Text>
            </View>
            <Text style={styles.sectionTitle}>الآيات الكريمة ذات الصلة</Text>
          </View>
          <View style={styles.list}>
            {commentary.relatedAyat!.map((ayah, idx) => (
              <View key={`ayah-${idx}`} style={styles.ayahCard}>
                <Text style={styles.ayahText}>«{ayah.text}»</Text>
                <Text style={styles.ayahRef}>[{ayah.ref}]</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* المصادر والشروح */}
      {hasSources && (
        <View style={styles.sourcesCard}>
          <Text style={styles.sourcesHeader}>المصادر والشروح المعتمدة:</Text>
          {commentary.sources!.map((source, idx) => (
            <Text key={`source-${idx}`} style={styles.sourceText}>
              • {source}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: theme.spacing.md,
    marginTop: theme.spacing.md,
  },
  sectionCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderSubtle,
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    fontSize: 14,
  },
  sectionTitle: {
    ...theme.typography.subtitle,
    color: theme.colors.primary,
  },
  meaningText: {
    ...theme.typography.body,
    color: theme.colors.text,
    lineHeight: 28,
  },
  list: {
    gap: theme.spacing.sm,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
  },
  bulletNumber: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: theme.colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  bulletText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.textSecondary,
  },
  itemText: {
    ...theme.typography.body,
    flex: 1,
    color: theme.colors.text,
    lineHeight: 24,
  },
  ayahCard: {
    backgroundColor: theme.colors.surfaceSubtle,
    borderRightWidth: 3,
    borderRightColor: theme.colors.primary,
    padding: theme.spacing.sm,
    borderRadius: theme.radius.sm,
    marginBottom: theme.spacing.xs,
  },
  ayahText: {
    ...theme.typography.body,
    color: theme.colors.text,
    fontStyle: 'normal',
    fontWeight: '500',
  },
  ayahRef: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    marginTop: 4,
  },
  sourcesCard: {
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
  },
  sourcesHeader: {
    ...theme.typography.caption,
    fontWeight: '700',
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  sourceText: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
  emptyContainer: {
    backgroundColor: theme.colors.surfaceSubtle,
    borderRadius: theme.radius.md,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    marginTop: theme.spacing.md,
    alignItems: 'center',
  },
  emptyTitle: {
    ...theme.typography.subtitle,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  emptyText: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
});
