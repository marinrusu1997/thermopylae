import { it as testScheduler, Func, AsyncFunc, Test, Done } from 'mocha';
import { Logger } from './logger';
import { getAllResourceTypes, ResourceType } from './commons';
import { ResourcesManagerInstance } from './resources-manager';

const MAX_ALLOWED_TEST_TIMEOUT_MS = Number(process.env.ENV_MAX_ALLOWED_TEST_TIMEOUT_MS) || 0;

const INFINITE_TEST_TIMEOUT = 0;

const DEFAULT_TEST_TIMEOUT_MS = 2000;

type TestRunningType = 'only' | 'skip' | 'normal';

interface TestCase {
	[stateProps: string]: any;

	schedule(): void;
	requires(resourceTypes: Array<ResourceType>): TestCase;
	releases(resourceTypes: Array<ResourceType> | ResourceType | '@all' | '@nothing'): TestCase;
	timeout(ms: number): TestCase;
}

function it(title: string, testBusiness: Func | AsyncFunc): TestCase {
	return it._impl(title, testBusiness);
}

it._impl = (title: string, testBusiness: Function, runningType: TestRunningType = 'normal'): TestCase => {
	return {
		_timeout: DEFAULT_TEST_TIMEOUT_MS,
		_requiredResources: null,

		_addArrayOfResourcesForCleanUp(resourceTypes: Array<ResourceType>) {
			if (this._requiredResources === null) {
				this._requiredResources = {
					acquire: null,
					release: new Set<ResourceType>(resourceTypes)
				};

				return this;
			}

			// eslint-disable-next-line no-restricted-syntax
			for (const resourceType of resourceTypes) {
				this._requiredResources.release!.add(resourceType);
			}

			return this;
		},

		_addSingleResourceForCleanUp(resourceType: ResourceType) {
			if (this._requiredResources === null) {
				this._requiredResources = {
					acquire: null,
					release: new Set<ResourceType>()
				};
			}

			this._requiredResources.release!.add(resourceType);

			return this;
		},

		_test(done: Done) {
			try {
				const result = testBusiness();

				if (result instanceof Promise) {
					result.then(done).catch(done);
					return;
				}

				done();
			} catch (e) {
				done(e);
			}
		},

		schedule() {
			if (MAX_ALLOWED_TEST_TIMEOUT_MS === INFINITE_TEST_TIMEOUT || this._timeout <= MAX_ALLOWED_TEST_TIMEOUT_MS) {
				if (runningType !== 'skip') {
					if (!this._requiredResources) {
						// just to make sure we don't leak resources accidentally
						this.releases('@all');
					}

					const priority = runningType === 'only' ? 'high' : 'normal';
					ResourcesManagerInstance.registerRequiredResources(this._requiredResources!, priority);

					this._requiredResources = null;
				}

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

			Logger.debug(`Test '${title}' having timeout of ${this._timeout} ms exceeds maximum timeout of ${MAX_ALLOWED_TEST_TIMEOUT_MS} ms. Skipping...`);
		},

		requires(resourceTypes) {
			if (runningType === 'skip') {
				return this;
			}

			if (this._requiredResources === null) {
				this._requiredResources = {
					acquire: new Set<ResourceType>(resourceTypes),
					release: new Set<ResourceType>(resourceTypes)
				};

				return this;
			}

			if (this._requiredResources.acquire === null) {
				this._requiredResources.acquire = new Set<ResourceType>();
			}

			if (this._requiredResources.release === null) {
				this._requiredResources.release = new Set<ResourceType>();
			}

			// eslint-disable-next-line no-restricted-syntax
			for (const resourceType of resourceTypes) {
				this._requiredResources.acquire.add(resourceType);
				this._requiredResources.release.add(resourceType);
			}

			return this;
		},

		releases(resourceTypes) {
			if (runningType === 'skip') {
				return this;
			}

			if (Array.isArray(resourceTypes)) {
				return this._addArrayOfResourcesForCleanUp(resourceTypes);
			}

			if (resourceTypes === '@all') {
				return this._addArrayOfResourcesForCleanUp(getAllResourceTypes());
			}

			if (resourceTypes === '@nothing') {
				this._requiredResources = {
					acquire: null,
					release: null
				};

				return this;
			}

			return this._addSingleResourceForCleanUp(resourceTypes);
		},

		timeout(ms): TestCase {
			if (runningType === 'skip') {
				return this;
			}

			this._timeout = ms;

			return this;
		}
	};
};

it.only = (title: string, testBusiness: Func | AsyncFunc): TestCase => it._impl(title, testBusiness, 'only');

it.skip = (title: string, testBusiness: Func | AsyncFunc): TestCase => it._impl(title, testBusiness, 'skip');

export { it };
