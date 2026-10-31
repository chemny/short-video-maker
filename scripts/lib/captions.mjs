import fs from 'node:fs';
import path from 'node:path';

const srtTime = (seconds) => {
  const ms = Math.round(seconds * 1000);
  return `${String(Math.floor(ms / 3600000)).padStart(2, '0')}:${String(Math.floor(ms / 60000) % 60).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`;
};

export const writeCaptions = (captions, directory, offset = 0) => {
  fs.mkdirSync(directory, {recursive: true});
  const adjusted = captions.map((caption) => ({...caption, start: caption.start + offset, end: caption.end + offset, ...(caption.displayStart===undefined?{}:{displayStart:caption.displayStart+offset})}));
  fs.writeFileSync(path.join(directory, 'captions.json'), `${JSON.stringify(adjusted, null, 2)}\n`);
  fs.writeFileSync(path.join(directory, 'captions.srt'), adjusted.map((caption, index) =>
    `${index + 1}\n${srtTime(Math.max(caption.start,caption.displayStart??caption.start))} --> ${srtTime(caption.end)}\n${caption.text}\n`).join('\n'));
};
