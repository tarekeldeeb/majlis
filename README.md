# Majlis — مجلس

An open-source interactive hadith audiobook (web / iOS / Android). Majlis reads hadith books aloud; after each hadith it reads its manners (آداب), benefits (فوائد), and conclusive meaning (المعنى الإجمالي). Listeners can pause anytime and discuss the hadith with a grounded assistant that answers with cited, logical arguments — never fatwas.

Named after **مجالس السماع** — the traditional gatherings where hadith books were read aloud and discussed.

**Live app:** https://tarekeldeeb.github.io/majlis/

## Android Auto and Apple CarPlay

The iOS and Android apps bring Majlis to the car's screen, so a hadith session can be heard on the road with the car's own controls. (The web app has no car mode.)

### Features

- **Browse from the car.** Hadiths are listed by title — الحديث الأول، الحديث الثاني … — with the book's name beneath. All 42 hadiths of الأربعون النووية are narrated; Riyad al-Salihin's narration is still to come.
- **The full lesson, in order.** Choosing a hadith plays its number and matn, then its ādāb, fawāʾid, and meaning — each introduced by its spoken title — back to back, then goes straight on to the next hadith until the end of the book.
- **Your commentary choices carry over.** The car reads exactly the parts switched on in the phone's settings.
- **Now Playing.** The car shows the hadith and the section being read (e.g. الحديث الأول — نص الحديث), the book's name, a progress bar, and cover art carrying the hadith's own text.
- **Car controls.** Play/pause and next/previous section from the touchscreen or the steering-wheel buttons.
- **Phone and car in step.** A hadith started on the phone plays through the car. While a hadith is open in the phone app, the phone follows whatever the car plays — a hadith picked there, or the next one it moves on to — scrolls to the section being read, and marks each finished hadith done.
- **Runs without the phone UI.** The car browses and plays even when the app isn't open on the phone, and playback continues with the phone locked; the lock screen (and Android's media notification) shows the same title, artwork, and controls.
- **Offline.** Narration and artwork ship inside the app; no data connection is needed on the road.

### How to use

1. Install the app on the phone — it is named *Majlis Auto* on Android and *Majlis CarPlay* on iPhone — and open it once after installing or updating. That launch writes the hadith list the car reads; until then CarPlay shows only "افتح مجلس على الهاتف مرة واحدة" and Android Auto an empty list.
2. Optional: choose which commentary parts to hear under the gear icon on the home screen (الإعدادات → أجزاء الشرح الصوتي). The car follows the change straight away.
3. Connect the phone to the car, by cable or wirelessly, and open Majlis from the CarPlay or Android Auto app screen.
4. Tap a hadith to start it; CarPlay switches to its Now Playing screen. Next/previous move between the hadith's sections.
5. When a hadith ends, Majlis carries on with the next one by itself, phone app open or not. Keep a hadith open in the phone app to have each one marked done as you listen.

**Installing your own build:** Android Auto lists only apps installed from Google Play, so for a sideloaded APK turn on *Unknown sources* in Android Auto's developer settings (unlock them by tapping *Version* ten times in Android Auto's settings). On iPhone, CarPlay shows only builds signed with Apple's CarPlay audio entitlement (declared in `app/app.json`).

## Pipeline

1. Get the text
2. Add diacritization
3. Summarize ādāb, fawāʾid, and sharḥ
4. Generate the audio with TTS

## Layout

| Path | Purpose |
|---|---|
| `content/` | Reviewed content assets (books, commentary, review state) |
| `pipeline/` | Build-time scripts for the pipeline above |
| `docs/` | Content schema, review workflow, TTS evaluation |
| `app/` | React Native (Expo) app — Phase 1 |
| `server/` | Chat backend (LLM providers + MCP clients) — Phase 2 |

## Principles

- **Strictly open source / free components.** No paid or proprietary dependency anywhere.
- **Human-reviewed content only.** Every commentary segment is signed off by two reviewers (Dr Yasmeen Farouk, Tarek Eldeeb) before it ships. See `docs/review-workflow.md`.
- **Matn is immutable.** Hadith text is stored verbatim from its source and never machine-altered.
- **Arabic-first.** v1 is Arabic-only: content, audio, and UI (RTL).

See `CLAUDE.md` for full architecture and roadmap.

## License

Majlis is released under the **Waqf General Public License 2.0** (رخصة وقف العامّة) — the project is a perpetual endowment (وقف) for the benefit of all. The authoritative license text is the Arabic `LICENSE`; `LICENSE-en` is the informal English translation. See the [official Waqf license repository](https://github.com/ojuba-org/waqf).
