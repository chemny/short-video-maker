import {execFileSync} from 'node:child_process';
import {formatDuration, nowMs} from './timing.mjs';

export const envMilliseconds = (name, fallback) => {
  const value = process.env[name];
  if (value === undefined || value === '') {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive number of milliseconds`);
  }

  return parsed;
};

const describeCommand = (command, args = []) => `${command} ${args.join(' ')}`.trim();

export const formatMilliseconds = (timeoutMs) =>
  timeoutMs < 1000 ? `${timeoutMs}ms` : `${Math.round(timeoutMs / 1000)}s`;

const commandTimeoutMessage = ({command, args, timeoutMs, label}) =>
  `${label ? `${label}: ` : ''}command timed out after ${formatMilliseconds(timeoutMs)}: ${describeCommand(command, args)}`;

export const runCommand = (command, args = [], options = {}) => {
  const {
    cwd,
    stdio = 'inherit',
    timeoutMs = envMilliseconds('SHORT_VIDEO_COMMAND_TIMEOUT_MS', 120000),
    label,
  } = options;

  if (stdio === 'inherit') {
    console.log(`$ ${describeCommand(command, args)}`);
  }

  const start = nowMs();
  try {
    const result = execFileSync(command, args, {cwd, stdio, timeout: timeoutMs});
    if (stdio === 'inherit') {
      console.log(`[done] ${label ?? describeCommand(command, args)} in ${formatDuration(nowMs() - start)}`);
    }
    return result;
  } catch (error) {
    if (error.signal === 'SIGTERM' || error.code === 'ETIMEDOUT') {
      throw new Error(commandTimeoutMessage({command, args, timeoutMs, label}));
    }
    throw error;
  }
};

export const readCommand = (command, args = [], options = {}) =>
  runCommand(command, args, {...options, stdio: options.stdio ?? 'pipe'}).toString();
