export const nowMs = () => Number(process.hrtime.bigint() / 1000000n);

export const formatDuration = (milliseconds) => {
  if (milliseconds < 1000) {
    return `${milliseconds}ms`;
  }

  return `${(milliseconds / 1000).toFixed(1)}s`;
};

export const timed = async (label, task) => {
  const start = nowMs();
  console.log(`[start] ${label}`);
  try {
    return await task();
  } finally {
    console.log(`[done] ${label} in ${formatDuration(nowMs() - start)}`);
  }
};

export const timedSync = (label, task) => {
  const start = nowMs();
  console.log(`[start] ${label}`);
  try {
    return task();
  } finally {
    console.log(`[done] ${label} in ${formatDuration(nowMs() - start)}`);
  }
};
