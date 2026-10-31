#!/usr/bin/env python3
"""Correct the reading text (matn.diacritized) where the source or the machine
diacritizer got it wrong, and log every correction.

matn.arabic is the source verbatim and never changes; matn.diacritized is what the
app shows and the narrator reads. The corrections here are rules and a reviewed table,
applied in order:

  1. case endings of fixed formulas the diacritizer read wrong («رَضِيَ اللَّهُ» …)
  2. the source's dotless final ya («رضى»، «أبى») read as other words
  3. source corruptions and typos (a half-repeated honorific, «إلىس», «حتي» …)
  4. words reviewed one by one in context (the table below)
  5. every remaining dotless ya that is read as a ya, written «ي»: after a kasra
     («فِى» → «فِي») or carrying its own mark («رَضِىَ» → «رَضِيَ»); a ى after a
     fatha is an alef maqsura («عَلَى»، «مُوسَى») and stays
  6. a full stop before the closing citation («رَوَاهُ …»، «مُتَّفَقٌ عَلَيْهِ»)

The rules only match wrong forms, so running the script again changes nothing.
Every change is recorded in content/books/<book>/reading-text-fixes.json.

    python3 pipeline/diacritize/fix_reading_text.py --book riyad_assalihin            # dry run
    python3 pipeline/diacritize/fix_reading_text.py --book riyad_assalihin --apply
    # also rebuild the full log from the machine-diacritized text at a git revision,
    # checking the rules reproduce the current text exactly:
    python3 pipeline/diacritize/fix_reading_text.py --book riyad_assalihin --apply --baseline 90fcfee
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import unicodedata
from collections import Counter
from itertools import permutations
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

MARK = "[ً-ْٰ]"
M = MARK + "*"
LETTER = "ء-ي"
START = f"(?<![{LETTER}ً-ْٰ])"
END = f"(?![{LETTER}ً-ْٰ])"
FATHA, DAMMA, KASRA, SHADDA = "َ", "ُ", "ِ", "ّ"
MARKS = {chr(c) for c in range(0x064B, 0x0653)} | {"ٰ"}


def word(bare: str) -> str:
    """A word's letters with any marks between them."""
    return "".join(f"{ch}{M}" for ch in bare)


ALLAH = f"ا{M}ل{M}ل{M}ه"

RULES = {
    "joined-waw": "the source detaches the waw of the honorific: «عَلَيْهِ وَ سَلَّمَ» reads «عَلَيْهِ وَسَلَّمَ»",
    "dagger-alif-rahman": "«الرَّحْمٰنِ» with the dagger alif, as the classical orthography writes it",
    "radiya-allahu": "«رَضِيَ اللَّهُ»: Allah is the subject, not «اللَّهِ»",
    "salla-allahu": "«صَلَّى اللَّهُ عَلَيْهِ»: Allah is the subject, not «اللَّهِ»",
    "ani-bni": "«عَنِ ابْنِ»: genitive after the preposition, not «عَنْ ابْنُ»",
    "azza-wajalla": "«عَزَّ وَجَلَّ» read as the noun «عِزٌّ»",
    "zanni-abdi": "«أَنَا عِنْدَ ظَنِّ عَبْدِي», not «ظُنَّ»",
    "allahu-subject": "Allah as the subject of «قَالَ»، «يَقُولُ»، «رَحِمَهُ», not «اللَّهِ»",
    "dotless-radiya": "the source's «رضى الله» read as the noun «رِضًى اللَّهِ»; «رَضِيَ اللَّهُ»",
    "dotless-kunya": "the source's kunya «أبى» read as the verb «أَبَى»; «أَبِي» after «عَنْ»/«بْنُ», "
    "with the name after it in the genitive",
    "repeated-honorific": "the source repeats half the honorific: «وسلمى الله عليه وسلم» reads «وَسَلَّمَ»",
    "source-typo": "a misspelt word in the source: «حتي» → «حَتَّى», «إلىس» → «أَلَيْسَ», «امراتى» → «امْرَأَتِي»",
    "garbled-alif-maqsura": "«حَتَّى» and «عَلَى» given the marks of another word («حَتْىً»، «عِلَىْ»)",
    "reviewed": "a word reviewed in context: a ya-word the diacritizer gave a fatha (read «ā»), "
    "an active verb read as passive, or a wrong case beside it",
    "dotless-ya": "a final «ى» read as a ya, written «ي»: after a kasra («فِى» → «فِي») "
    "or with its own mark («رَضِىَ» → «رَضِيَ»), and the letter name «الزَّاي»",
    "citation-stop": "a full stop before the closing citation («رَوَاهُ …», «مُتَّفَقٌ عَلَيْهِ», or a grading "
    "«حَدِيثٌ حَسَنٌ، رَوَاهُ …» that opens it), which is not part of the hadith",
}

