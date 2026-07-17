import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const dirnameFromMetaUrl = (metaUrl) => path.dirname(fileURLToPath(metaUrl));

export const skillRootFrom = (metaUrl, ...segments) => path.resolve(dirnameFromMetaUrl(metaUrl), ...segments);
