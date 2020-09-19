import { expect } from 'chai';
import { after, afterEach, describe, it } from 'mocha';
import { getAllEnumValues } from 'enum-for';
import { AsyncFunction, DotKeyOf, Milliseconds, Nullable, ObjMap, Optional, PromiseReject, PromiseResolve, SyncFunction } from '@thermopylae/core.declarations';
import { number, string } from '@thermopylae/lib.utils';
import { AmnesiaBoundary, memoize, Storage } from '../../lib/aop/memoization';

enum CleanUpScope {
	AFTER = 1,
	AFTER_EACH = 0
}

class CleanUpRegistry {
	private readonly handlers: ReadonlyMap<CleanUpScope, Array<AsyncFunction<void, void>>>;

	public constructor() {
		// @ts-ignore
		const initialHandlers: Array<[CleanUpScope, Array<AsyncFunction<void, void>>]> = getAllEnumValues(CleanUpScope).map((scope) => [scope, []]);
		this.handlers = new Map<CleanUpScope, Array<AsyncFunction<void, void>>>(initialHandlers);
	}

	public register(handler: AsyncFunction<void, void>, scope: CleanUpScope): void {
		this.handlers.get(scope)!.push(handler);
	}

	public async execute(scope: CleanUpScope): Promise<void> {
		for (const handler of this.handlers.get(scope)!) {
			await handler();
		}
	}
}
const CleanUpRegistryInstance = new CleanUpRegistry();

function destructor(scope: CleanUpScope): MethodDecorator {
	return (target, propertyKey, descriptor) => {
		if (typeof descriptor.value !== 'function') {
			throw new Error(`Property ${propertyKey.toString()} on ${target.constructor.name} needs to be a method. Actual type: ${typeof descriptor.value}.`);
		}

		CleanUpRegistryInstance.register(descriptor.value.bind(target), scope);
	};
}

enum UniversityRegion {
	MIT,
	HARVARD
}

const enum FacultyZone {
	IT = 'IT',
	MEDICINE = 'MEDICINE',
	ARTS = 'ARTS'
}

class Spy<T extends ObjMap> {
	private readonly instance: T;

	private readonly intercepts: Map<DotKeyOf<T>, number>;

	public constructor(instance: T) {
		// eslint-disable-next-line @typescript-eslint/no-this-alias
		const self = this;
		this.instance = new Proxy<T>(instance, {
			get(target: T, p: Exclude<PropertyKey, symbol>): any {
				self.increment(p.toString());
				return target[p];
			}
		});
		this.intercepts = new Map<DotKeyOf<T>, number>();
	}

	public get suspect(): T {
		return this.instance;
	}

	public calls(method: DotKeyOf<T>): number {
		return this.intercepts.get(method) || 0;
	}

	private increment(method: DotKeyOf<T>): void {
		const calls = this.intercepts.get(method);
		this.intercepts.set(method, (calls || 0) + 1);
	}
}

class ExternalService<T> {
	private readonly response?: Nullable<T>;

	private readonly throwable?: Error;

	public constructor(response?: Nullable<T>, throwable?: Error) {
		this.response = response;
		this.throwable = throwable;
	}

	@memoize(UniversityRegion.MIT, FacultyZone.MEDICINE)
	public syncMethodWithNoArgsMitMedicine(): Optional<Nullable<T>> {
		if (this.throwable) {
			throw this.throwable;
		}

		return this.response;
	}

	@memoize(UniversityRegion.HARVARD, FacultyZone.MEDICINE)
	public syncMethodWithArgsHarvardMedicine(domain: string): Optional<Nullable<T>> {
		if (this.throwable) {
			throw this.throwable;
		}

		if (this.response == null) {
			return this.response;
		}
		return domain as any;
	}

	@memoize(UniversityRegion.HARVARD, FacultyZone.MEDICINE, ExternalService.locationResolver)
	public syncMethodWithLocationResolverHarvardMedicine(domain: string, name: string): Optional<Nullable<T>> {
		if (this.throwable) {
			throw this.throwable;
		}

		if (this.response == null) {
			return this.response;
		}

		return (domain + name) as any;
	}

	@memoize(UniversityRegion.MIT, FacultyZone.IT)
	public shortAsyncMethodNoArgsMitIt(): Promise<Nullable<T>> {
		return new Promise<Nullable<T>>((resolve, reject) => setTimeout(this.executor(resolve, reject), 30));
	}

	@memoize(UniversityRegion.HARVARD, FacultyZone.IT)
	public shortAsyncMethodWithArgsHarvardIt(domain: string): Promise<Nullable<T>> {
		return new Promise<Nullable<T>>((resolve, reject) =>
			setTimeout(() => {
				if (this.throwable) {
					return reject(this.throwable);
				}
				if (this.response == null) {
					return resolve(this.response);
				}

				return resolve(domain as any);
			}, 30)
		);
	}