# Corrections made before the text reached this script, noted in the log.
NOTES = {
    "nawawi40": "Hadith 30 was also corrected when the text was diacritized "
                "(pipeline/diacritize/complete_diacritics.py, CORRECTIONS): a sukun on a space and a "
                "reversed quote around «سننه» in «الدَّارَقُطْنِيُّ فِي «سُنَنِهِ»».",
}

# Phrase rules: (rule, regex, replacement, only these hadiths per book, or None for all).
PHRASES = [
    ("joined-waw", re.compile(f"{START}(و{M})\\s+(س{M}ل{M}م{M}){END}"), "\\1\\2", None),
    ("dagger-alif-rahman", re.compile(f"(ا{M}ل{M}ر{M}ح{M}م){FATHA}(ن)"), "\\1\u0670\\2", None),
    ("radiya-allahu", re.compile(f"{START}(ر{M}ض{M}ي{M}\\s+{ALLAH}){KASRA}(?!{MARK})"), "\\1" + DAMMA, None),
    ("salla-allahu", re.compile(f"{START}(ص{M}ل{M}ى{M}\\s+{ALLAH}){KASRA}(?!{MARK})"), "\\1" + DAMMA, None),
    ("ani-bni", re.compile(f"{START}((?:[وف]{M})?ع{M})ن{M}(\\s+ا{M}ب{M}ن){DAMMA}(?!{MARK})"),
     "\\1ن" + KASRA + "\\2" + KASRA, None),
    ("azza-wajalla", re.compile(f"{START}عِز(?:ٌّ|ٌّ)(?=\\s+و{M}ج{M}ل)"),
     "ع" + FATHA + "ز" + SHADDA + FATHA, None),
    ("zanni-abdi", re.compile(f"{START}ظُن(?:َّ|َّ)(?=\\s+ع{M}ب{M}د{M}ي)"),
     "ظ" + FATHA + "ن" + SHADDA + KASRA, None),
    ("allahu-subject", re.compile(f"{START}((?:ق{M}ا{M}ل{M}|ي{M}ق{M}و{M}ل{M})\\s+{ALLAH}){KASRA}(?!{MARK})"),
     "\\1" + DAMMA, {"riyad_assalihin": {244, 556, 756, 908, 1657}}),
    ("allahu-subject", re.compile(f"((?:ر{M}ح{M}م{M}ه{M})\\s+{ALLAH}){KASRA}(?!{MARK})"),
     "\\1" + DAMMA, {"riyad_assalihin": {224, 1444, 1573}}),
]

# The genitive of a name after the kunya «أَبِي», where the diacritizer gave another case.
KUNYA_NAMES = {"سَلَمَةُ": "سَلَمَةَ", "ذَرَّ": "ذَرٍّ", "مَسْعُودٌ": "مَسْعُودٍ", "عَبْدُ": "عَبْدِ",
               "هُنَيْدَةُ": "هُنَيْدَةَ"}

