import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Link, Stack } from 'expo-router';
import { theme } from '../src/constants/theme';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'صفحة غير موجودة' }} />
      <View style={styles.container}>
        <Text style={styles.title}>عذرًا، هذه الصفحة غير متوفرة.</Text>
        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>العودة إلى المكتبة الرئيسية</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
    gap: theme.spacing.md,
    backgroundColor: theme.colors.background,
  },
  title: {
    ...theme.typography.title,
    color: theme.colors.text,
    textAlign: 'center',
  },
  link: {
    marginTop: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.md,
  },
  linkText: {
    color: theme.colors.textInverse,
    fontWeight: '700',
    fontSize: 14,
    writingDirection: 'rtl',
  },
});
