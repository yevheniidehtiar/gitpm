import { resolve } from 'node:path';

export function resolveMetaDir(metaDirOption: string): string {
  return resolve(process.cwd(), metaDirOption);
}