# Source corruptions and words reviewed one by one, per book: (hadith, rule, before, after).
# `before` is matched in that hadith's text (marks in any order) and replaced everywhere in it.
TABLES = {"riyad_assalihin": [
    (947, "source-typo", "إلَىْسَ", "أَلَيْسَ"),
    (1413, "garbled-alif-maqsura", "عِلَىْ", "عَلَى"),
    (1714, "garbled-alif-maqsura", "عَلَىْ", "عَلَى"),
    (1736, "source-typo", "امَرَاتَى", "امْرَأَتِي"),
    # «في» given a fatha, so read «وَفَّى»
    (114, "reviewed", "وَفَّى رِوَايَةٍ", "وَفِي رِوَايَةٍ"),
    (1185, "reviewed", "وَفَّى الثَّانِيَةَ", "وَفِي الثَّانِيَةِ"),
    (1185, "reviewed", "وَفَّى الثَّالِثَةَ", "وَفِي الثَّالِثَةِ"),
    (1221, "reviewed", "وَفَى رِوَايَةٍ", "وَفِي رِوَايَةٍ"),
    (1232, "reviewed", "وَفَى رِوَايَةٍ", "وَفِي رِوَايَةٍ"),
    (1781, "reviewed", "وَفَّى رِوَايَةً", "وَفِي رِوَايَةٍ"),
    (1801, "reviewed", "وَفَّى رِوَايَةً", "وَفِي رِوَايَةٍ"),
    # «مِنِّي» read as the place name «مِنًى» (47 is Mina and stays)
    (55, "reviewed", "حَوْلَ مِنًى", "حَوْلٍ مِنِّي"),
    (1295, "reviewed", "يَمْنَعُكَ مِنًى", "يَمْنَعُكَ مِنِّي"),
    (1343, "reviewed", "بَلَغَ مِنًى", "بَلَغَ مِنِّي"),
    (1609, "reviewed", "لَاذَ مِنًى", "لَاذَ مِنِّي"),
    (1630, "reviewed", "تَقَرَّبَ مِنًى", "تَقَرَّبَ مِنِّي"),
    (1784, "reviewed", "فَهُمْ مِنًى", "فَهُمْ مِنِّي"),
    (1847, "reviewed", "وَأَقْرَبِكُمْ مِنًى", "وَأَقْرَبِكُمْ مِنِّي"),
    (1871, "reviewed", "مِنْ وَلَّى مِنْ أَمَرَ", "مَنْ وَلِيَ مِنْ أَمْرِ"),
    # «إِنِّي» and its kin
    (1589, "reviewed", "إنَى سَمِعْتُ", "إِنِّي سَمِعْتُ"),
    (1623, "reviewed", "إنَى أَرَى", "إِنِّي أَرَى"),
    (1652, "reviewed", "إنَى أَصَبْتُ", "إِنِّي أَصَبْتُ"),
    (1666, "reviewed", "إِنًى أَخَافُ اللَّهِ", "إِنِّي أَخَافُ اللَّهَ"),
    (1700, "reviewed", "إنَى لَأُحِبُّكَ", "إِنِّي لَأُحِبُّكَ"),
    (1865, "reviewed", "إِنًى لِأَتَأَخَّرَ", "إِنِّي لَأَتَأَخَّرُ"),
    (1231, "reviewed", "فَإِنَّى أَتُوبُ", "فَإِنِّي أَتُوبُ"),
    (1366, "reviewed", "فَإِنَى صَائِمٌ", "فَإِنِّي صَائِمٌ"),
    (1578, "reviewed", "فَإِنَّى رَسُولُ", "فَإِنِّي رَسُولُ"),
    (1891, "reviewed", "وَإِنَى أَحَبُّ", "وَإِنِّي أُحِبُّ"),
    (21, "reviewed", "لَكِنَّى", "لَكِنِّي"),
    (1862, "reviewed", "كَأَنَّى", "كَأَنِّي"),
    (1805, "reviewed", "أَنَّى أَخَافُ", "أَنِّي أَخَافُ"),
    # "my …" and "me"
    (1131, "reviewed", "أُمَّتَى", "أُمَّتِي"),
    (1651, "reviewed", "أُمَّتَى", "أُمَّتِي"),
    (1697, "reviewed", "وَفِتْنَةً أُمَّتَى", "وَفِتْنَةُ أُمَّتِي"),
    (1229, "reviewed", "عَلَى يَدَى", "عَلَى يَدِي"),
    (1229, "reviewed", "قَدَمَى", "قَدَمَيَّ"),
    (1609, "reviewed", "إحْدَى يَدَى", "إحْدَى يَدَيَّ"),
    (1871, "reviewed", "بَيْتَى", "بَيْتِي"),
    (1171, "reviewed", "صَوْتَى", "صَوْتِي"),
    (1886, "reviewed", "بَعْدَى", "بَعْدِي"),
    (1563, "reviewed", "أَخَى", "أَخِي"),
    (1141, "reviewed", "خَلْفَى", "خَلْفِي"),
    (1634, "reviewed", "بَصَرَى", "بَصَرِي"),
    (1253, "reviewed", "لِقَوْمَى", "لِقَوْمِي"),
    (1330, "reviewed", "دَعَانَى", "دَعَانِي"),
    (268, "reviewed", "دَفَنْتُمُونَى", "دَفَنْتُمُونِي"),
    (1864, "reviewed", "وَيَقْطَعُونَى", "وَيَقْطَعُونِي"),
    (1802, "reviewed", "أَحْيِنَى", "أَحْيِنِي"),
    (1855, "reviewed", "أَوْصِنَى", "أَوْصِنِي"),
    (1367, "reviewed", "الْقِنَى", "الْقَنِي"),
    (1367, "reviewed", "بِأَبَى", "بِأَبِي"),
    (1366, "reviewed", "وَأَبَى الدَّرْدَاءَ", "وَأَبِي الدَّرْدَاءِ"),
    # active verbs the diacritizer made passive, or gave a fatha
    (148, "reviewed", "ثُمَّ يُصَلَّى مَا", "ثُمَّ يُصَلِّي مَا"),
    (425, "reviewed", "كَانَ يُصَلَّى", "كَانَ يُصَلِّي"),
    (426, "reviewed", "لَا يُصَلَّى إلَّا", "لَا يُصَلِّي إلَّا"),
    (438, "reviewed", "كَانَ يُصَلَّى", "كَانَ يُصَلِّي"),
    (1789, "reviewed", "كَمَا نُصَلَّى", "كَمَا نُصَلِّي"),
    (1239, "reviewed", "تُصَلَّى عَلَيْهَا", "تُصَلِّي عَلَيْهَا"),
    (1365, "reviewed", "كُنْتُ أَصْلَى", "كُنْتُ أُصَلِّي"),
    (1769, "reviewed", "مُحَمَّدًا يُعْطَى", "مُحَمَّدًا يُعْطِي"),
    (1850, "reviewed", "مَا لَا يُعْطَى عَلَى الْعُنْفِ", "مَا لَا يُعْطِي عَلَى الْعُنْفِ"),
    (1850, "reviewed", "وَمَالًا يُعْطَى", "وَمَا لَا يُعْطِي"),
    (76, "reviewed", "يُكْفَى", "يَكْفِي"),
    (71, "reviewed", "لَا يُدْرَى", "لَا يَدْرِي"),
    (72, "reviewed", "لَا يُدْرَى", "لَا يَدْرِي"),
    (1868, "reviewed", "يُنَاجَى رَبُّهُ", "يُنَاجِي رَبَّهُ"),
    (1777, "reviewed", "يَرْبَى", "يُرَبِّي"),
    (1247, "reviewed", "يَشْفَى", "يَشْفِي"),
    (1668, "reviewed", "يُبْكَى", "يَبْكِي"),
    (1638, "reviewed", "يُحْكَى", "يَحْكِي"),
    (1238, "reviewed", "أَمْشَى", "أَمْشِي"),
    (1773, "reviewed", "يُتَّقَى فِيهِ رَبِّهِ", "يَتَّقِي فِيهِ رَبَّهُ"),
    (1223, "reviewed", "يَرْثَى", "يَرْثِي"),
    (1344, "reviewed", "تُؤْذَى", "تُؤْذِي"),
    (1337, "reviewed", "أَيَأْتَى", "أَيَأْتِي"),
    (1261, "reviewed", "تَأَتَّى", "تَأْتِيَ"),
    (1692, "reviewed", "نُغَطَّى", "نُغَطِّيَ"),
    (1775, "reviewed", "لَا تُوكَى", "لَا تُوكِي"),
    (7, "reviewed", "فَاتَّقَى اللَّهَ وَاصْبَرَى", "فَاتَّقِي اللَّهَ وَاصْبِرِي"),
    (1737, "reviewed", "هَلُمَّى", "هَلُمِّي"),
    (92, "reviewed", "نَسَى", "نَسِيَ"),
    (1712, "reviewed", "بَقَّى", "بَقِيَ"),
    (1690, "reviewed", "فَفَنَى", "فَفَنِيَ"),
    (1613, "reviewed", "وَشِقَى أُمِّ سَعِيدٍ", "وَشَقِيٌّ أَمْ سَعِيدٌ"),
    (1312, "reviewed", "مِنْ عَادَى", "مَنْ عَادَى"),
    # «هِيَ»
    (21, "reviewed", "إنَّمَا هَى", "إنَّمَا هِيَ"),
    (1188, "reviewed", "فَإِذَا هَى", "فَإِذَا هِيَ"),
    (1227, "reviewed", "الصَّلَاةُ هَى", "الصَّلَاةُ هِيَ"),
    (97, "reviewed", "وَهَى لَكُمْ", "وَهِيَ لَكُمْ"),
    (1239, "reviewed", "وَهَى حُبْلَى", "وَهِيَ حُبْلَى"),
    (1261, "reviewed", "وَهَى أُمُّ", "وَهِيَ أُمُّ"),
    # nisbas and other ya-words read with a fatha
    (8, "reviewed", "الْبُخَارَىُّ", "الْبُخَارِيُّ"),
    (96, "reviewed", "الْبُخَارَى", "الْبُخَارِيُّ"),
    (111, "reviewed", "الْبُخَارَى", "الْبُخَارِيُّ"),
    (1852, "reviewed", "الْبُخَارَى", "الْبُخَارِيُّ"),
    (1893, "reviewed", "الْبُخَارَى", "الْبُخَارِيُّ"),
    (47, "reviewed", "الْأَنْصَارَى", "الْأَنْصَارِيَّ"),
    (1221, "reviewed", "الْأَنْصَارَى", "الْأَنْصَارِيِّ"),
    (1232, "reviewed", "الْأَنْصَارَى", "الْأَنْصَارِيِّ"),
    (1626, "reviewed", "الْخُدْرَى", "الْخُدْرِيِّ"),
    (1633, "reviewed", "الْخُدْرَى", "الْخُدْرِيِّ"),
    (1619, "reviewed", "الرَّاوَى", "الرَّاوِي"),
    (1633, "reviewed", "الرَّاوَى", "الرَّاوِي"),
    (118, "reviewed", "الْغِفَارَى", "الْغِفَارِيُّ"),
    (118, "reviewed", "الْأَسْدَى", "الْأَسَدِيُّ"),
    (215, "reviewed", "الدَّاعَى", "الدَّاعِي"),
    (1323, "reviewed", "الْأَسْلَمَى", "الْأَسْلَمِيِّ"),
    (1231, "reviewed", "الْمُزَنَى", "الْمُزَنِيِّ"),
    (1239, "reviewed", "الْخُزَاعَى", "الْخُزَاعِيُّ"),
    (1368, "reviewed", "الْأُسَيْدَى", "الْأُسَيِّدِيِّ"),
    (1698, "reviewed", "الْبَلْخَى", "الْبَلْخِيَّ"),
    (1812, "reviewed", "السَّعْدَى", "السَّعْدِيِّ"),
    (1874, "reviewed", "الْأَزْدَى", "الْأَزْدِيِّ"),
    (1652, "reviewed", "الْحَقِيقَى", "الْحَقِيقِيَّ"),
    (1238, "reviewed", "نَبْطَى", "نَبَطِيٌّ"),
    (52, "reviewed", "مَخْشَى", "مَخْشِيٍّ"),
    (128, "reviewed", "الْأَشْعَرَىِّ", "الْأَشْعَرِيِّ"),
    (1225, "reviewed", "الْأَشْعَرَىِّ", "الْأَشْعَرِيِّ"),
    (63, "reviewed", "وَحَشَىِّ بْنُ حَرْبٌ", "وَحْشِيِّ بْنِ حَرْبٍ"),
    (1236, "reviewed", "أَعْرَابَىٌّ", "أَعْرَابِيٌّ"),
    (1236, "reviewed", "جَهْوَرَىٌّ", "جَهْوَرِيٌّ"),
    (1236, "reviewed", "الْأَعْرَابَىُّ", "الْأَعْرَابِيُّ"),
    (1247, "reviewed", "صَبَّى", "صَبِيٌّ"),
    (1872, "reviewed", "خَلْفَهُ نَبَّى", "خَلَفَهُ نَبِيٌّ"),
    (1884, "reviewed", "أَى خَفِيفًا", "أَيْ خَفِيفًا"),
    (1804, "reviewed", "كَالرَّاعَى", "كَالرَّاعِي"),
    (1612, "reviewed", "الْوَحَى", "الْوَحْيَ"),
    (1762, "reviewed", "عَدَّى", "عَدِيِّ"),
    (1680, "reviewed", "بِجَدًى", "بِجَدْيٍ"),
    # alef maqsura words with a wrong vowel before it
    (1129, "reviewed", "فَرَسَى", "فَرْسَى"),
    (866, "reviewed", "أَفْرَى الْفَرَى", "أَفْرَى الْفِرَى"),
]}

