import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { setupRTL, theme } from '../src/constants/theme';

// Force RTL immediately on module load
setupRTL();

export default function RootLayout() {
  useEffect(() => {
    setupRTL();
  }, []);

  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: theme.colors.surface,
          },
          headerTintColor: theme.colors.primary,
          headerTitleStyle: {
            fontWeight: '700',
            fontSize: 18,
            color: theme.colors.text,
          },
          headerShadowVisible: false,
          contentStyle: {
            backgroundColor: theme.colors.background,
          },
        }}
      >
        <Stack.Screen
          name="index"
          options={{
            title: 'المكتبة',
            headerLargeTitle: false,
          }}
        />
        <Stack.Screen
          name="book/[bookId]/index"
          options={{
            title: 'الأربعون النووية',
            headerBackTitle: 'المكتبة',
          }}
        />
        <Stack.Screen
          name="book/[bookId]/[hadithNumber]"
          options={{
            title: 'الحديث الشريف',
            headerBackTitle: 'الكتاب',
          }}
        />
        <Stack.Screen
          name="+not-found"
          options={{
            title: 'صفحة غير موجودة',
          }}
        />
      </Stack>
    </>
  );
}
