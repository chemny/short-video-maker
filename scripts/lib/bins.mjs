import fs from 'node:fs';
import path from 'node:path';

export const commandEnvName = (command) => `${command.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}_BIN`;

export const commandFromEnv = (command) => {
  const value = process.env[commandEnvName(command)];
  return value && value.trim() ? value.trim() : command;
};

export const resolveLocalBin = (packageDir, name) => {
  const binDir = path.join(packageDir, 'node_modules', '.bin');
  const candidates =
    process.platform === 'win32'
      ? [path.join(binDir, `${name}.cmd`), path.join(binDir, `${name}.ps1`), path.join(binDir, name)]
      : [path.join(binDir, name)];

  return candidates.find((candidate) => fs.existsSync(candidate)) ?? candidates[0];
};

export const resolveRemotionBin = (remotionDir) => {
  const override = process.env.REMOTION_BIN;
  return override && override.trim() ? override.trim() : resolveLocalBin(remotionDir, 'remotion');
};