R_RIDA = re.compile(f"{START}(ر{M}ض{M}ى{M})(\\s+)(ا{M}ل{M}ل{M}ه{M})(?=\\s)")
R_KUNYA = re.compile(f"({START}(?:و{M})?ع{M}ن{M}|{START}(?:ا{M})?ب{M}ن{M})(\\s+)(أ{M}ب{M}ى{M})(\\s+)(\\S+)")
R_HONORIFIC = re.compile(f"{word('وسلم')}ى\\s+{word('الله')}\\s+{word('عليه')}\\s+({word('وسلم')})")
R_HATTA = re.compile(f"{START}ح{M}ت{M}([يى]){M}{END}")
R_CITATION = re.compile(f"{START}(?:\\(\\(\\s*)?(?:{word('رواه')}|{word('رويناه')}|{word('متفق')}\\s+{word('عليه')}){END}")
# A grading that opens the citation («حَدِيثٌ حَسَنٌ، رَوَاهُ …»): the full stop goes before it,
# unless it is quoted («وَقَالَ: حَدِيثٌ حَسَنٌ»), closing an earlier citation.
R_GRADING = re.compile(f"{START}(?:\\(\\(\\s*)?{word('حديث')}\\s+(?:{word('حسن')}|{word('صحيح')})"
                       f"(?:\\s+{word('صحيح')})?\\s*[،,.]?\\s*(?:\\(\\(\\s*)?$")
