import { I18nManager, Platform } from 'react-native';

export function setupRTL(): void {
  try {
    if (!I18nManager.isRTL) {
      I18nManager.allowRTL(true);
      I18nManager.forceRTL(true);
    }
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.documentElement.dir = 'rtl';
      document.documentElement.lang = 'ar';
    }
  } catch (err) {
    console.warn('RTL initialization notice:', err);
  }
}

// Android resolves textAlign against the paragraph direction under RTL, so asking
// for 'right' lands the text on the left. Native is RTL-only; web keeps CSS right.
const TEXT_ALIGN = Platform.OS === 'web' ? ('right' as const) : ('left' as const);

export const theme = {
  colors: {
    background: '#FAF9F6', // Warm off-white / parchment feel
    backgroundSecondary: '#F3F1EC',
    surface: '#FFFFFF',
    surfaceSubtle: '#F8F7F4',
    border: '#E8E5DF',
    borderSubtle: '#EFECE6',

    text: '#1C1917', // Deep charcoal
    textSecondary: '#57534E',
    textMuted: '#8C857E',
    textInverse: '#FFFFFF',

    primary: '#1E3A2F', // Deep traditional forest/sage green
    primaryLight: '#E8EFEA',
    primaryBorder: '#C2D5C7',

    accent: '#B45309', // Warm amber / bronze for scholarly accents
    accentLight: '#FEF3C7',
    accentBorder: '#FDE68A',

    gold: '#A8853B', // Brass gold — progress, ornaments
    goldDeep: '#8C6D2F',
    goldLight: '#F4EDDC',
    progressTrack: '#E9E4D8',

    unreviewedBg: '#FEF3C7', // Warm amber badge for unreviewed content
    unreviewedText: '#92400E',
    unreviewedBorder: '#FCD34D',

    playerBarBg: '#1C1917',
    playerBarSurface: '#292524',
    playerBarText: '#FAF9F6',
    playerBarTextMuted: '#A8A29E',
    playerBarBorder: '#44403C',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  radius: {
    sm: 6,
    md: 10,
    lg: 16,
    full: 9999,
  },
  // Classic Naskh-style serif for sacred text; system UI font elsewhere.
  matnFontFamily: Platform.select({
    ios: 'Damascus',
    android: 'serif',
    default: "'Amiri', 'Scheherazade New', 'Noto Naskh Arabic', serif",
  }),
  typography: {
    matn: {
      fontSize: 23,
      lineHeight: 44,
      textAlign: TEXT_ALIGN,
    },
    title: {
      fontSize: 20,
      lineHeight: 28,
      fontWeight: '700' as const,
      textAlign: TEXT_ALIGN,
    },
    subtitle: {
      fontSize: 16,
      lineHeight: 24,
      fontWeight: '600' as const,
      textAlign: TEXT_ALIGN,
    },
    body: {
      fontSize: 15,
      lineHeight: 24,
      textAlign: TEXT_ALIGN,
    },
    caption: {
      fontSize: 13,
      lineHeight: 18,
      textAlign: TEXT_ALIGN,
    },
  },
};

export const arabicNumerals = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

export function toArabicDigits(num: number | string): string {
  return String(num).replace(/\d/g, (d) => arabicNumerals[parseInt(d, 10)]);
}

export function formatHadithTitle(num: number): string {
  const ordinals: Record<number, string> = {
    1: 'الحديث الأول',
    2: 'الحديث الثاني',
    3: 'الحديث الثالث',
    4: 'الحديث الرابع',
    5: 'الحديث الخامس',
    6: 'الحديث السادس',
    7: 'الحديث السابع',
    8: 'الحديث الثامن',
    9: 'الحديث التاسع',
    10: 'الحديث العاشر',
    11: 'الحديث الحادي عشر',
    12: 'الحديث الثاني عشر',
    13: 'الحديث الثالث عشر',
    14: 'الحديث الرابع عشر',
    15: 'الحديث الخامس عشر',
    16: 'الحديث السادس عشر',
    17: 'الحديث السابع عشر',
    18: 'الحديث الثامن عشر',
    19: 'الحديث التاسع عشر',
    20: 'الحديث العشرون',
    21: 'الحديث الحادي والعشرون',
    22: 'الحديث الثاني والعشرون',
    23: 'الحديث الثالث والعشرون',
    24: 'الحديث الرابع والعشرون',
    25: 'الحديث الخامس والعشرون',
    26: 'الحديث السادس والعشرون',
    27: 'الحديث السابع والعشرون',
    28: 'الحديث الثامن والعشرون',
    29: 'الحديث التاسع والعشرون',
    30: 'الحديث الثلاثون',
    31: 'الحديث الحادي والثلاثون',
    32: 'الحديث الثاني والثلاثون',
    33: 'الحديث الثالث والثلاثون',
    34: 'الحديث الرابع والثلاثون',
    35: 'الحديث الخامس والثلاثون',
    36: 'الحديث السادس والثلاثون',
    37: 'الحديث السابع والثلاثون',
    38: 'الحديث الثامن والثلاثون',
    39: 'الحديث التاسع والثلاثون',
    40: 'الحديث الأربعون',
    41: 'الحديث الحادي والأربعون',
    42: 'الحديث الثاني والأربعون',
  };
  return ordinals[num] || `الحديث ${toArabicDigits(num)}`;
}
