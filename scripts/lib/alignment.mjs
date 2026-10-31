// Match approved text to observed ASR word boundaries. No proportional retiming.
export const normalized = (value) => [...String(value ?? '').normalize('NFKC').toLowerCase()].filter((c) => /[\p{L}\p{N}]/u.test(c)).join('');
export const alignCaptions = (captions, transcript, duration, {captionTexts, wordTexts} = {}) => {
  if (!Array.isArray(captions) || !captions.length) throw new Error('Approved captions are required');
  const words = transcript.words;
  if (!Array.isArray(words) || !words.length) throw new Error('Transcript must contain actual word timestamps');
  let previous = 0;
  for (const w of words) {
    if (![w.start, w.end, w.probability].every(Number.isFinite) || w.start < 0 || w.end < w.start || w.end > duration + 0.1 || w.start < previous - 0.02) throw new Error('Invalid/non-monotonic ASR word timestamps or missing probability');
    previous = w.end;
  }
  const reference = captions.map((c, i) => normalized(captionTexts?.[i] ?? c.text));
  if (reference.some((text) => !text)) throw new Error('Empty approved caption');
  const a = [...reference.join('')];
  const observed = words.flatMap((word, wordIndex) => [...normalized(wordTexts?.[wordIndex] ?? word.word)].map((char) => ({char, wordIndex})));
  const b = observed.map((x) => x.char);
  if (!a.length || !b.length || a.length * b.length > 25000000) throw new Error('Text is empty or too long for short-video alignment');
  const width = b.length + 1;
  const table = new Uint16Array((a.length + 1) * width);
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    table[i * width + j] = a[i - 1] === b[j - 1] ? table[(i - 1) * width + j - 1] + 1 : Math.max(table[(i - 1) * width + j], table[i * width + j - 1]);
  }
  const matches = new Map(); const used = new Set();
  let i = a.length; let j = b.length;
  while (i && j) {
    if (a[i - 1] === b[j - 1]) {matches.set(i - 1, j - 1); used.add(j - 1); i--; j--;}
    else if (table[(i - 1) * width + j] >= table[i * width + j - 1]) i--;
    else j--;
  }
  let cursor = 0;
  const issues = [];
  const proposed = captions.map((caption, index) => {
    const mapped = [...reference[index]].map((_, k) => matches.get(cursor + k)).filter((k) => k !== undefined);
    cursor += reference[index].length;
    const selected = [...new Set(mapped.map((k) => observed[k].wordIndex))].map((k) => words[k]);
    const coverage = mapped.length / reference[index].length;
    const probability = selected.length ? Math.min(...selected.map((w) => w.probability)) : 0;
    if (coverage !== 1) issues.push({captionId: caption.id, code: 'missing-or-misread-text', coverage});
    if (probability < 0.35) issues.push({captionId: caption.id, code: 'low-asr-probability', probability});
    if (selected.length && (selected[0].start === selected[0].end || selected.at(-1).start === selected.at(-1).end)) issues.push({captionId: caption.id, code: 'ambiguous-zero-duration-boundary'});
    return {...caption, start: selected[0]?.start ?? null, end: selected.at(-1)?.end ?? null, alignment: {coverage, minimumWordProbability: probability}};
  });
  for (let k = 1; k < proposed.length; k++) if (proposed[k].start < proposed[k - 1].end) issues.push({captionId: proposed[k].id, code: 'shared-word-or-overlapping-cues'});
  const unmatched = b.filter((_, k) => !used.has(k)).join('');
  if (unmatched) issues.push({code: 'extra-or-repeated-speech', text: unmatched});
  return {method: 'asr-word-boundary-matching', status: issues.length ? 'needs-review' : 'matched', proposed, issues,
    transcriptText: transcript.text, limits: ['ASR timestamps are estimates, not acoustic forced alignment', 'No proportional fallback; unmatched or uncertain speech blocks automatic application']};
};

export const retimeScenes = (scenes, captions, duration) => {
  let cursor = 0;
  const grouped = scenes.map((scene) => {
    const ids = scene.captionIds;
    let group;
    if (ids) {
      group = ids.map((id) => captions.find((c) => c.id === id));
      if (!group.length || group.some((c) => !c) || group.some((c, index) => c.id !== captions[cursor + index]?.id)) throw new Error(`Scene ${scene.id}: captionIds must partition captions in order`);
    } else {
      group = [];
      let text = '';
      while (cursor + group.length < captions.length && text.length < normalized(scene.voiceover).length) {
        const caption = captions[cursor + group.length]; group.push(caption); text += normalized(caption.text);
      }
      if (text !== normalized(scene.voiceover)) throw new Error(`Scene ${scene.id}: provide explicit captionIds for its approved narration`);
    }
    cursor += group.length;
    return {scene, group};
  });
  if (cursor !== captions.length) throw new Error('Scenes do not cover all approved captions');
  return grouped.map(({scene, group}, index) => ({...scene, captionIds: group.map((c) => c.id),
    start: index === 0 ? 0 : group[0].start, end: grouped[index + 1]?.group[0].start ?? duration}));
};