R_QUOTED = re.compile(f"(?:^|\\s)(?:[وف]{M})?{word('قال')}\\s*:?\\s*$")
WORD = re.compile(f"[{LETTER}ً-ْٰـ]+")
SENTENCE_END = ".!؟?؛:…"


def N(s: str) -> str:
    """For comparing spellings only: marks in one canonical order. Never written back,
    since it also splits hamza letters («أ» → «ا» + hamza)."""
    return unicodedata.normalize("NFD", s)


def canon(s: str) -> str:
    """The corpus's mark order: shadda first on a letter, then its vowel."""
    return re.sub("([ً-ِْ])ّ", "ّ\\1", s)


def loose(s: str) -> str:
    """A regex for `s` that accepts its marks in any order on each letter."""
    out, i = [], 0
    while i < len(s):
        ch, i = s[i], i + 1
        marks = ""
        while i < len(s) and s[i] in MARKS:
            marks, i = marks + s[i], i + 1
        perms = sorted({"".join(p) for p in permutations(marks)})
        out.append(re.escape(ch) + (f"(?:{'|'.join(map(re.escape, perms))})" if marks else ""))
    return "".join(out)


def bare(s: str) -> str:
    """Letters only, with ya and hamza seats folded, to check a fix changed no wording."""
    s = re.sub(f"{MARK}|[\\s.،]", "", s).replace("ى", "ي")
    return re.sub("[أإآ]", "ا", s)


