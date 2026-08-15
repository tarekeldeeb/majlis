import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { theme, toArabicDigits } from '../src/constants/theme';
import { getBooks } from '../src/data';
import type { Book } from '../src/types/content';

export default function LibraryScreen() {
  const router = useRouter();
  const books = getBooks();

  const handleOpenBook = (bookId: string) => {
    router.push(`/book/${bookId}`);
  };

  const renderBookItem = ({ item }: { item: Book }) => (
    <Pressable
      onPress={() => handleOpenBook(item.id)}
      style={({ pressed }) => [styles.bookCard, pressed && styles.bookCardPressed]}
    >
      <View style={styles.bookHeader}>
        <View style={styles.badgeRow}>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{toArabicDigits(item.count)} حديثًا</Text>
          </View>
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>قيد المراجعة</Text>
          </View>
        </View>
        <Text style={styles.bookTitle}>{item.title}</Text>
        <Text style={styles.bookAuthor}>{item.author}</Text>
      </View>

      <Text style={styles.bookDesc}>
        مجموعة الأحاديث النبوية الجامعة التي تدور عليها أصول الإسلام وقواعد الأحكام، مع شروحها والآداب والفوائد المستنبطة منها.
      </Text>

      <View style={styles.bookFooter}>
        <View style={styles.openBtn}>
          <Text style={styles.openBtnText}>تصفح الأحاديث</Text>
          <Text style={styles.chevron}>←</Text>
        </View>
      </View>
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={books}
        keyExtractor={(item) => item.id}
        renderItem={renderBookItem}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.heroCard}>
              <Text style={styles.heroBrand}>مَجْلِس</Text>
              <Text style={styles.heroTagline}>
                مكتبة تفاعلية تجمع بين نص الحديث النبوي، والشرح الصوتي، والآداب والفوائد المستفادة.
              </Text>
            </View>

            <View style={styles.sectionHeadingRow}>
              <Text style={styles.sectionHeading}>كتب الحديث</Text>
              <Text style={styles.sectionSub}>{toArabicDigits(books.length)} كتاب متوفر</Text>
            </View>
          </View>
        }
        ListFooterComponent={
          <View style={styles.upcomingSection}>
            <Text style={styles.upcomingHeading}>كتب قادمة قريبًا</Text>
            <View style={styles.upcomingCard}>
              <View style={styles.upcomingHeader}>
                <Text style={styles.upcomingTitle}>رياض الصالحين</Text>
                <View style={styles.soonBadge}>
                  <Text style={styles.soonText}>قريبًا</Text>
                </View>
              </View>
              <Text style={styles.upcomingAuthor}>الإمام النووي رحمه الله</Text>
              <Text style={styles.upcomingDesc}>
                أكثر من ١٩٠٠ حديث في الآداب والأخلاق والأعمال الصالحة.
              </Text>
            </View>
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
    gap: theme.spacing.md,
  },
  header: {
    marginBottom: theme.spacing.md,
    gap: theme.spacing.lg,
  },
  heroCard: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    gap: theme.spacing.xs,
  },
  heroBrand: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FAF9F6',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  heroTagline: {
    ...theme.typography.body,
    color: '#D1E0D7',
    marginTop: 4,
    lineHeight: 22,
  },
  sectionHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.xs,
  },
  sectionHeading: {
    ...theme.typography.title,
    color: theme.colors.text,
  },
  sectionSub: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
  },
  bookCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    gap: theme.spacing.md,
  },
  bookCardPressed: {
    backgroundColor: theme.colors.surfaceSubtle,
    borderColor: theme.colors.primaryBorder,
  },
  bookHeader: {
    gap: theme.spacing.xs,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  countBadge: {
    backgroundColor: theme.colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.full,
  },
  countText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.primary,
    writingDirection: 'rtl',
  },
  statusBadge: {
    backgroundColor: theme.colors.unreviewedBg,
    borderColor: theme.colors.unreviewedBorder,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.radius.full,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.unreviewedText,
    writingDirection: 'rtl',
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
  bookDesc: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    lineHeight: 22,
  },
  bookFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderSubtle,
  },
  openBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radius.sm,
  },
  openBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.primary,
    writingDirection: 'rtl',
  },
  chevron: {
    fontSize: 14,
    color: theme.colors.primary,
  },
  upcomingSection: {
    marginTop: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  upcomingHeading: {
    ...theme.typography.subtitle,
    color: theme.colors.textSecondary,
    paddingHorizontal: theme.spacing.xs,
  },
  upcomingCard: {
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    borderStyle: 'dashed',
    gap: 4,
  },
  upcomingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  upcomingTitle: {
    ...theme.typography.subtitle,
    color: theme.colors.textMuted,
  },
  soonBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.radius.full,
  },
  soonText: {
    fontSize: 11,
    color: theme.colors.textMuted,
    fontWeight: '600',
    writingDirection: 'rtl',
  },
  upcomingAuthor: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
  },
  upcomingDesc: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
});
