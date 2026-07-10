import {envMilliseconds, runCommand} from '../lib/process.mjs';

export const hasCommand = (command) => {
  try {
    runCommand('which', [command], {
      stdio: 'ignore',
      label: `check command ${command}`,
      timeoutMs: envMilliseconds('SHORT_VIDEO_PROBE_TIMEOUT_MS', 15000),
    });
    return true;
  } catch {
    return false;
  }
};

export const requireCommands = (commands) => {
  const missing = commands.filter((command) => !hasCommand(command));

  if (missing.length > 0) {
    throw new Error(`Missing required command(s): ${missing.join(', ')}`);
  }
};

export const detectDuration = (filePath) =>
  Number(
      runCommand('ffprobe', [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'default=noprint_wrappers=1:nokey=1',
      filePath,
    ], {
      stdio: 'pipe',
      label: `ffprobe duration ${filePath}`,
      timeoutMs: envMilliseconds('SHORT_VIDEO_PROBE_TIMEOUT_MS', 15000),
    })
      .toString()
      .trim(),
  );