def corpus_spelling(texts: dict[int, str], target: str) -> str:
    """The corpus's own mark order for a correct word, so fixes match the text around them."""
    seen = Counter()
    rx = re.compile(START + "".join(f"{ch}{M}" for ch in re.sub(MARK, "", target)) + END)
    for text in texts.values():
        seen.update(m.group(0) for m in rx.finditer(text) if N(m.group(0)) == N(target))
    return seen.most_common(1)[0][0] if seen else canon(target)


def fix(book: str, texts: dict[int, str]) -> tuple[dict[int, str], list[dict]]:
    """Apply every rule in order; returns the new texts and one log entry per change."""
    out, log = dict(texts), []
    radiya, allahu, abi, hatta = (corpus_spelling(texts, w) for w in ("رَضِيَ", "اللَّهُ", "أَبِي", "حَتَّى"))
    names = {N(k): corpus_spelling(texts, v) for k, v in KUNYA_NAMES.items()}

    def apply(number, rule, rx, repl):
        def sub(m):
            new = repl(m) if callable(repl) else m.expand(repl)
            if new != m.group(0):
                log.append({"hadith": number, "rule": rule, "before": m.group(0), "after": new})
            return new
        out[number] = rx.sub(sub, out[number])

    for number in out:
        # 1. case endings of fixed formulas
        for rule, rx, repl, only in PHRASES:
            if only is None or number in only.get(book, ()):
                apply(number, rule, rx, repl)

        # 2. the source's dotless ya read as other words
        def rida(m):
            if not N(m.group(1)).startswith(N("رِ")):
                return m.group(0)
            return radiya + m.group(2) + allahu
        apply(number, "dotless-radiya", R_RIDA, rida)

        def kunya(m):
            if N("بَ") not in N(m.group(3)):
                return m.group(0)
            name = m.group(5)
            lead = re.match(f"[{LETTER}ً-ْٰ]+", name)
            if lead and N(lead.group(0)) in names:
                name = names[N(lead.group(0))] + name[lead.end():]
            return m.group(1) + m.group(2) + abi + m.group(4) + name
        apply(number, "dotless-kunya", R_KUNYA, kunya)

        # 3. source corruptions
        apply(number, "repeated-honorific", R_HONORIFIC, "\\1")
        # «حتى» spelt with a dotted ya, or given the marks of another word
        def hatta_word(spelt_ya):
            return lambda m: hatta if (m.group(1) == "ي") == spelt_ya and N(m.group(0)) != N(hatta) else m.group(0)
        apply(number, "source-typo", R_HATTA, hatta_word(True))
        apply(number, "garbled-alif-maqsura", R_HATTA, hatta_word(False))

    # 3–4. the reviewed table
    for number, rule, before, after in TABLES.get(book, []):
        if re.search(loose(before), out[number]):
            apply(number, rule, re.compile(loose(before)), lambda m, a=canon(after): a)
        elif not re.search(loose(after), out[number]):
            sys.exit(f"{number}: «{before}» not found")

    for number in out:
        # 5. a final ى read as a ya
        def ya(m):
            letters = list(m.group(0))
            for i, ch in enumerate(letters):
                if ch != "ى":
                    continue
                own = ""
                j = i + 1
                while j < len(letters) and letters[j] in MARKS:
                    own += letters[j]
                    j += 1
                k = i - 1
                prev = ""
                while k >= 0 and letters[k] in MARKS:
                    prev = letters[k] + prev
                    k -= 1
                after_alef = k >= 0 and letters[k] == "ا" and not prev
                if own.replace("ٰ", "") or KASRA in prev or after_alef:
                    letters[i] = "ي"
            return "".join(letters)
        apply(number, "dotless-ya", WORD, ya)

        # 6. a full stop before the closing citation
        text = out[number]
        for m in reversed(list(R_CITATION.finditer(text))):
            start = m.start()
            graded = R_GRADING.search(text, 0, start)
            if graded and not R_QUOTED.search(text, 0, graded.start()):
                start = graded.start()
            k = start - 1
            while k >= 0 and text[k].isspace():
                k -= 1
            if k < 0 or text[k] in SENTENCE_END or text[k] == "(":
                continue
            w = k                                  # the log shows the whole word before it
            while w > 0 and not text[w - 1].isspace():
                w -= 1
            before = text[w:m.end()]
            if text[k] in "،,":                 # a comma before it becomes the full stop
                text = text[:k] + "." + text[k + 1:]
                after = text[w:m.end()]
            else:
                text = text[:k + 1] + "." + text[k + 1:]
                after = text[w:m.end() + 1]
            log.append({"hadith": number, "rule": "citation-stop", "before": before, "after": after})
        out[number] = text

    # A fix changes marks, a dotless ya, a hamza seat or punctuation, never the wording;
    # only the repeated honorific loses its repeated half.
    for e in log:
        if e["rule"] != "repeated-honorific" and bare(e["before"]) != bare(e["after"]):
            sys.exit(f"{e['hadith']}: {e['rule']} changes the wording: «{e['before']}» → «{e['after']}»")
    return out, log


