import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		name: 'Thermopylae',
		projects: [
			'packages/*',
			{
				extends: true,
				test: {
					name: 'core.authentication',
					include: ['packages/core.authentication/test/**/*.spec.ts'],
					globalSetup: 'packages/core.authentication/test/fixtures/global-setup.ts',
					setupFiles: 'packages/core.authentication/test/fixtures/setup.ts',
					poolOptions: {
						threads: {
							singleThread: true,
							isolate: false
						}
					}
				}
			}
		],
		environment: 'node',
		env: {
			NODE_TLS_REJECT_UNAUTHORIZED: '0'
		},
		pool: 'threads',
		poolOptions: {
			threads: {
				singleThread: false,
				isolate: false,
				useAtomics: true
			}
		},
		testTimeout: 10_000,
		hookTimeout: 15_000,
		teardownTimeout: 15_000,
		silent: false,
		forceRerunTriggers: ['**/package.json/**', '**/vitest.config.*/**'],
		coverage: {
			provider: 'v8',
			enabled: true,
			include: ['lib/**/*.ts'],
			extension: 'ts',
			all: true,
			clean: true,
			cleanOnRerun: true,
			reportsDirectory: './coverage',
			reporter: [
				['lcov', { projectRoot: './lib', file: 'unit/lcov.info' }],
				['text', { skipFull: true, skipEmpty: true }],
				['html', { subdir: 'html-report' }]
			],
			reportOnFailure: false,
			allowExternal: false,
			thresholds: {
				branches: 80,
				lines: 80,
				statements: 80,
				functions: 80
			}
		},
		clearMocks: true,
		maxConcurrency: 100,
		typecheck: {
			enabled: true,
			include: ['**/*.{test,spec}-d.?(c|m)[jt]s?(x)'],
			tsconfig: 'tsconfig.test.json'
		}
	}
});
