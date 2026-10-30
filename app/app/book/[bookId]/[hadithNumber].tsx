import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AdabSection, FawaidSection, MeaningSection, CommentaryExtras } from '../../../src/components/CommentarySection';
import { HadithAudioPlayer } from '../../../src/components/HadithAudioPlayer';
import { formatHadithTitle, theme, toArabicDigits } from '../../../src/constants/theme';
import { getBook, getHadithByNumber, getHadithsForBook, matnText } from '../../../src/data';
import { player, usePlayer } from '../../../src/player/engine';
import { buildSegments } from '../../../src/player/segments';
import { useProgress } from '../../../src/progress/progress';
import { useSettings } from '../../../src/settings/settings';

type SectionKey = 'matn' | 'adab' | 'fawaid' | 'meaning';

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
  const { settings } = useSettings();
  const segments = useMemo(
    () => buildSegments(hadith?.audio, settings.commentary),
    [hadith, settings.commentary]
  );
  const playerState = usePlayer();
  const done = isDone(currentBookId, num);
  const [showDiscuss, setShowDiscuss] = useState(false);
  const { height: windowHeight } = useWindowDimensions();

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

  // The engine outlives this screen, so completion is observed rather than called back.
  const finishedHandled = useRef(false);
  useEffect(() => {
    if (!playerState.finished) {
      finishedHandled.current = false;
      return;
    }
    if (finishedHandled.current) return;
    finishedHandled.current = true;
    markDone(currentBookId, num);
    if (!hasNext) return;
    // Brief pause on "finished" before moving on, so the transition isn't abrupt.
    const timer = setTimeout(() => router.replace(`/book/${currentBookId}/${num + 1}`), 900);
    return () => clearTimeout(timer);
  }, [playerState.finished, currentBookId, num, hasNext, markDone, router]);

  useEffect(() => {
    if (!hadith) return;
    player.play(currentBookId, num, segments, {
      title: formatHadithTitle(num),
      artist: book?.title ?? '',
    });
  }, [hadith, currentBookId, num, segments, book?.title]);

  // CarPlay / Android Auto can start another hadith, or play on from this one into the
  // next; bring the screen along, marking this hadith done if the player finished it.
  useEffect(() => {
    const { source, bookId: playingBook, hadithNumber: playingNumber, continuedFrom } = playerState;
    if (source !== 'car' || !playingBook || !playingNumber) return;
    if (playingBook === currentBookId && playingNumber === num) return;
    if (continuedFrom === `${currentBookId}:${num}`) markDone(currentBookId, num);
    router.replace(`/book/${playingBook}/${playingNumber}`);
  }, [
    playerState.source,
    playerState.bookId,
    playerState.hadithNumber,
    playerState.continuedFrom,
    currentBookId,
    num,
    markDone,
    router,
  ]);

  const scrollRef = useRef<ScrollView>(null);
  const offsets = useRef<Partial<Record<SectionKey, number>>>({});
  const pendingSection = useRef<SectionKey | null>(null);

  const scrollToSection = useCallback((key: SectionKey) => {
    const y = offsets.current[key];
    if (y === undefined) {
      pendingSection.current = key;
      return;
    }
    scrollRef.current?.scrollTo({ y: Math.max(0, y - 8), animated: true });
  }, []);

  const registerOffset = useCallback(
    (key: SectionKey, y: number) => {
      offsets.current[key] = y;
      if (pendingSection.current === key) {
        pendingSection.current = null;
        scrollToSection(key);
      }
    },
    [scrollToSection]
  );

  // Follow the narration: scroll the text to whichever part is playing.
  useEffect(() => {
    const segment = playerState.segments[playerState.currentIndex];
    if (segment) scrollToSection(segment.target);
  }, [playerState.currentIndex, playerState.segments, scrollToSection]);

  useEffect(() => {
    offsets.current = {};
    pendingSection.current = 'matn';
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [currentBookId, num]);

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
      <View style={styles.fixedHeader}>
        {/* Heading + player, pinned above the scrolling text */}
        <View style={styles.titleCard}>
          <View style={styles.titleRow}>
            <Pressable
              onPress={handlePrev}
              disabled={!hasPrev}
              style={[styles.navBtn, !hasPrev && styles.navBtnDisabled]}
            >
              <Text style={[styles.navBtnText, !hasPrev && styles.navBtnTextDisabled]}>
                → السابق
              </Text>
            </Pressable>

            <View style={styles.titleCenter}>
              <View style={styles.titleLine}>
                <Text style={styles.hadithMainTitle}>{formatHadithTitle(hadith.number)}</Text>
                <View style={styles.hadithIndexPill}>
                  <Text style={styles.hadithIndexText}>
                    {toArabicDigits(num)} / {toArabicDigits(totalCount)}
                  </Text>
                </View>
              </View>
              <Text style={styles.bookSubTitle}>
                {book?.title}
                {hadith.chapter?.title ? ` — ${hadith.chapter.title}` : ''}
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

          <HadithAudioPlayer segments={segments} />
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
      >
        {/* Matn */}
        <View onLayout={(event) => registerOffset('matn', event.nativeEvent.layout.y)}>
          <View style={styles.matnCard}>
            <View style={styles.matnOrnamentRule} />
            <View style={styles.matnHeader}>
              <Text style={styles.matnLabel}>نَصُّ الْحَدِيثِ الشَّرِيفِ</Text>
            </View>
            <Text style={styles.matnBody} selectable>
              {matnText(hadith)}
            </Text>
          </View>
        </View>

        {/* Commentary sections, each a direct scroll child for exact auto-scroll offsets */}
        <View onLayout={(event) => registerOffset('adab', event.nativeEvent.layout.y)}>
          <AdabSection items={hadith.commentary?.adab} />
        </View>
        <View onLayout={(event) => registerOffset('fawaid', event.nativeEvent.layout.y)}>
          <FawaidSection items={hadith.commentary?.fawaid} />
        </View>
        <View onLayout={(event) => registerOffset('meaning', event.nativeEvent.layout.y)}>
          <MeaningSection meaning={hadith.commentary?.meaning} />
        </View>
        <CommentaryExtras commentary={hadith.commentary} />

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

        <View style={{ height: Math.max(120, windowHeight) }} />
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
  fixedHeader: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
    gap: theme.spacing.md,
    backgroundColor: theme.colors.background,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderSubtle,
    zIndex: 2,
  },
  scrollContent: {
    padding: theme.spacing.md,
    gap: theme.spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  titleCenter: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  titleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  navBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.radius.sm,
    minWidth: 64,
    alignItems: 'center',
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
    gap: theme.spacing.sm,
  },
  hadithMainTitle: {
    ...theme.typography.title,
    fontSize: 22,
    color: theme.colors.text,
    fontFamily: theme.matnFontFamily,
    textAlign: 'center',
  },
  bookSubTitle: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    textAlign: 'center',
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
