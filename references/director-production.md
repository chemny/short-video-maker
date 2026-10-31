# Director production and one entry

Use `scripts/run-job.mjs JOB --tts=none --preview-video` for protected imported narration or omit tts=none for authorized synthesis. Topic research/script authorship remains Agent work; the video plan is created early and updated. New briefs declare reviewed-v1; production must supply explicit director-v1 decisions. No technical JSON can prove semantic intent or listening.

The brief intentionally does not preselect a template. This first Director rollout supports the explicit portrait directed-news candidate or a compatible authored Remotion composition. Existing templates remain available under their existing contracts; they have not all acquired authored Director cue rendering or verified new aspect support. Do not label those legacy paths as director-v1 merely to pass the new brief.

## Author, then compile

Keep sentence-storyboard.json as the single authored board. Add directorVersion:1, and for each caption row: understanding (what the viewer should grasp), visualContribution (what the picture adds), claimType (fact/opinion/context/instruction/historical-example). Shots add recipe, revealPolicy (context-first/spoken-cues), motionPurpose and bounded recipe content. Use `{captionId,edge:"start"|"end",offsetSeconds:0}` for every at/*At event, including item events. Cues must belong to captions covered by that shot and remain inside actual caption intervals. Explicit context may appear before it is spoken. Do not infer cue times from list index; hold emphasis until shot exit.

Select style.template=directed-news, meta.directorVersion=director-v1, productionWorkflow=reviewed-v1, style.layoutReadability=phone-v1, componentSystem=off, no extra cover intro. Supported recipes are media, question, list, evidence, keyword, comparison, steps, ability, distinction, ending, statement and time-budget. Candidate currently supports1080x1920/30fps only. Actual official media and dated evidence remain mandatory where used; recipe names do not justify the claim. Compile happens in the runner after timing repair, before component selection, evidence audits and preview. Do not hand-edit derived directorRender.

## Content gate

`compileDirector` also audits decisions, not only field presence: `understanding` and `visualContribution` must differ, be substantive, not merely repeat the narration, and not repeat across more than 40% of rows (errors). Warnings (in `director-report.json` and the console) flag a `reason` copied from `understanding` on every row, one shared `motionPurpose` across shots, and persistent `title`/`kicker` text visible from the shot start whose wording is first spoken later in that shot. Warnings need an authored fix or a justification; the gate cannot judge relevance, taste or listening.

## Template and authored renderer

Template rendering identifies actual template/composition in preview metadata. An authored job can instead declare meta.renderSource `{kind:"authored-remotion",entry:"src/index.tsx",composition:"MyFilm",layoutProtocol:"svm-layout-v1"}` and optional coverComposition. Entry is confined to the job. It must consume the canonical plan and authored board, expose shared LayoutAudit measurements under style.layoutAudit, use job-local media and the shared audio pipeline. Otherwise common layout inspection blocks; it cannot claim a built-in template made its picture. Existing runtimes are reused; no installers or arbitrary shell command hooks are launched.

Both go through the same plan/audio/Director/evidence checks, measured layout, complete preview identity, review gate, final mux and QC. Direct raw Remotion commands remain debugging tools, not evidence that the production flow ran.

## Real preview review

New reviewed-v1 plans always produce a complete preview first. `--render --confirmed-render` returns preview-review-required without archiving existing deliveries if no matching passed review exists. This is an explicit pending stage, not a failed render or a claimed accepted HD output. Preview generation never records its own approval.

After actual review, author a JSON with reviewer, notes and checks. Each of semanticsClear, visualRelevance, layoutReadable, captionSync and narrationIntelligible requires `{status:"passed"|"needs-fix"|"not-performed",notes:"what was actually checked"}`. Bind it using `node scripts/record-preview-review.mjs JOB actual-review.json`. Missing/unfinished listening is explicitly not-performed. Changed plan/media/code invalidates the preview and review automatically. The ordinary render command then resumes. Respect an explicit user request to see the preview before further production; otherwise Agent may complete actual review autonomously within authorized scope.

Geometry/code/ASR tests do not justify a listening pass. A preview can be delivered to the user while review remains pending. Preserve approved voice/script during visual iteration; revised speech requires new alignment and cue compilation.

## Readability

phone-v1 measures actual text font including ancestor transforms at390px reference width. Minimum title18px, body15px, caption16px, source10px; these are rejection floors, not beauty scores. Inspect actual screenshots for crowded layouts, weak contrast and unreadable detail inside source images. Intentional media crops never exempt clipped text. Legacy jobs keep compatibility checks unless explicitly migrated.
