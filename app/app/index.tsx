import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ProgressBar } from '../src/components/ProgressBar';
import { formatHadithTitle, theme, toArabicDigits } from '../src/constants/theme';
import { getBook, getBooks, hasAudio } from '../src/data';
import { nextHadithNumber, useProgress } from '../src/progress/progress';
import type { Book } from '../src/types/content';

export default function JourneyScreen() {
  const router = useRouter();
  const books = getBooks();
  const { bookProgress, lastVisited } = useProgress();

  const continueBook = lastVisited ? getBook(lastVisited.bookId) : undefined;

  const openHadith = (bookId: string, num: number) => {
    router.push(`/book/${bookId}/${num}`);
  };

  const renderBookCard = (book: Book) => {
    const progress = bookProgress(book.id);
    const doneCount = progress.done.length;
    const ratio = book.count > 0 ? doneCount / book.count : 0;
    const next = nextHadithNumber(progress, book.count);
    const started = doneCount > 0 || progress.last !== null;

    return (
      <View key={book.id} style={styles.bookCard}>
        <View style={styles.bookHeaderRow}>
          <View style={styles.bookTitleGroup}>
            <Text style={styles.bookTitle}>{book.title}</Text>
            <Text style={styles.bookAuthor}>{book.author}</Text>
          </View>
          <View style={styles.countPill}>
            <Text style={styles.countPillText}>{toArabicDigits(book.count)} حديثًا</Text>
          </View>
        </View>

        <View style={styles.progressGroup}>
          <ProgressBar ratio={ratio} />
          <View style={styles.progressLabelRow}>
            <Text style={styles.progressLabel}>
              أتممت {toArabicDigits(doneCount)} من {toArabicDigits(book.count)}
            </Text>
            <Text style={styles.progressPct}>{toArabicDigits(Math.round(ratio * 100))}٪</Text>
          </View>
        </View>

        <View style={styles.bookActionsRow}>
          {hasAudio(book.id) ? (
            <>
              <Pressable
                onPress={() => openHadith(book.id, next)}
                style={({ pressed }) => [styles.primaryBtn, pressed && styles.primaryBtnPressed]}
              >
                <Text style={styles.primaryBtnText}>
                  {started ? 'واصل المجلس' : 'ابدأ المجلس'}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => router.push(`/book/${book.id}`)}
                style={({ pressed }) => [styles.secondaryBtn, pressed && styles.secondaryBtnPressed]}
              >
                <Text style={styles.secondaryBtnText}>تصفح الأحاديث</Text>
              </Pressable>
            </>
          ) : (
            <Text style={styles.bookPending}>التسجيل الصوتي قيد الإعداد — قريبًا بإذن الله</Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Hero */}
        <View style={styles.hero}>
          <Pressable
            onPress={() => router.push('/settings')}
            style={styles.settingsBtn}
            accessibilityRole="button"
            accessibilityLabel="الإعدادات"
          >
            <Ionicons name="settings-outline" size={20} color="#FAF9F6" />
          </Pressable>
          <Text style={styles.heroBrand}>مَجْلِس</Text>
          <View style={styles.heroRule} />
          <Text style={styles.heroTagline}>
            استمع إلى الحديث ومعانيه في سيارتك.
          </Text>
        </View>

        {/* Continue where you left off */}
        {lastVisited && continueBook && (
          <Pressable
            onPress={() => openHadith(lastVisited.bookId, lastVisited.number)}
            style={({ pressed }) => [styles.continueCard, pressed && styles.continueCardPressed]}
          >
            <View style={styles.continueTextGroup}>
              <Text style={styles.continueKicker}>واصل مجلسك الأخير</Text>
              <Text style={styles.continueTitle}>
                {continueBook.title} — {formatHadithTitle(lastVisited.number)}
              </Text>
            </View>
            <View style={styles.continueBtn}>
              <Text style={styles.continueBtnText}>متابعة ←</Text>
            </View>
          </Pressable>
        )}

        {/* Books journey */}
        <View style={styles.sectionHeadingRow}>
          <Text style={styles.sectionHeading}>رحلتك في كتب الحديث</Text>
        </View>
        {books.map(renderBookCard)}

        <Text style={styles.footerNote}>وقفٌ لله تعالى — مشروع مفتوح المصدر برخصة وقف العامة</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  container: {
    flex: 1,
  },
  content: {
    padding: theme.spacing.md,
    gap: theme.spacing.md,
    paddingBottom: theme.spacing.xxl,
  },
  hero: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.lg,
    paddingVertical: theme.spacing.xl,
    paddingHorizontal: theme.spacing.lg,
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  settingsBtn: {
    position: 'absolute',
    top: theme.spacing.sm,
    // Logical end edge: the left side in RTL, mirrored automatically on web.
    end: theme.spacing.sm,
    padding: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 253, 247, 0.12)',
  },
  heroBrand: {
    fontSize: 34,
    fontWeight: '800',
    color: '#FAF9F6',
    writingDirection: 'rtl',
    fontFamily: theme.matnFontFamily,
  },
  heroRule: {
    width: 56,
    height: 2,
    backgroundColor: theme.colors.gold,
    borderRadius: 1,
  },
  heroTagline: {
    ...theme.typography.body,
    color: '#D8E2DA',
    textAlign: 'center',
    lineHeight: 24,
  },
  continueCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.goldLight,
    borderColor: theme.colors.gold,
    borderWidth: 1,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  continueCardPressed: {
    backgroundColor: '#EEE3C8',
  },
  continueTextGroup: {
    flex: 1,
    gap: 2,
  },
  continueKicker: {
    ...theme.typography.caption,
    color: theme.colors.goldDeep,
    fontWeight: '700',
  },
  continueTitle: {
    ...theme.typography.subtitle,
    color: theme.colors.text,
  },
  continueBtn: {
    backgroundColor: theme.colors.gold,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 8,
    borderRadius: theme.radius.sm,
  },
  continueBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFDF7',
    writingDirection: 'rtl',
  },
  sectionHeadingRow: {
    paddingHorizontal: theme.spacing.xs,
    marginTop: theme.spacing.sm,
  },
  sectionHeading: {
    ...theme.typography.title,
    color: theme.colors.text,
  },
  bookCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: theme.spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  bookHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  bookTitleGroup: {
    flex: 1,
    gap: 2,
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
  countPill: {
    backgroundColor: theme.colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
  },
  countPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.primary,
    writingDirection: 'rtl',
  },
  progressGroup: {
    gap: 6,
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
  bookPending: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    paddingVertical: theme.spacing.sm,
  },
  bookActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderSubtle,
  },
  primaryBtn: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 10,
    borderRadius: theme.radius.sm,
  },
  primaryBtnPressed: {
    backgroundColor: '#2C5243',
  },
  primaryBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.textInverse,
    writingDirection: 'rtl',
  },
  secondaryBtn: {
    borderColor: theme.colors.primaryBorder,
    borderWidth: 1,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 9,
    borderRadius: theme.radius.sm,
  },
  secondaryBtnPressed: {
    backgroundColor: theme.colors.primaryLight,
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.primary,
    writingDirection: 'rtl',
  },
  footerNote: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginTop: theme.spacing.lg,
  },
});
