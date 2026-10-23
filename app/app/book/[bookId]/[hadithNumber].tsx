import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CommentarySection } from '../../../src/components/CommentarySection';
import { HadithAudioPlayer } from '../../../src/components/HadithAudioPlayer';
import { formatHadithTitle, theme, toArabicDigits } from '../../../src/constants/theme';
import { getBook, getHadithByNumber, getHadithsForBook } from '../../../src/data';
import { useProgress } from '../../../src/progress/progress';

export default function HadithScreen() {
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

  const { isDone, toggleDone, markDone, markVisited } = useProgress();
  const done = isDone(currentBookId, num);
  const [showDiscuss, setShowDiscuss] = useState(false);

  useEffect(() => {
    if (hadith) markVisited(currentBookId, num);
    setShowDiscuss(false);
  }, [currentBookId, num, hadith, markVisited]);

  const hasPrev = num > 1;
  const hasNext = num < totalCount;

  const handlePrev = () => {
    if (hasPrev) router.replace(`/book/${currentBookId}/${num - 1}`);
  };
  const handleNext = () => {
    if (hasNext) router.replace(`/book/${currentBookId}/${num + 1}`);
  };

  const handleAudioCompleted = () => {
    markDone(currentBookId, num);
    if (hasNext) router.replace(`/book/${currentBookId}/${num + 1}`);
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
        {/* Position within the journey */}
        <View style={styles.navHeader}>
          <Pressable
            onPress={handlePrev}
            disabled={!hasPrev}
            style={[styles.navBtn, !hasPrev && styles.navBtnDisabled]}
          >
            <Text style={[styles.navBtnText, !hasPrev && styles.navBtnTextDisabled]}>
              → السابق
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
              التالي ←
            </Text>
          </Pressable>
        </View>

        {/* Heading */}
        <View style={styles.titleCard}>
          <Text style={styles.hadithMainTitle}>{formatHadithTitle(hadith.number)}</Text>
          <Text style={styles.bookSubTitle}>
            {book?.title}
            {hadith.chapter?.title ? ` — ${hadith.chapter.title}` : ''}
          </Text>
          <HadithAudioPlayer
            matnPath={hadith.audio?.matn}
            commentaryPath={hadith.audio?.commentary}
            onCompleted={handleAudioCompleted}
          />
        </View>

        {/* Matn */}
        <View style={styles.matnCard}>
          <View style={styles.matnOrnamentRule} />
          <View style={styles.matnHeader}>
            <Text style={styles.matnLabel}>نَصُّ الْحَدِيثِ الشَّرِيفِ</Text>
          </View>
          <Text style={styles.matnBody} selectable>
            {hadith.matn?.arabic}
          </Text>
        </View>

        {/* Commentary (آداب / فوائد / المعنى الإجمالي) */}
        <CommentarySection commentary={hadith.commentary} />

        {/* Discussion panel (Phase 2 entry point) */}
        {showDiscuss && (
          <View style={styles.discussCard}>
            <Text style={styles.discussTitle}>مناقشة الحديث</Text>
            <Text style={styles.discussText}>
              المناقشة التفاعلية قادمة في المرحلة الثانية بإذن الله: ستحاور مساعدًا مستندًا إلى
              نص الحديث وشرحه ومصادره، يجيبك بحجج موثقة دون إفتاء.
            </Text>
          </View>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Journey action bar: done / discuss */}
      <View style={styles.actionBar}>
        <Pressable
          onPress={() => toggleDone(currentBookId, num)}
          style={({ pressed }) => [
            styles.actionBtn,
            done ? styles.actionBtnDone : styles.actionBtnOutline,
            pressed && styles.actionBtnPressed,
          ]}
        >
          <Text style={done ? styles.actionBtnTextOnGold : styles.actionBtnTextOutline}>
            {done ? '✓ تَمَّ' : 'أتممتُ الحديث'}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setShowDiscuss((v) => !v)}
          style={({ pressed }) => [
            styles.actionBtn,
            styles.actionBtnOutline,
            showDiscuss && styles.actionBtnActive,
            pressed && styles.actionBtnPressed,
          ]}
        >
          <Text style={styles.actionBtnTextOutline}>ناقش</Text>
        </Pressable>
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
  hadithMainTitle: {
    ...theme.typography.title,
    fontSize: 22,
    color: theme.colors.text,
    fontFamily: theme.matnFontFamily,
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
  matnOrnamentRule: {
    height: 3,
    backgroundColor: theme.colors.gold,
    borderRadius: 2,
    width: 64,
    alignSelf: 'center',
    marginBottom: theme.spacing.md,
  },
  matnHeader: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderSubtle,
    paddingBottom: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  matnLabel: {
    ...theme.typography.subtitle,
    color: theme.colors.goldDeep,
    fontSize: 14,
  },
  matnBody: {
    ...theme.typography.matn,
    color: theme.colors.text,
    textAlign: 'justify',
    fontFamily: theme.matnFontFamily,
  },
  discussCard: {
    backgroundColor: theme.colors.primaryLight,
    borderColor: theme.colors.primaryBorder,
    borderWidth: 1,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    gap: 6,
  },
  discussTitle: {
    ...theme.typography.subtitle,
    color: theme.colors.primary,
  },
  discussText: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    lineHeight: 24,
  },
  bottomSpacer: {
    height: 96,
  },
  actionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    borderTopWidth: 2,
    borderTopColor: theme.colors.gold,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
    borderRadius: theme.radius.sm,
    minWidth: 96,
  },
  actionBtnPressed: {
    opacity: 0.85,
  },
  actionBtnOutline: {
    borderWidth: 1,
    borderColor: 'rgba(255, 253, 247, 0.45)',
  },
  actionBtnActive: {
    backgroundColor: 'rgba(255, 253, 247, 0.12)',
  },
  actionBtnDone: {
    backgroundColor: theme.colors.gold,
  },
  actionBtnTextOutline: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FAF9F6',
    writingDirection: 'rtl',
  },
  actionBtnTextOnGold: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2A2513',
    writingDirection: 'rtl',
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
