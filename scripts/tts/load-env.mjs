// 启动时加载本地环境变量（含个人凭证）。
// 个人数据只住 ~/.cmm/，不放进 skill 发布包；skill 本地 .env 作为可选回退。
// 不覆盖已存在的 process.env，CLI 显式传参/导出仍然优先。
import {existsSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const skillRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');

const candidates = [
  path.join(os.homedir(), '.cmm', 'remotion-volcengine.env'),
  path.join(skillRoot, '.env'),
];

for (const file of candidates) {
  if (existsSync(file)) {
    try {
      process.loadEnvFile(file);
    } catch {
      // 解析失败时静默跳过，不阻断主流程
    }
  }
}
