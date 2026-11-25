const han = (text) => (text.match(/[一-鿿]/g) ?? []).length;
const charsPerSecond = 4.7;
const maxSentence = 28;
const endingMarkers = /判断|接下来|值得|关注|观察|取决于|要看|看看/;
const dateOpening = /^\s*\d{1,2}月\d{1,2}日/;

const bigrams = (text) => {
  const clean = text.replace(/[^一-鿿A-Za-z0-9]/g, '');
  const set = new Set();
  for (let i = 0; i < clean.length - 1; i++) set.add(clean.slice(i, i + 2));
  return set;
};

const overlap = (a, b) => {
  const left = bigrams(a), right = bigrams(b);
  if (!left.size || !right.size) return 0;
  let shared = 0;
  for (const item of left) if (right.has(item)) shared++;
  return shared / Math.min(left.size, right.size);
};

export const splitSentences = (text) => text.split(/\n\s*\n/).flatMap((paragraph, paragraphIndex) =>
  paragraph.split(/(?<=[。！？；])/).map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean).map((sentence) => ({sentence, paragraphIndex})));

// Spoken-script checks that a file read cannot do for us: shape and listenability, not accuracy.
// Errors only for an unusable script; everything else is a warning needing an authored fix or reason.
export const auditScript = (text, {headline, target} = {}) => {
  const errors = [], warnings = [];
  const items = splitSentences(text ?? '');
  const characters = han(text ?? '');
  const estimatedSeconds = Math.round((characters / charsPerSecond) * 10) / 10;
  if (!items.length || !characters) return {errors: ['script has no Chinese text'], warnings, stats: {sentences: 0, characters, estimatedSeconds}};

  if (target && Math.abs(estimatedSeconds - target) / target > 0.2) warnings.push(`estimated ${estimatedSeconds}s is more than 20% from the ${target}s target`);

  const first = items[0].sentence;
  if (dateOpening.test(first)) warnings.push(`opens with a date and event ("${first.slice(0, 18)}…"); lead with what the viewer gains or can now do, date second`);
  if (headline && overlap(first, headline) >= 0.6) warnings.push('first sentence largely repeats the headline; open with the viewer consequence instead');

  items.forEach(({sentence}, index) => {
    const length = han(sentence);
    if (length > maxSentence) warnings.push(`sentence ${index + 1} is ${length} characters (over ${maxSentence}); split it so it fits one breath`);
    const numbers = sentence.match(/\d+(?:\.\d+)?/g) ?? [];
    if (numbers.length >= 4) warnings.push(`sentence ${index + 1} carries ${numbers.length} numbers/dates; give each its own sentence`);
  });

  // The same two opening characters three times in a row reads as a list copied from a press release.
  for (let i = 0; i + 2 < items.length; i++) {
    const heads = items.slice(i, i + 3).map(({sentence}) => sentence.replace(/^[^一-鿿]+/, '').slice(0, 2));
    if (heads[0].length === 2 && heads.every((h) => h === heads[0])) { warnings.push(`sentences ${i + 1}-${i + 3} all start with "${heads[0]}"; signpost the count or merge the items`); break; }
  }

  const last = items[items.length - 1].sentence;
  if (!endingMarkers.test(last)) warnings.push('ending has no judgment or watch point; finish with what the viewer should watch or conclude');

  return {errors, warnings, stats: {sentences: items.length, characters, estimatedSeconds}};
};
