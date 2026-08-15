import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { HadithListItem } from '../../../src/components/HadithListItem';
import { theme, toArabicDigits } from '../../../src/constants/theme';
import { getBook, getHadithsForBook } from '../../../src/data';
import type { Hadith } from '../../../src/types/content';

export default function BookViewScreen() {
  const router = useRouter();
  const { bookId } = useLocalSearchParams<{ bookId: string }>();

  const currentBookId = typeof bookId === 'string' ? bookId : 'nawawi40';
  const book = getBook(currentBookId);
  const hadiths = getHadithsForBook(currentBookId);

  const [searchQuery, setSearchQuery] = useState('');

  const filteredHadiths = useMemo(() => {
    if (!searchQuery.trim()) return hadiths;
    const query = searchQuery.trim().toLowerCase();
    return hadiths.filter((h) => {
      const matchNumber = String(h.number).includes(query) || toArabicDigits(h.number).includes(query);
      const matchMatn = h.matn?.arabic?.toLowerCase().includes(query);
      return matchNumber || matchMatn;
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
          <HadithListItem hadith={item} onPress={() => handleOpenHadith(item)} />
        )}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.header}>
            {/* Book metadata card */}
            <View style={styles.metaCard}>
              <Text style={styles.bookTitle}>{book?.title || 'الأربعون النووية'}</Text>
              <Text style={styles.bookAuthor}>{book?.author || 'الإمام يحيى بن شرف النووي'}</Text>
              <View style={styles.statsRow}>
                <View style={styles.statChip}>
                  <Text style={styles.statText}>{toArabicDigits(hadiths.length)} حديثًا</Text>
                </View>
                <View style={styles.reviewBanner}>
                  <View style={styles.reviewDot} />
                  <Text style={styles.reviewBannerText}>المحتوى قيد المراجعة والاعتماد</Text>
                </View>
              </View>
            </View>

            {/* Search filter input */}
            <View style={styles.searchContainer}>
              <TextInput
                style={styles.searchInput}
                placeholder="ابحث برقم الحديث أو بنص المتن..."
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
    gap: theme.spacing.xs,
  },
  bookTitle: {
    ...theme.typography.title,
    fontSize: 22,
    color: theme.colors.text,
  },
  bookAuthor: {
    ...theme.typography.body,
    color: theme.colors.accent,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderSubtle,
  },
  statChip: {
    backgroundColor: theme.colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
  },
  statText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.primary,
    writingDirection: 'rtl',
  },
  reviewBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.unreviewedBg,
    borderColor: theme.colors.unreviewedBorder,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
    gap: 6,
  },
  reviewDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.unreviewedText,
  },
  reviewBannerText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.unreviewedText,
    writingDirection: 'rtl',
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
