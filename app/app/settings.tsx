import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { theme } from '../src/constants/theme';
import { useSettings, type CommentaryPart } from '../src/settings/settings';

const ROWS: { key: CommentaryPart; title: string; description: string }[] = [
  { key: 'adab', title: 'الآداب', description: 'الآداب المستفادة من الحديث' },
  { key: 'fawaid', title: 'الفوائد', description: 'الفوائد والدرر العلمية' },
  { key: 'meaning', title: 'المعنى الإجمالي', description: 'المعنى الجامع للحديث' },
];

function Toggle({
  value,
  onChange,
  label,
}: {
  value: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <Pressable
      onPress={() => onChange(!value)}
      style={styles.toggleHit}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
    >
      <View style={[styles.toggleTrack, value ? styles.toggleTrackOn : styles.toggleTrackOff]}>
        <View style={[styles.toggleThumb, value ? styles.toggleThumbOn : styles.toggleThumbOff]} />
      </View>
    </Pressable>
  );
}

export default function SettingsScreen() {
  const { settings, setCommentaryPart, resetCommentary } = useSettings();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>أجزاء الشرح الصوتي</Text>
        <Text style={styles.cardHint}>
          اختر ما يُقرأ بعد متن الحديث. يُشغَّل الحديث التالي تلقائيًا بعد انتهاء الأجزاء المختارة.
        </Text>

        {ROWS.map((row) => (
          <View key={row.key} style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>{row.title}</Text>
              <Text style={styles.rowDescription}>{row.description}</Text>
            </View>
            <Toggle
              value={settings.commentary[row.key]}
              onChange={(value) => setCommentaryPart(row.key, value)}
              label={row.title}
            />
          </View>
        ))}

        <Pressable onPress={resetCommentary} style={styles.resetBtn}>
          <Text style={styles.resetText}>استعادة الافتراضي (الكل مفعّل)</Text>
        </Pressable>
      </View>

      <Text style={styles.footer}>
        تُطبَّق الإعدادات على كل الكتب، وتُحفظ على هذا الجهاز.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    padding: theme.spacing.md,
    gap: theme.spacing.md,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  cardTitle: {
    ...theme.typography.title,
    color: theme.colors.text,
  },
  cardHint: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    lineHeight: 24,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderSubtle,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    ...theme.typography.subtitle,
    color: theme.colors.text,
  },
  rowDescription: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
  },
  toggleHit: {
    padding: 4,
    borderRadius: 999,
  },
  toggleTrack: {
    width: 48,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
  },
  toggleTrackOn: {
    backgroundColor: theme.colors.primary,
  },
  toggleTrackOff: {
    backgroundColor: theme.colors.progressTrack,
  },
  toggleThumb: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    top: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleThumbOn: {
    left: 2,
  },
  toggleThumbOff: {
    right: 2,
  },
  resetBtn: {
    alignSelf: 'flex-start',
    paddingVertical: theme.spacing.sm,
  },
  resetText: {
    ...theme.typography.caption,
    color: theme.colors.primary,
    fontWeight: '700',
  },
  footer: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: theme.spacing.md,
  },
});
