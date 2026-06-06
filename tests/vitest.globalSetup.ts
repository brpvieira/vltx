import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const tmpDir = join(__dirname, 'tmp');

export function setup() {
  mkdirSync(tmpDir, { recursive: true });
}

export function teardown() {
  rmSync(tmpDir, { recursive: true, force: true });
}
