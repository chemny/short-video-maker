export const secondsToFrames = (seconds: number, fps: number) =>
  Math.max(0, Math.round(seconds * fps));

export const durationFrames = (start: number, end: number, fps: number) =>
  Math.max(1, secondsToFrames(end - start, fps));
