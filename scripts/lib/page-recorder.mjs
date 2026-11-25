import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn, execFileSync} from 'node:child_process';
import {commandFromEnv} from './bins.mjs';

// Records a smooth, deterministic scroll of one page as a 1080x1920 video: headless Chrome in an isolated profile emulates a
// 360x640 phone at 3x, each frame is a screenshot at a computed scroll position, and FFmpeg assembles them. No cookies are
// reused and nothing is clicked. The result is a picture of the page, to be reviewed for banners, popups and login walls.
export const defaultBrowser = () => process.env.REMOTION_BROWSER_EXECUTABLE ?? (process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : 'google-chrome');
const MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const smoothstep = (t) => { const x = Math.min(1, Math.max(0, t)); return x * x * (3 - 2 * x); };

// Scroll offset in CSS pixels for each frame: hold, ease through `travel`, hold.
export function scrollPath({travel, seconds, fps, holdSeconds = 0.5}) {
  const frames = Math.round(seconds * fps), hold = Math.round(holdSeconds * fps), move = Math.max(1, frames - 2 * hold);
  return Array.from({length: frames}, (_, i) => Math.round(travel * smoothstep((i - hold) / move) * 10) / 10);
}

const connect = (url) => new Promise((resolve, reject) => {
  const ws = new WebSocket(url), pending = new Map(), listeners = [];
  let id = 0;
  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) { const {ok, fail} = pending.get(msg.id); pending.delete(msg.id); msg.error ? fail(new Error(`${msg.error.message}`)) : ok(msg.result); }
    else if (msg.method) listeners.forEach((l) => l(msg));
  });
  ws.addEventListener('error', () => reject(new Error('Could not connect to the browser debugging port')));
  ws.addEventListener('open', () => resolve({
    send: (method, params = {}) => new Promise((ok, fail) => { const n = ++id; pending.set(n, {ok, fail}); ws.send(JSON.stringify({id: n, method, params})); }),
    on: (fn) => listeners.push(fn), close: () => ws.close(),
  }));
});

const launch = async (browser, profile) => {
  const child = spawn(browser, ['--headless=new', '--no-first-run', '--disable-default-apps', '--hide-scrollbars', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], {stdio: 'ignore'});
  const portFile = path.join(profile, 'DevToolsActivePort');
  for (let i = 0; i < 100 && !fs.existsSync(portFile); i++) await sleep(100);
  if (!fs.existsSync(portFile)) { child.kill(); throw new Error(`Browser did not start: ${browser}`); }
  return {child, port: Number(fs.readFileSync(portFile, 'utf8').split('\n')[0])};
};

// `fromText` starts the scroll at the first heading or paragraph containing that text (a section deep in a long page); `fromY` at a pixel offset.
export async function recordScroll({url, outFile, seconds = 6, fps = 30, speed = 260, width = 360, height = 640, scale = 3, browser = defaultBrowser(), settleMs = 2500, maxSeconds = 20, fromText, fromY = 0}) {
  if (!(seconds >= 2 && seconds <= maxSeconds)) throw new Error(`seconds must be 2..${maxSeconds}`);
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'svm-record-')), frames = path.join(temporary, 'frames');
  fs.mkdirSync(frames);
  let proc;
  try {
    proc = await launch(browser, path.join(temporary, 'profile'));
    const targets = await (await fetch(`http://127.0.0.1:${proc.port}/json/list`)).json();
    const page = targets.find((t) => t.type === 'page');
    if (!page) throw new Error('Browser has no page target');
    const cdp = await connect(page.webSocketDebuggerUrl);
    let loaded; const loadedPromise = new Promise((r) => { loaded = r; });
    cdp.on((m) => { if (m.method === 'Page.loadEventFired') loaded(); });
    await cdp.send('Page.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', {width, height, deviceScaleFactor: scale, mobile: true});
    await cdp.send('Emulation.setUserAgentOverride', {userAgent: MOBILE_UA});
    await cdp.send('Page.navigate', {url});
    await Promise.race([loadedPromise, sleep(30000)]);
    await sleep(settleMs);
    const evalNumber = async (expression) => (await cdp.send('Runtime.evaluate', {expression, returnByValue: true, awaitPromise: true})).result.value;
    const scrollable = (await evalNumber('document.documentElement.scrollHeight')) - height;
    if (!(scrollable >= 200)) throw new Error(`Page scrolls only ${Math.max(0, Math.round(scrollable))} px at phone width; use a still capture instead`);
    let startY = fromY;
    if (fromText) {
      const top = await evalNumber(`(()=>{const w=${JSON.stringify(fromText)};const e=[...document.querySelectorAll('h1,h2,h3,h4,p,span,div')].filter(n=>n.children.length<4&&(n.textContent||'').includes(w)).sort((a,b)=>(a.textContent||'').length-(b.textContent||'').length)[0];return e?Math.round(e.getBoundingClientRect().top+window.scrollY):-1})()`);
      if (top < 0) throw new Error(`text not found on the page: ${fromText}`);
      startY = Math.max(0, top - 140);
    }
    startY = Math.min(startY, Math.max(0, scrollable - 200));
    const travel = Math.min(scrollable - startY, speed * (seconds - 1));
    if (!(travel >= 200)) throw new Error(`Only ${Math.max(0, Math.round(travel))} px of page remain below the start; start earlier`);
    const offsets = scrollPath({travel, seconds, fps}).map((y) => Math.round((y + startY) * 10) / 10);
    for (const [i, y] of offsets.entries()) {
      await cdp.send('Runtime.evaluate', {expression: `window.scrollTo(0,${y});new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`, awaitPromise: true});
      const shot = await cdp.send('Page.captureScreenshot', {format: 'jpeg', quality: 92});
      fs.writeFileSync(path.join(frames, `f${String(i).padStart(5, '0')}.jpg`), Buffer.from(shot.data, 'base64'));
    }
    cdp.close();
    fs.mkdirSync(path.dirname(outFile), {recursive: true});
    execFileSync(commandFromEnv('ffmpeg'), ['-hide_banner', '-v', 'error', '-nostdin', '-y', '-framerate', String(fps), '-i', path.join(frames, 'f%05d.jpg'),
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '17', '-an', '-movflags', '+faststart', outFile], {stdio: 'pipe', timeout: 180000});
    return {frames: offsets.length, startY: Math.round(startY), travel: Math.round(travel), pageHeight: Math.round(scrollable + height), width: width * scale, height: height * scale};
  } finally {
    proc?.child.kill();
    await sleep(200);
    fs.rmSync(temporary, {recursive: true, force: true});
  }
}
