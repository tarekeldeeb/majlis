# Commentary drafting style guide (Riyad al-Salihin)

This guide is for drafting the Arabic commentary fields (`adab`, `fawaid`,
`meaning`, `relatedAyat`, `sources`) for one hadith at a time. The output feeds
the TTS pipeline, so it is written to be read aloud.

## Guardrails

- **No fatwas.** State meanings and lessons from the cited sharḥ; do not rule on
  contemporary cases or add personal legal judgments.
- **Ground every substantive claim in the provided reference.** Paraphrase; never
  copy the sharḥ verbatim and never invent an attribution, page, or quotation.
- **If the reference is marked `مطابقة تقريبية`** (approximate), it may not contain
  this hadith's commentary. In that case draft only the plain meaning and lessons
  visible in the matn, keep the claims general, and cite the book/chapter rather
  than the sharḥ's specific discussion.
- **Arabic only**, no Latin text, no markdown, no bullet characters.

## Output shape

A JSON object keyed by the hadith number as a string:

```json
{
  "14": {
    "adab": ["…", "…"],
    "fawaid": ["…", "…", "…"],
    "meaning": "…",
    "relatedAyat": [],
    "sources": ["…"]
  }
}
```

- `adab`: 2–4 short sentences. Practical manners or responses the hadith teaches.
- `fawaid`: 2–4 short sentences. Benefits, principles, or doctrinal points.
- `meaning`: 2–4 sentences. A connected read-aloud summary; mention the narrator
  or occasion only when the reference states it.
- `relatedAyat`: `[]` unless the reference explicitly cites an āyah that is
  directly relevant. If used, each item is `{"ref": "سورة:آية", "text": "…"}`.
- `sources`: one or two strings naming the grounding work and the book/chapter.

## Style

- Short, clear sentences suitable for listening; avoid long nested clauses.
- Classical, respectful register; no colloquialisms.
- Prefer concrete wording over ornament.
- Use `ﷺ` after the Prophet's name, as in the existing corpus.
- **Fully diacritize every field.** The TTS pipeline reads this text directly.
  A QA pass checks diacritic density; strings below the threshold are
  re-diacritized automatically. Do not leave ordinary words undiacritized.
- Do not quote the sharḥ's exact sentences. Summarize and rephrase.

## Worked example (hadith 14)

Matn: «والكلمة الطيبة صدقة».

```json
{
  "14": {
    "adab": [
      "بَذْلُ الْكَلِمَةِ الطَّيِّبَةِ لِلنَّاسِ عِنْدَ كُلِّ لِقَاءٍ.",
      "اعْتِبَارُ حُسْنِ الْكَلَامِ صَدَقَةً يُرْجَى ثَوَابُهَا لَا مُجَرَّدَ مُجَامَلَةٍ."
    ],
    "fawaid": [
      "الْكَلِمَةُ الطَّيِّبَةُ صَدَقَةٌ يُثَابُ عَلَيْهَا الْمُسْلِمُ وَإِنْ لَمْ يُنْفِقْ مَالًا.",
      "أَبْوَابُ الصَّدَقَةِ وَاسِعَةٌ تَشْمَلُ الْقَوْلَ كَمَا تَشْمَلُ الْمَالَ.",
      "حُسْنُ الْخُلُقِ مِنْ عَلَامَاتِ كَمَالِ الْإِيمَانِ؛ فَأَكْمَلُ الْمُؤْمِنِينَ إِيمَانًا أَحْسَنُهُمْ خُلُقًا."
    ],
    "meaning": "أَكَّدَ النَّبِيُّ ﷺ أَنَّ الْكَلِمَةَ الطَّيِّبَةَ صَدَقَةٌ، تَكْمِيلًا لِمَا سَبَقَ مِنَ الْحَثِّ عَلَى بَذْلِ الْخَيْرِ وَلَوْ بِالْقَوْلِ الْحَسَنِ عِنْدَ الْعَجْزِ عَنِ الْمَالِ؛ فَحُسْنُ الْكَلَامِ عِبَادَةٌ مَأْجُورَةٌ يَقْدِرُ عَلَيْهَا كُلُّ مُسْلِمٍ.",
    "relatedAyat": [],
    "sources": [
      "شرح رياض الصالحين للشيخ محمد بن صالح العثيمين رحمه الله — باب استحباب طيب الكلام وطلاقة الوجه عند اللقاء"
    ]
  }
}
```

## Source strings

- Exact reference: `شرح رياض الصالحين للشيخ محمد بن صالح العثيمين رحمه الله — {book/chapter}`
- Approximate reference: `رياض الصالحين للإمام النووي — {book/chapter} (المعنى العام)`
