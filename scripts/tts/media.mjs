import {execFileSync} from 'node:child_process';

export const hasCommand = (command) => {
  try {
    execFileSync('which', [command], {stdio: 'ignore'});
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
    execFileSync('ffprobe', [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'default=noprint_wrappers=1:nokey=1',
      filePath,
    ])
      .toString()
      .trim(),
  );
