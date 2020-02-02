import { describe, it } from 'mocha';
import { chai } from './chai';
import { runInSeries, toPromise } from '../lib/async';

const { expect } = chai;

describe('async spec', () => {
	describe('runInSeries spec', () => {
		it('runs async functions in series (no start value)', async () => {
			const fun1 = async () => 1;
			const fun2 = async (prevVal: number) => {
				expect(prevVal).to.be.eq(1);
				return 2;
			};
			const fun3 = async (prevVal: number) => {
				expect(prevVal).to.be.eq(2);
				return 3;
			};
			expect(await runInSeries([fun1, fun2, fun3])).to.be.equalTo([1, 2, 3]);
		});

		it('runs async functions in series (with start value)', async () => {
			const fun1 = async (prevVal: number) => {
				expect(prevVal).to.be.eq(0);
				return 1;
			};
			const fun2 = async (prevVal: number) => {
				expect(prevVal).to.be.eq(1);
				return 2;
			};
			const fun3 = async (prevVal: number) => {
				expect(prevVal).to.be.eq(2);
				return 3;
			};
			expect(await runInSeries([fun1, fun2, fun3], 0)).to.be.equalTo([1, 2, 3]);
		});
	});

	describe('toPromise spec', () => {
		it('returns same promise if passing a promise', async () => {
			expect(await toPromise(Promise.resolve(1))).to.be.eq(1);
		});

		it('creates new promise if passing a value', async () => {
			expect(await toPromise(1)).to.be.eq(1);
		});
	});
});
