import {envMilliseconds, formatMilliseconds} from './process.mjs';

export const fetchWithTimeout = async (url, options = {}, config = {}) => {
  const timeoutMs = config.timeoutMs ?? envMilliseconds(config.envName ?? 'SHORT_VIDEO_FETCH_TIMEOUT_MS', 45000);
  const label = config.label ?? String(url);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: options.signal ?? controller.signal,
    });
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(`${label}: request timed out after ${formatMilliseconds(timeoutMs)}`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};
