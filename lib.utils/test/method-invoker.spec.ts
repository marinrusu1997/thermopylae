import { describe, it } from 'mocha';
import { chai } from './chai';
import { MethodInvoker } from '../lib/method';

const { expect } = chai;

describe('method invoker spec', () => {
	it('invokes function whith provided this argument', () => {
		function func(this: any): number {
			// eslint-disable-next-line no-unused-expressions
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

	it("invokes async func which doesn't throw and returns her result", done => {
		const func = (a: number, b: number): Promise<number> => Promise.resolve(a + b);
		new MethodInvoker(func, 1, 1)
			.safeInvokeAsync()
			.then((sum: number) => {
				expect(sum).to.be.equal(2);
				done();
			})
			.catch(error => done(error));
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

	it('invokes sync function which throws (error handler is specified)', done => {
		const func = (a: number, b: number): number => {
			const sum = a + b;
			if (sum === 2) {
				throw new Error();
			}
			return sum;
		};
		const errorHandler = (error: Error): void => {
			expect(error).to.be.instanceOf(Error);
			done();
		};
		const sum = new MethodInvoker(func, 1, 1).errHandler(errorHandler).safeInvokeSync();
		expect(sum).to.be.equal(undefined);
	});

	it('invokes async function which throws (error handler not specified)', done => {
		const func = (a: number, b: number): Promise<number> => {
			const sum = a + b;
			if (sum === 2) {
				throw new Error();
			}
			return Promise.resolve(sum);
		};
		new MethodInvoker(func, 1, 1)
			.safeInvokeAsync()
			.then((sum: number) => {
				expect(sum).to.be.equal(undefined);
				done();
			})
			.catch(error => done(error));
	});

	it('invokes async function which throws (error handler is specified)', done => {
		const func = (a: number, b: number): Promise<number> => {
			const sum = a + b;
			if (sum === 2) {
				throw new Error();
			}
			return Promise.resolve(sum);
		};
		const errorHandler = (error: Error): void => {
			expect(error).to.be.instanceOf(Error);
			done();
		};
		new MethodInvoker(func, 1, 1)
			.errHandler(errorHandler)
			.safeInvokeAsync()
			.then((sum: number) => {
				expect(sum).to.be.equal(undefined);
			})
			.catch(error => done(error));
	});
});
