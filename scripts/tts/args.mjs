export const parseArgs = (argv) => {
  const result = {
    _: [],
  };

  for (const arg of argv) {
    if (!arg.startsWith('--')) {
      result._.push(arg);
      continue;
    }

    const [key, ...valueParts] = arg.slice(2).split('=');
    result[key] = valueParts.length > 0 ? valueParts.join('=') : true;
  }

  return result;
};

export const requireEnv = (keys) => {
  const missing = keys.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
};

export const envNumber = (key, fallback) => {
  const value = process.env[key];
  if (value === undefined || value === '') {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${key} must be a number`);
  }

  return parsed;
};
