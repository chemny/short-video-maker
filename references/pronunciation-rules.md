# Pronunciation Rules

Use these rules before TTS whenever the narration contains Chinese polyphones, names, product names, English terms, numbers, or acronyms.

## Preflight

1. Read `data/phonemes.template.json`.
2. Create a job-local `phonemes.json` only when the script needs overrides.
3. Add project-specific overrides under the job folder, not in shared templates.
4. Rewrite awkward lines before relying on pronunciation overrides.

## Common Risk Areas

- Chinese polyphones: 行, 重, 长, 乐, 便, 得, 为, 只.
- Names and companies: OpenAI, Anthropic, Cursor, Claude, GitHub, Remotion.
- Product abbreviations: API, LLM, RAG, MCP, TTS.
- Mixed Chinese and English: keep English terms short and pronounceable.
- Numbers and units: prefer spoken forms when the exact symbol may sound odd.

## Acceptance Rule

Before final TTS, mentally read the full narration once as a speaker. If a line is hard to say, rewrite it. A pronunciation dictionary should fix unavoidable names and polyphones, not rescue bad prose.

## Job-Local Override Shape

```json
{
  "terms": [
    {
      "text": "Claude",
      "pronunciation": "克劳德",
      "note": "Chinese narration"
    }
  ]
}
```
