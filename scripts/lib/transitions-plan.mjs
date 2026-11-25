// Which entry effect each beat gets, and which picture layout (references/shot-script.md, step 8). Deterministic: the same script always
// gets the same plan. Explicit `transition`, `dir` and `layout` on a beat always win. The effects themselves live in
// remotion/src/templates/frame/shots/transitions.ts; FRAMES below mirrors its TRANSITION_FRAMES (a test keeps them equal).
export const TRANSITIONS = ['cut', 'dissolve', 'slide', 'push', 'stack', 'wipe', 'zoom', 'blur'];
export const LAYOUTS = ['card', 'float', 'stack'];
export const FRAMES = {cut: 0, dissolve: 9, slide: 8, push: 10, stack: 11, wipe: 10, zoom: 10, blur: 7};
export const MOTION_CYCLE = ['wipe', 'zoom', 'push', 'blur', 'stack'];
export const LIMITS = {maxMotionShare: 0.4, minDistinct: 3, distinctFrom: 10, shortBeat: 2.2, longBeat: 3.5, floatMinSeconds: 4, maxFloat: 3};
const DIRECTIONAL = new Set(['slide', 'push', 'stack']);
const DIRS = {push: ['left', 'right'], stack: ['up', 'left'], slide: ['up', 'up']};

export function assignTransitions(beats, seconds, {materials = beats.map((b) => b.material)} = {}) {
  const n = beats.length, type = Array(n).fill('cut'), reason = Array(n).fill('');
  let cycle = 0, section = 0;
  const motionBefore = (i) => type.slice(0, i).reverse().find((t) => t !== 'cut');
  for (let i = 1; i < n; i++) {
    const b = beats[i], prev = beats[i - 1];
    if (b.transition) { type[i] = b.transition; reason[i] = 'explicit'; continue; }
    if (seconds[i] < LIMITS.shortBeat) continue;
    let pick = null, why = '';
    if (b.rung === 'text') { pick = 'dissolve'; why = 'closing text'; }
    else if (b.move === 'compare') { pick = 'dissolve'; why = 'compare brings its own cards'; }
    else if (b.move === 'count') { pick = 'blur'; why = 'figure over a blurred picture'; }
    else if (b.section) { pick = ['stack', 'push', 'wipe'][section++ % 3]; why = 'new section'; }
    else if (materials[i] && materials[i] === materials[i - 1]) { pick = 'zoom'; why = 'same picture, new crop'; }
    else if (b.rung === 'recording' && prev.rung !== 'recording') { pick = 'blur'; why = 'moving page after a still'; }
    else if (b.rung !== 'recording' && prev.rung === 'recording' && b.rung !== 'text') { pick = 'push'; why = 'picture after a recording'; }
    else if (i >= 2 && type[i - 1] === 'cut' && type[i - 2] === 'cut' && seconds[i] >= LIMITS.longBeat) { pick = MOTION_CYCLE[cycle++ % MOTION_CYCLE.length]; why = 'rhythm: break a run of cuts'; }
    if (!pick) continue;
    // never the same moving effect twice in a row
    if (pick !== 'dissolve' && pick === motionBefore(i) && type[i - 1] !== 'cut') pick = MOTION_CYCLE[cycle++ % MOTION_CYCLE.length];
    if (pick === motionBefore(i) && type[i - 1] === pick) pick = MOTION_CYCLE[cycle++ % MOTION_CYCLE.length];
    type[i] = pick; reason[i] = why;
  }
  // too many moving entries read as busy: keep the ones that mark a section or the close, demote the rest from the end
  const cap = Math.max(1, Math.floor((n - 1) * LIMITS.maxMotionShare));
  const keep = (i) => beats[i].transition || beats[i].section || beats[i].rung === 'text';
  for (let i = n - 1; i > 0 && type.filter((t, k) => k > 0 && t !== 'cut').length > cap; i--) if (type[i] !== 'cut' && !keep(i)) { type[i] = 'cut'; reason[i] = ''; }
  const flip = {};
  return type.map((t, i) => {
    let dir = beats[i].dir;
    if (!dir && DIRECTIONAL.has(t)) { flip[t] = (flip[t] ?? -1) + 1; dir = DIRS[t][flip[t] % 2]; }
    return {type: t, dir, reason: reason[i]};
  });
}

// float: a long still on a picture that does not fill the frame gets the slow perspective tilt, at most a few per film
export function assignLayouts(beats, seconds, fits) {
  let floats = 0;
  return beats.map((b, i) => {
    if (b.layout) return b.layout;
    const stillish = ['hold', 'push', 'pull'].includes(b.move) || !b.move;
    if (fits[i] === 'contain' && b.rung === 'image' && stillish && seconds[i] >= LIMITS.floatMinSeconds && floats < LIMITS.maxFloat) { floats++; return 'float'; }
    return 'card';
  });
}

export function varietyFindings(types) {
  const out = [];
  const moving = types.slice(1).filter((t) => t !== 'cut'), distinct = new Set(moving);
  if (types.length >= LIMITS.distinctFrom && distinct.size < LIMITS.minDistinct) out.push(`only ${distinct.size} kind(s) of moving entry in ${types.length} beats (aim for ${LIMITS.minDistinct} or more)`);
  for (let i = 2; i < types.length; i++) if (types[i] !== 'cut' && types[i] === types[i - 1] && types[i] === types[i - 2]) out.push(`entry "${types[i]}" three times in a row from beat ${i - 1}`);
  if (types.length >= 5 && moving.length > (types.length - 1) * LIMITS.maxMotionShare + 1e-9) out.push(`${moving.length} of ${types.length - 1} entries move, more than ${LIMITS.maxMotionShare * 100}%`);
  return out;
}
