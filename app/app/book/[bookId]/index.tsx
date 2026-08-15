import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { HadithListItem } from '../../../src/components/HadithListItem';
import { ProgressBar } from '../../../src/components/ProgressBar';
import { theme, toArabicDigits } from '../../../src/constants/theme';
import { getBook, getHadithsForBook } from '../../../src/data';
import { useProgress } from '../../../src/progress/progress';
import type { Hadith } from '../../../src/types/content';

export default function BookViewScreen() {
  const router = useRouter();
  const { bookId } = useLocalSearchParams<{ bookId: string }>();

  const currentBookId = typeof bookId === 'string' ? bookId : 'nawawi40';
  const book = getBook(currentBookId);
  const hadiths = getHadithsForBook(currentBookId);
  const { isDone, bookProgress } = useProgress();

  const doneCount = bookProgress(currentBookId).done.length;
  const ratio = hadiths.length > 0 ? doneCount / hadiths.length : 0;

  const [searchQuery, setSearchQuery] = useState('');

  const filteredHadiths = useMemo(() => {
    if (!searchQuery.trim()) return hadiths;
    const query = searchQuery.trim().toLowerCase();
    return hadiths.filter((h) => {
      const matchNumber = String(h.number).includes(query) || toArabicDigits(h.number).includes(query);
      const matchMatn = h.matn?.arabic?.toLowerCase().includes(query);
      const matchChapter = h.chapter?.title?.toLowerCase().includes(query);
      return matchNumber || matchMatn || matchChapter;
    });
  }, [hadiths, searchQuery]);

  const handleOpenHadith = (hadith: Hadith) => {
    router.push(`/book/${currentBookId}/${hadith.number}`);
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={filteredHadiths}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <HadithListItem
            hadith={item}
            done={isDone(currentBookId, item.number)}
            onPress={() => handleOpenHadith(item)}
          />
        )}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.header}>
            {/* Book metadata + progress */}
            <View style={styles.metaCard}>
              <Text style={styles.bookTitle}>{book?.title || 'الأربعون النووية'}</Text>
              <Text style={styles.bookAuthor}>{book?.author || 'الإمام يحيى بن شرف النووي'}</Text>
              <View style={styles.progressGroup}>
                <ProgressBar ratio={ratio} />
                <View style={styles.progressLabelRow}>
                  <Text style={styles.progressLabel}>
                    أتممت {toArabicDigits(doneCount)} من {toArabicDigits(hadiths.length)} حديثًا
                  </Text>
                  <Text style={styles.progressPct}>
                    {toArabicDigits(Math.round(ratio * 100))}٪
                  </Text>
                </View>
              </View>
            </View>

            {/* Search filter input */}
            <View style={styles.searchContainer}>
              <TextInput
                style={styles.searchInput}
                placeholder="ابحث برقم الحديث أو بنص المتن أو الباب..."
                placeholderTextColor={theme.colors.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                textAlign="right"
              />
            </View>

            <View style={styles.listSummaryRow}>
              <Text style={styles.listSummaryText}>
                قائمة الأحاديث ({toArabicDigits(filteredHadiths.length)})
              </Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>لا توجد نتائج مطابقة</Text>
            <Text style={styles.emptyText}>جرب البحث برقم مختلف أو كلمة أخرى من نص الحديث</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  listContent: {
    padding: theme.spacing.md,
  },
  header: {
    marginBottom: theme.spacing.md,
    gap: theme.spacing.md,
  },
  metaCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: theme.spacing.sm,
  },
  bookTitle: {
    ...theme.typography.title,
    fontSize: 22,
    color: theme.colors.text,
    fontFamily: theme.matnFontFamily,
  },
  bookAuthor: {
    ...theme.typography.body,
    color: theme.colors.accent,
    fontWeight: '600',
  },
  progressGroup: {
    gap: 6,
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderSubtle,
  },
  progressLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressLabel: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
  },
  progressPct: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.goldDeep,
  },
  searchContainer: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 8,
  },
  searchInput: {
    ...theme.typography.body,
    color: theme.colors.text,
    padding: 0,
  },
  listSummaryRow: {
    paddingHorizontal: theme.spacing.xs,
    paddingTop: theme.spacing.xs,
  },
  listSummaryText: {
    ...theme.typography.subtitle,
    color: theme.colors.textSecondary,
    fontSize: 15,
  },
  emptyContainer: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: theme.spacing.xl,
    alignItems: 'center',
    marginTop: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    gap: theme.spacing.xs,
  },
  emptyTitle: {
    ...theme.typography.subtitle,
    color: theme.colors.text,
  },
  emptyText: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
});