	@memoize(UniversityRegion.HARVARD, FacultyZone.ARTS)
	public longAsyncMethodNoArgsHarvardArts(): Promise<Nullable<T>> {
		return new Promise<Nullable<T>>((resolve, reject) => setTimeout(this.executor(resolve, reject), 300));
	}

	@memoize(UniversityRegion.MIT, FacultyZone.ARTS)
	public longAsyncMethodWithArgsMitArts(duration: Milliseconds): Promise<Nullable<T>> {
		return new Promise<Nullable<T>>((resolve, reject) => setTimeout(this.executor(resolve, reject), duration));
	}

	@destructor(CleanUpScope.AFTER_EACH)
	// @ts-ignore
	private wipeMemoization(): Promise<void> {
		for (const region of getAllEnumValues(UniversityRegion)) {
			Storage.forget(AmnesiaBoundary.INSTANCE, this, region);
		}
		return Promise.resolve();
	}

	private executor(resolve: PromiseResolve<Nullable<T>>, reject: PromiseReject): SyncFunction {
		return () => (this.throwable ? reject(this.throwable) : resolve(this.response));
	}

	private static locationResolver(...args: any[]): string {
		return args[0];
	}
}

const FALSY_VALUES = [0, 0n, false, NaN, ''];

describe('memoization spec', function () {
	after(() => CleanUpRegistryInstance.execute(CleanUpScope.AFTER));

	afterEach(() => CleanUpRegistryInstance.execute(CleanUpScope.AFTER_EACH));

	describe('memoize spec', function () {
		describe('sync method', function () {
			it.only('should memoize result of method without arguments', () => {
				const result = number.generateRandomInt(0, 10);
				const spy = new Spy(new ExternalService(result));

				for (let i = 0; i < 3; i++) {
					expect(spy.suspect.syncMethodWithNoArgsMitMedicine()).to.be.eq(result);
					expect(spy.calls('syncMethodWithNoArgsMitMedicine')).to.be.eq(1);
				}
			});

			it('should memoize result of method with arguments', () => {
				const result = number.generateRandomInt(0, 10);
				const argument = 'domain';
				const spy = new Spy(new ExternalService(result));

				for (let i = 0; i < 3; i++) {
					expect(spy.suspect.syncMethodWithArgsHarvardMedicine(argument)).to.be.eq(argument);
					expect(spy.calls(spy.suspect.syncMethodWithArgsHarvardMedicine.name)).to.be.eq(1);
				}
			});

			it('should memoize results provided by custom location resolver', () => {
				const result = number.generateRandomInt(0, 10);
				const domain = 'domain';
				const name = 'name';
				const spy = new Spy(new ExternalService(result));

				expect(spy.suspect.syncMethodWithLocationResolverHarvardMedicine(domain, name)).to.be.eq(domain + name);
				expect(spy.calls(spy.suspect.syncMethodWithLocationResolverHarvardMedicine.name)).to.be.eq(1);

				for (let i = 0; i < 5; i++) {
					// caches per domain, while name is ignored
					expect(spy.suspect.syncMethodWithLocationResolverHarvardMedicine(domain, string.generateStringOfLength(5))).to.be.eq(domain + name);
					expect(spy.calls(spy.suspect.syncMethodWithLocationResolverHarvardMedicine.name)).to.be.eq(1);
				}
			});

			for (const falsy of FALSY_VALUES) {
				it(`should memoize falsy result '${falsy}' of method`, () => {
					const spy = new Spy(new ExternalService(falsy));

					for (let i = 0; i < 3; i++) {
						expect(spy.suspect.syncMethodWithNoArgsMitMedicine()).to.be.eq(falsy);
						expect(spy.calls(spy.suspect.syncMethodWithNoArgsMitMedicine.name)).to.be.eq(1);
					}
				});
			}

			it('should memoize under local scope', () => {});

			it('should memoize under shared scope', () => {});

			it('should not create location conflicts', () => {});

			it('should not memoize nullable values of method without arguments', () => {});

			it('should not memoize nullable values of method with arguments', () => {});

			it('should not memoize if method throws', () => {});

			it('should not allow to define memoize multiple times', () => {});
		});

		describe('async method', function () {
			it('should memoize result of method without arguments', async () => {});

			it('should memoize result of method with arguments', async () => {});

			it('should not memoize nullable values of method without arguments', async () => {});

			it('should not memoize nullable values of method with arguments', async () => {});

			it('should not memoize if method throws', async () => {});

			it('should memoize result only once', async () => {});

			it('should not allow to define memoize multiple times', () => {});
		});
	});

	describe('amnesia spec', function () {
		describe('sync method', function () {
			it('should forget the whole region', () => {});

			it('should forget the whole zone', () => {});

			it('should forget a specific location', () => {});
		});

		describe('async method', function () {
			it('should forget the whole region', async () => {});

			it('should forget the whole zone', async () => {});

			it('should forget a specific location', async () => {});
		});
	});
});
