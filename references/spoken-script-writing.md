# Spoken script writing

`narrative-planning-rules.md` decides the arc and scenes. This file covers the sentences themselves: a script is heard once, at speaking speed, with no way to look back. Use it as a checklist after the first draft, not as a template; fixed sentence patterns make every video sound alike.

## Write for the viewer, then check against the source

A source article is ordered for its own purposes (a press release lists features, a report lists findings). Do not follow that order by default. Draft the viewer's questions first, then order the script by them:

1. What changed, and why does it touch me?
2. When?
3. What is the catch (risk, privacy, cost)?
4. Who is it for, and who is excluded?
5. What do you think, and what should I watch next?

Keep only the questions this topic actually raises. The source stays the authority for facts; the viewer's questions decide order and emphasis.

## Checklist

- **Hook.** The first sentence says what the viewer gains, loses or can now do. A restated headline or a date plus an announcement is a weak opening; the date can follow in the second sentence.
- **Signpost parallel items.** Three or more parallel items: say the count first ("三个入口"), then go through them, or merge them into one frame. Do not read a feature list sentence by sentence with the same sentence shape.
- **One new fact per sentence.** Dates, numbers and conditions each get their own short sentence. A long qualifying clause cannot be reread by the listener. Aim for sentences that fit in one breath, roughly 25 characters or fewer.
- **One idea per paragraph.** A paragraph blank line is a pause and a likely caption break; give each a single purpose.
- **Separate fact, context and judgment.** Introduce a judgment with words like 我的判断; never let an inference sound like reported fact. Do not state a stronger claim than the source: "部分" stays "部分", "可能" stays "可能".
- **Context only if sourced.** Background that makes the news matter is valuable, but it needs its own source, and its absence in the day's source should be disclosed to the user rather than filled from memory.
- **End on something observable.** Finish with a judgment plus what to watch next. A generic summary ("关键在入口") leaves the viewer with nothing.
- **Hear it.** Check numbers, English terms and polyphones against `pronunciation-rules.md` before voicing.

## Automatic audit

```bash
node scripts/audit-script.mjs <approved-script.md> [--headline="新闻标题"] [--target=60]
```

It estimates duration from Chinese character count and warns on: an opening that is a date/event or repeats the headline, overlong sentences, three or more consecutive sentences sharing the same opening words, number/date-dense sentences, and an ending without a judgment or watch point. It exits non-zero only for an empty script. Warnings need an authored fix or a stated reason; the audit cannot judge accuracy, relevance or taste, and it is not part of the `run-job.mjs` gates.

Present the checked draft, not the first draft, when the user is asked to confirm a script before voicing.
