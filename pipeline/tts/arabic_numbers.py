#!/usr/bin/env python3
"""Diacritized Arabic cardinal words for hadith numbers (1-9999)."""

ONES = {
    1: "وَاحِد",
    2: "اثْنَان",
    3: "ثَلَاثَة",
    4: "أَرْبَعَة",
    5: "خَمْسَة",
    6: "سِتَّة",
    7: "سَبْعَة",
    8: "ثَمَانِيَة",
    9: "تِسْعَة",
}

TEENS = {
    10: "عَشَرَة",
    11: "أَحَدَ عَشَرَ",
    12: "اثْنَا عَشَرَ",
    13: "ثَلَاثَةَ عَشَرَ",
    14: "أَرْبَعَةَ عَشَرَ",
    15: "خَمْسَةَ عَشَرَ",
    16: "سِتَّةَ عَشَرَ",
    17: "سَبْعَةَ عَشَرَ",
    18: "ثَمَانِيَةَ عَشَرَ",
    19: "تِسْعَةَ عَشَرَ",
}

TENS = {
    20: "عِشْرُونَ",
    30: "ثَلَاثُونَ",
    40: "أَرْبَعُونَ",
    50: "خَمْسُونَ",
    60: "سِتُّونَ",
    70: "سَبْعُونَ",
    80: "ثَمَانُونَ",
    90: "تِسْعُونَ",
}

HUNDREDS = {
    1: "مِائَة",
    2: "مِائَتَانِ",
    3: "ثَلَاثُمِائَةٍ",
    4: "أَرْبَعُمِائَةٍ",
    5: "خَمْسُمِائَةٍ",
    6: "سِتُّمِائَةٍ",
    7: "سَبْعُمِائَةٍ",
    8: "ثَمَانُمِائَةٍ",
    9: "تِسْعُمِائَةٍ",
}

THOUSANDS = {
    1: "أَلْف",
    2: "أَلْفَانِ",
    3: "ثَلَاثَةُ آلَافٍ",
    4: "أَرْبَعَةُ آلَافٍ",
    5: "خَمْسَةُ آلَافٍ",
    6: "سِتَّةُ آلَافٍ",
    7: "سَبْعَةُ آلَافٍ",
    8: "ثَمَانِيَةُ آلَافٍ",
    9: "تِسْعَةُ آلَافٍ",
}


def _below_100(n: int) -> str:
    if n in TEENS:
        return TEENS[n]
    if n in TENS:
        return TENS[n]
    if n < 10:
        return ONES[n]
    tens = (n // 10) * 10
    return f"{ONES[n % 10]} وَ{TENS[tens]}"


def _below_1000(n: int) -> str:
    if n < 100:
        return _below_100(n)
    hundreds = n // 100
    rest = n % 100
    head = HUNDREDS[hundreds]
    return f"{head} وَ{_below_100(rest)}" if rest else head


def arabic_number_words(n: int) -> str:
    if n <= 0:
        raise ValueError("number must be positive")
    if n < 1000:
        return _below_1000(n)
    thousands = n // 1000
    rest = n % 1000
    if thousands > 9:
        raise ValueError("number must be below 10000")
    head = THOUSANDS[thousands]
    return f"{head} وَ{_below_1000(rest)}" if rest else head


def hadith_number_text(n: int) -> str:
    return f"الْحَدِيثُ رَقْمُ {arabic_number_words(n)}"


if __name__ == "__main__":
    for value in (1, 2, 10, 11, 21, 42, 100, 101, 342, 1000, 1896):
        print(value, "->", hadith_number_text(value))
