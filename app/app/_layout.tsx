import React, { useEffect } from 'react';
import { Pressable, Text } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { setupRTL, theme } from '../src/constants/theme';
import { writeCarIndex } from '../src/player/carIndex';
import { resumeDownloads, useCarRevision } from '../src/player/downloads';
import { ProgressProvider } from '../src/progress/progress';
import { SettingsProvider, useSettings } from '../src/settings/settings';

// Force RTL immediately on module load
setupRTL();

function MajlisHomeTitle() {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.replace('/')}
      accessibilityRole="link"
      accessibilityLabel="مجلس — العودة إلى الرئيسية"
    >
      <Text style={{ color: '#FAF9F6', fontSize: 18, fontWeight: '700' }}>مجلس</Text>
    </Pressable>
  );
}

// Keeps the car's hadith index (read without the UI running) in step with the
// reader's commentary choices and with the hadiths downloaded so far.
function CarIndexSync() {
  const { ready, settings } = useSettings();
  const downloaded = useCarRevision();
  useEffect(() => {
    if (ready) void writeCarIndex(settings.commentary).catch(() => {});
  }, [ready, settings.commentary, downloaded]);
  return null;
}

export default function RootLayout() {
  useEffect(() => {
    setupRTL();
    // A book's narration download carries on where it stopped.
    resumeDownloads();
  }, []);

  return (
    <SettingsProvider>
      <CarIndexSync />
      <ProgressProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerStyle: {
              backgroundColor: theme.colors.primary,
            },
            headerTintColor: '#FAF9F6',
            headerTitleStyle: {
              fontWeight: '700',
              fontSize: 18,
              color: '#FAF9F6',
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
              title: 'مجلس',
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="settings"
            options={{
              title: 'الإعدادات',
            }}
          />
          <Stack.Screen
            name="book/[bookId]/index"
            options={{
              title: 'الكتاب',
            }}
          />
          <Stack.Screen
            name="book/[bookId]/[hadithNumber]"
            options={{
              title: 'مجلس',
              headerTitle: () => <MajlisHomeTitle />,
            }}
          />
          <Stack.Screen
            name="+not-found"
            options={{
              title: 'صفحة غير موجودة',
            }}
          />
        </Stack>
      </ProgressProvider>
    </SettingsProvider>
  );
}
