import { it as testScheduler, Func, AsyncFunc, Test, Done } from 'mocha';
import { MySqlClientInstance } from '@marin/lib.data-access';
import { getLogger, waitMySqlServerToBoot, MySqlEnv, DockerContainers } from './fixtures/setup';
import { createEnvAccounts } from './fixtures/env';

const MAX_ALLOWED_TEST_TIMEOUT = Number(process.env.ENV_MAX_ALLOWED_TEST_TIMEOUT_MS) || 0;

interface TestCaseDependencies {
	envAccounts?: boolean;
}

type TestRunningType = 'only' | 'skip' | 'normal';

interface TestCase {
	[stateProps: string]: any;

	schedule(): void;
	dependsOn(deps: TestCaseDependencies): TestCase;
	timeout(ms: number): TestCase;
}

/**
 * Wrapper over Mocha `it` function.
 * Runs test cases conditionally based on environment config.
 *
 * @param title
 * @param testBusiness
 */
function it(title: string, testBusiness: Func | AsyncFunc): TestCase {
	return it._impl(title, testBusiness);
}

it._impl = (title: string, testBusiness: Func | AsyncFunc, runningType: TestRunningType = 'normal'): TestCase => {
	return {
		_timeout: 2000,
		_testBusiness: testBusiness,

		_test(done: Done) {
			try {
				// @ts-ignore
				const result = this._testBusiness();

				if (result instanceof Promise) {
					result.then(done).catch(done);
					return;
				}

				done();
			} catch (e) {
				done(e);
			}
		},

		schedule(): void {
			if (MAX_ALLOWED_TEST_TIMEOUT <= 0 || this._timeout <= MAX_ALLOWED_TEST_TIMEOUT) {
				let scheduledTest: Test;

				// eslint-disable-next-line default-case
				switch (runningType) {
					case 'normal':
						scheduledTest = testScheduler(title, this._test.bind(this));
						break;
					case 'only':
						scheduledTest = testScheduler.only(title, this._test.bind(this));
						break;
					case 'skip':
						scheduledTest = testScheduler.skip(title, this._test.bind(this));
						break;
				}

				scheduledTest.timeout(this._timeout);
				return;
			}

			getLogger().debug(`Test '${title}' having timeout of ${this._timeout} ms exceeds maximum timeout of ${MAX_ALLOWED_TEST_TIMEOUT} ms. Skipping...`);
		},

		dependsOn(deps: TestCaseDependencies): TestCase {
			if (deps.envAccounts) {
				const { _testBusiness } = this;
				this._testBusiness = () => createEnvAccounts().then(_testBusiness);
				this._timeout += 2500;
			}

			return this;
		},

		timeout(ms: number, append = false): TestCase {
			this._timeout = append ? this._timeout + ms : ms;
			return this;
		}
	};
};

it.only = (title: string, testBusiness: Func | AsyncFunc): TestCase => it._impl(title, testBusiness, 'only');

it.skip = (title: string, testBusiness: Func | AsyncFunc): TestCase => it._impl(title, testBusiness, 'skip');

/**
 * Stops docker container which runs MySql Server,
 * therefore destroys all client connections
 */
async function brokeConnectionWithMySqlServer(): Promise<void> {
	await DockerContainers.mysql.instance!.stop();
}

/**
 * Starts docker container which runs MySql Server,
 * waits it to boot, then reconnects
 */
async function reconnectToMySqlServer(): Promise<void> {
	await DockerContainers.mysql.instance!.start();

	await waitMySqlServerToBoot(true);

	MySqlClientInstance.init({
		pool: MySqlEnv
	});
}

export { it, brokeConnectionWithMySqlServer, reconnectToMySqlServer };
