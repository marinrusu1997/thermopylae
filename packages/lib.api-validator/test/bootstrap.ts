import path from 'node:path';
import { beforeAll } from 'vitest';
import { ApiValidator } from '../lib/index.js';

const apiValidator = new ApiValidator();

// oxlint-disable-next-line require-top-level-describe
beforeAll(() => apiValidator.init(path.join(import.meta.dirname, 'fixtures'), ['core']));

export { apiValidator };
