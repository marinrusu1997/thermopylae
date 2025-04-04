import { describe, expect, it } from 'vitest';
import { MethodInvoker } from '../lib/method.js';

describe('method invoker spec', () => {
	it('invokes function whith provided this argument', () => {
		function func(): number {
			// @ts-ignore This is just a test
			return this.a + this.b;
		}
		const thisObj = { a: 1, b: 1 };
		const sum = new MethodInvoker(func).thisArg(thisObj).safeInvokeSync();
		expect(sum).to.be.equal(2);
	});

	it("invokes sync func which doesn't throw and returns her result", () => {
		const func = (a: number, b: number): number => a + b;
		const sum = new MethodInvoker(func, 1, 1).safeInvokeSync();
		expect(sum).to.be.equal(2);
	});

	it("invokes async func which doesn't throw and returns her result", async () => {
		const func = (a: number, b: number): Promise<number> => Promise.resolve(a + b);
		const sum = await new MethodInvoker(func, 1, 1).safeInvokeAsync();
		expect(sum).to.be.equal(2);
	});

	it('invokes sync function which throws (error handler not specified)', () => {
		const func = (a: number, b: number): number => {
			const sum = a + b;
			if (sum === 2) {
				throw new Error();
			}
			return sum;
		};
		const sum = new MethodInvoker(func, 1, 1).safeInvokeSync();
		expect(sum).to.be.equal(undefined);
	});

	it('invokes sync function which throws (error handler is specified)', async () => {
		expect.hasAssertions();

		const func = (a: number, b: number): number => {
			const sum = a + b;
			if (sum === 2) {
				throw new Error();
			}
			return sum;
		};
		const errorHandler = (error: Error): void => {
			expect(error).to.be.instanceOf(Error);
		};
		new MethodInvoker(func, 1, 1).errHandler(errorHandler).safeInvokeSync();
	});

	it('invokes async function which throws (error handler not specified)', async () => {
		const func = (a: number, b: number): Promise<number> => {
			const sum = a + b;
			if (sum === 2) {
				throw new Error();
			}
			return Promise.resolve(sum);
		};
		const sum = await new MethodInvoker(func, 1, 1).safeInvokeAsync();
		expect(sum).to.be.equal(undefined);
	});

	it('invokes async function which throws (error handler is specified)', async () => {
		expect.hasAssertions();

		const func = (a: number, b: number): Promise<number> => {
			const sum = a + b;
			if (sum === 2) {
				throw new Error();
			}
			return Promise.resolve(sum);
		};
		const errorHandler = (error: Error): void => {
			expect(error).to.be.instanceOf(Error);
		};
		await new MethodInvoker(func, 1, 1).errHandler(errorHandler).safeInvokeAsync();
	});
});
