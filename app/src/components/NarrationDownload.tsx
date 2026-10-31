import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ProgressBar } from './ProgressBar';
import { theme, toArabicDigits } from '../constants/theme';
import { getBook, remoteAudio } from '../data';
import { pauseDownload, startDownload, type BookDownload } from '../player/downloads';

interface NarrationDownloadProps {
  bookId: string;
  hadithNumber: number;
  download: BookDownload;
}

/** Stands in for the player while a hadith's narration is not on this device yet. */
export function NarrationDownload({ bookId, hadithNumber, download }: NarrationDownloadProps) {
  const title = getBook(bookId)?.title ?? '';
  const megabytes = Math.round((remoteAudio[bookId]?.bytes ?? 0) / 1e6);
  const ratio = download.total > 0 ? download.done / download.total : 0;
  const percent = `${toArabicDigits(Math.floor(ratio * 100))}٪`;

  if (download.status === 'downloading') {
    return (
      <View style={styles.container}>
        <View style={styles.row}>
          <Ionicons name="cloud-download-outline" size={18} color={theme.colors.primary} />
          <Text style={styles.text}>
            يُنزَّل هذا الحديث أولًا ويبدأ الاستماع حين يصل، ثم يكتمل تنزيل بقية {title}.
          </Text>
        </View>
        <ProgressBar ratio={ratio} height={5} />
        <View style={styles.row}>
          <Text style={styles.caption}>
            {percent} — {toArabicDigits(download.done)} من {toArabicDigits(download.total)} ملفًا
          </Text>
          <Pressable onPress={() => pauseDownload(bookId)} accessibilityRole="button" hitSlop={8}>
            <Text style={styles.link}>إيقاف مؤقت</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const started = download.done > 0;
  const message =
    download.status === 'failed'
      ? `توقّف التنزيل عند ${percent}؛ تحقّق من الاتصال ثم أعد المحاولة.`
      : started
        ? `تنزيل تسجيلات ${title} متوقف عند ${percent}.`
        : `تسجيل هذا الحديث غير مضمَّن في التطبيق. نزِّل تسجيلات ${title} كاملةً مرةً واحدة` +
          (megabytes > 0 ? ` (نحو ${toArabicDigits(megabytes)} ميغابايت)` : '') +
          ' لتستمع إليها دون اتصال. يُفضَّل التنزيل عبر شبكة Wi‑Fi.';

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Ionicons name="cloud-download-outline" size={18} color={theme.colors.primary} />
        <Text style={styles.text}>{message}</Text>
      </View>
      {started && <ProgressBar ratio={ratio} height={5} />}
      <Pressable
        onPress={() => startDownload(bookId, hadithNumber)}
        accessibilityRole="button"
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
      >
        <Text style={styles.buttonText}>
          {download.status === 'failed' ? 'إعادة المحاولة' : started ? 'متابعة التنزيل' : 'تنزيل التسجيلات'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.sm + 2,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderSubtle,
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  text: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    flex: 1,
  },
  caption: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  link: {
    ...theme.typography.caption,
    color: theme.colors.primary,
    fontWeight: '700',
  },
  button: {
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 8,
    borderRadius: theme.radius.sm,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.textInverse,
    writingDirection: 'rtl',
  },
});