def load(book: str, rev: str | None = None) -> tuple[dict[int, Path], dict[int, str]]:
    files, texts = {}, {}
    for fp in sorted((ROOT / "content/books" / book / "hadith").glob("*.json")):
        if rev:
            raw = subprocess.run(["git", "show", f"{rev}:{fp.relative_to(ROOT)}"], cwd=ROOT,
                                 capture_output=True, text=True, check=True).stdout
        else:
            raw = fp.read_text(encoding="utf-8")
        doc = json.loads(raw)
        if doc["matn"].get("diacritized"):
            files[doc["number"]], texts[doc["number"]] = fp, doc["matn"]["diacritized"]
    return files, texts


def write_log(book: str, log: list[dict], baseline: str | None) -> Path:
    path = ROOT / "content/books" / book / "reading-text-fixes.json"
    old = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
    entries = log if baseline else old.get("fixes", []) + log
    counts = Counter(e["rule"] for e in entries)
    doc = {
        "about": "Corrections to matn.diacritized, the reading text; matn.arabic is the source "
                 "verbatim. Made by pipeline/diacritize/fix_reading_text.py.",
        "baseline": baseline or old.get("baseline"),
        **({"notes": NOTES[book]} if book in NOTES else {}),
        "rules": {rule: {"description": text, "count": counts[rule]} for rule, text in RULES.items()},
        "fixes": sorted(entries, key=lambda e: (e["hadith"], list(RULES).index(e["rule"]))),
    }
    path.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return path


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--book", required=True)
    ap.add_argument("--apply", action="store_true", help="write the corrected text and the log")
    ap.add_argument("--baseline", help="git revision of the uncorrected machine-diacritized text: "
                    "rebuild the whole log from it, and check it gives the same text")
    ap.add_argument("--rebuild", action="store_true",
                    help="with --baseline, after changing a rule: write the text rebuilt from the baseline")
    args = ap.parse_args()

    files, texts = load(args.book)
    fixed, log = fix(args.book, texts)
    for rule, count in Counter(e["rule"] for e in log).most_common():
        print(f"{rule}: {count}")

    if args.baseline:
        _, base = load(args.book, args.baseline)
        rebuilt, log = fix(args.book, base)
        differ = [n for n in fixed if rebuilt.get(n) != fixed[n]]
        if differ and not args.rebuild:
            sys.exit(f"the rules applied to {args.baseline} differ from the current text in {differ[:10]}; "
                     "if a rule changed, write the rebuilt text with --rebuild")
        if differ:
            print(f"rebuilt from {args.baseline}; differs from the rules applied to the current text in "
                  f"{len(differ)} hadiths: {differ}")
            fixed = {n: rebuilt.get(n, fixed[n]) for n in fixed}
        else:
            print(f"rules applied to {args.baseline} give the corrected text exactly")
        print(f"{len(log)} fixes logged")

    changed = sorted(n for n in fixed if fixed[n] != texts[n])
    print(f"hadiths changed: {len(changed)}" + ("" if args.apply else " (dry run)"))
    if args.apply:
        for number in changed:
            fp = files[number]
            doc = json.loads(fp.read_text(encoding="utf-8"))
            doc["matn"]["diacritized"] = fixed[number]
            fp.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        if log:
            print("log:", write_log(args.book, log, args.baseline).relative_to(ROOT))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
