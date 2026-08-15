import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AudioPlayerBar } from '../../../src/components/AudioPlayerBar';
import { CommentarySection } from '../../../src/components/CommentarySection';
import { ReviewBadge } from '../../../src/components/ReviewBadge';
import { formatHadithTitle, theme, toArabicDigits } from '../../../src/constants/theme';
import { getBook, getHadithByNumber, getHadithsForBook } from '../../../src/data';

export default function HadithPlayerScreen() {
  const router = useRouter();
  const { bookId, hadithNumber } = useLocalSearchParams<{
    bookId: string;
    hadithNumber: string;
  }>();

  const currentBookId = typeof bookId === 'string' ? bookId : 'nawawi40';
  const num = parseInt(typeof hadithNumber === 'string' ? hadithNumber : '1', 10) || 1;

  const book = getBook(currentBookId);
  const allHadiths = getHadithsForBook(currentBookId);
  const totalCount = allHadiths.length || 42;
  const hadith = getHadithByNumber(currentBookId, num);

  const hasPrev = num > 1;
  const hasNext = num < totalCount;

  const handlePrev = () => {
    if (hasPrev) {
      router.replace(`/book/${currentBookId}/${num - 1}`);
    }
  };

  const handleNext = () => {
    if (hasNext) {
      router.replace(`/book/${currentBookId}/${num + 1}`);
    }
  };

  if (!hadith) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>لم يتم العثور على الحديث</Text>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>العودة لقائمة الأحاديث</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
      >
        {/* Navigation Bar between Hadiths */}
        <View style={styles.navHeader}>
          <Pressable
            onPress={handlePrev}
            disabled={!hasPrev}
            style={[styles.navBtn, !hasPrev && styles.navBtnDisabled]}
          >
            <Text style={[styles.navBtnText, !hasPrev && styles.navBtnTextDisabled]}>
              → الحديث السابق
            </Text>
          </Pressable>

          <View style={styles.hadithIndexPill}>
            <Text style={styles.hadithIndexText}>
              {toArabicDigits(num)} / {toArabicDigits(totalCount)}
            </Text>
          </View>

          <Pressable
            onPress={handleNext}
            disabled={!hasNext}
            style={[styles.navBtn, !hasNext && styles.navBtnDisabled]}
          >
            <Text style={[styles.navBtnText, !hasNext && styles.navBtnTextDisabled]}>
              الحديث التالي ←
            </Text>
          </Pressable>
        </View>

        {/* Hadith Heading & Review Badge */}
        <View style={styles.titleCard}>
          <View style={styles.titleRow}>
            <Text style={styles.hadithMainTitle}>{formatHadithTitle(hadith.number)}</Text>
            <ReviewBadge status={hadith.review?.status} size="medium" />
          </View>
          <Text style={styles.bookSubTitle}>{book?.title || 'الأربعون النووية'}</Text>
        </View>

        {/* Matn Section */}
        <View style={styles.matnCard}>
          <View style={styles.matnHeader}>
            <Text style={styles.matnLabel}>نص الحديث الشريف</Text>
          </View>
          <Text style={styles.matnBody} selectable>
            {hadith.matn?.arabic}
          </Text>
        </View>

        {/* Review Notes banner if present */}
        {hadith.review?.notes && (
          <View style={styles.reviewNotesCard}>
            <Text style={styles.reviewNotesTitle}>ملاحظة المراجعة والتحقيق:</Text>
            <Text style={styles.reviewNotesText}>{hadith.review.notes}</Text>
          </View>
        )}

        {/* Commentary Sections (آداب / فوائد / المعنى الإجمالي) */}
        <CommentarySection commentary={hadith.commentary} />

        {/* Bottom padding for fixed player bar */}
        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Non-functional Audiobook Player Bar */}
      <View style={styles.playerBarContainer}>
        <AudioPlayerBar hadithNumber={num} totalHadiths={totalCount} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: theme.spacing.md,
    gap: theme.spacing.md,
  },
  navHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
  },
  navBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.radius.sm,
  },
  navBtnDisabled: {
    opacity: 0.3,
  },
  navBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.primary,
    writingDirection: 'rtl',
  },
  navBtnTextDisabled: {
    color: theme.colors.textMuted,
  },
  hadithIndexPill: {
    backgroundColor: theme.colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: theme.radius.full,
  },
  hadithIndexText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  titleCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
  },
  hadithMainTitle: {
    ...theme.typography.title,
    fontSize: 22,
    color: theme.colors.text,
  },
  bookSubTitle: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
  },
  matnCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  matnHeader: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderSubtle,
    paddingBottom: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  matnLabel: {
    ...theme.typography.subtitle,
    color: theme.colors.accent,
    fontSize: 14,
  },
  matnBody: {
    ...theme.typography.matn,
    color: theme.colors.text,
    textAlign: 'justify',
  },
  reviewNotesCard: {
    backgroundColor: theme.colors.unreviewedBg,
    borderColor: theme.colors.unreviewedBorder,
    borderWidth: 1,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    gap: 4,
  },
  reviewNotesTitle: {
    ...theme.typography.caption,
    fontWeight: '700',
    color: theme.colors.unreviewedText,
  },
  reviewNotesText: {
    ...theme.typography.body,
    fontSize: 13,
    lineHeight: 20,
    color: theme.colors.unreviewedText,
  },
  bottomSpacer: {
    height: 140, // Ensure content can scroll above the floating player bar
  },
  playerBarContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  errorTitle: {
    ...theme.typography.title,
    color: theme.colors.text,
  },
  backBtn: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.md,
  },
  backBtnText: {
    color: theme.colors.textInverse,
    fontWeight: '700',
  },
});
