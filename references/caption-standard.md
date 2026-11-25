# Caption standard (burned-in Chinese captions)

Applies to every shot film. Code: `scripts/lib/caption-style.mjs`; enforced at compile (text, gaps, durations), at narration planning (phrase length) and in the review loop (`captionStyle` check). The standard follows Netflix's published Simplified Chinese (PRC) Timed Text Style Guide and its subtitle timing guidelines, adapted to a 1080 px vertical frame. Sources read on 2026-11-18:

- Simplified Chinese (PRC) Timed Text Style Guide: https://partnerhelp.netflixstudios.com/hc/en-us/articles/215986007-Chinese-Simplified-Timed-Text-Style-Guide
- Subtitle Timing Guidelines: https://partnerhelp.netflixstudios.com/hc/en-us/articles/360051554394-Timed-Text-Style-Guide-Subtitle-Timing-Guidelines

## Rules we enforce

| Rule | Netflix | Here |
|---|---|---|
| Length | §1: 16 characters per line | 14 units per line. The safe caption width is 700 px (the button rail covers the right edge), 50 px type fits 14 full-width characters. A Han character is 1 unit, a Latin letter or digit about 0.55, a space 0.3 |
| Lines | §10: usually one line, two at most | **One line, always.** A sentence longer than one line becomes several caption events, split at clause punctuation first, then near the middle of a clause; a Latin word or number is never cut |
| Punctuation | §12: no commas or periods, use one single space | `，` `。` `；` become one space inside a caption and are removed at its end. A caption never ends with `、` `，` `。` `；` `：` |
| Enumeration | §12: `、` allowed in lists, not at the end of a line | kept inside a caption, removed at its end |
| Questions, emphasis | §12: question marks required, full-width `？` `！` when necessary | `?` `!` become `？` `！`; `!?` `??` `!!` collapse to one mark |
| Colon | §12: full-width colon to introduce speech or an explanation | kept as `：` when it is inside a caption |
| Ellipsis | §12: U+2026 | `...` and `。。。` become `…` |
| Quotes | §13: full-width, no spaces | straight `"..."` becomes `“...”` |
| Numbers | §11: half-width Arabic numerals, no comma in a four-digit number, no mixing with Chinese numerals | full-width digits and a comma inside four digits fail; mixed numerals warn |
| Reading speed | §14: up to 9 characters per second (adult programmes) | warning above 9 (spaces and punctuation are not counted) |
| Minimum duration | timing guidelines: 20 frames, 4/5 s at 24 fps | 0.83 s; a shorter caption is extended up to the next one |
| Gaps | timing guidelines: 2 frames; gaps of 3 to 11 frames at 24 fps are closed | a gap under 0.5 s is closed to 2 frames (0.067 s); longer gaps stay |
| Tail | timing guidelines: out-time ideally at least half a second after the audio | the last caption stays 0.5 s after its audio, within the film |

## What is not applied

Speaker dashes (§5), forced narratives and song rules (§7, §16), SDH variants (§19) and shot-change snapping do not apply to a one-voice narration with burned-in captions. Narration text itself is never changed: the standard is applied to the displayed caption and to `captions.srt`, while the voice and its alignment use the verbatim sentence. Phrase captions for alignment are split by the same rules, so each phrase is one caption.

## Check

`node scripts/review-shot-film.mjs <job> --narration` reports a `captionStyle` check: any violation of length, punctuation or numbers fails the film; reading speed, minimum duration and mixed numerals warn. Unit tests: `tests/caption-style.test.mjs`.
