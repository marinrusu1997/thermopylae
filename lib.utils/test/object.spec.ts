import { describe, it } from 'mocha';
import { chai } from './chai';
import { flatten, isEmpty, isObject, sort, traverse } from '../lib/object';

const { expect } = chai;

describe('object spec', () => {
	describe('isObject spec', () => {
		it('checks that value is an object', () => {
			expect(isObject(undefined)).to.be.eq(false);
			expect(isObject(null)).to.be.eq(false);
			expect(isObject(true)).to.be.eq(false);
			expect(isObject(1)).to.be.eq(false);
			expect(isObject('1')).to.be.eq(false);
			expect(isObject(['1'])).to.be.eq(false);
			expect(isObject(Symbol('1'))).to.be.eq(false);
			expect(isObject(() => {})).to.be.eq(false);
			expect(isObject({})).to.be.eq(true);
		});
	});

	describe('isEmpty spec', () => {
		it('checks correctly that an object is empty', () => {
			expect(isEmpty({})).to.be.eq(true);
			expect(isEmpty({ key: 'val' })).to.be.eq(false);
			expect(isEmpty(new Date())).to.be.eq(false);
		});
	});

	describe('traverse spec', () => {
		it('traverses object and processes its leafs', () => {
			const obj = {
				strVal: 'value',
				boolVal: true,
				numVal: 1,
				objVal: {
					strVal: 'str',
					objVal: {
						arrVal: [1, true, 'str', { strKey: 'val' }]
					}
				},
				arrVal: [
					'val',
					true,
					{
						strVal: 'value',
						objVal: {
							symbolVal: Symbol('sumbol'),
							functionVal: () => {},
							objVal: {
								arrVal: [1, () => {}, Symbol('symbol')]
							}
						}
					}
				]
			};
			expect(traverse(obj, () => 'processed', true)).to.not.be.deep.eq(obj);

			let processedLeafs = 0;
			expect(
				traverse(obj, (key, val) => {
					processedLeafs += 1;
					expect(key).to.be.oneOf([
						'strVal',
						'boolVal',
						'numVal',
						'objVal.strVal',
						'objVal.objVal.arrVal.[0]',
						'objVal.objVal.arrVal.[1]',
						'objVal.objVal.arrVal.[2]',
						'objVal.objVal.arrVal.[3].strKey',
						'arrVal.[0]',
						'arrVal.[1]',
						'arrVal.[2].strVal',
						'arrVal.[2].objVal.objVal.arrVal.[0]'
					]);
					if (key.indexOf('arrVal') !== -1) {
						return 'processedValue';
					}
					return val;
				})
			).to.be.deep.eq(obj);

			expect(processedLeafs).to.be.eq(12); // only boolean, number and strings are processed

			expect(obj.strVal).to.be.eq('value');
			expect(obj.boolVal).to.be.eq(true);
			expect(obj.numVal).to.be.eq(1);
			expect(obj.objVal.strVal).to.be.eq('str');
			expect(obj.objVal.objVal.arrVal[0]).to.be.eq('processedValue');
			expect(obj.objVal.objVal.arrVal[1]).to.be.eq('processedValue');
			expect(obj.objVal.objVal.arrVal[2]).to.be.eq('processedValue');
			// eslint-disable-next-line @typescript-eslint/ban-ts-ignore
			// @ts-ignore
			expect(obj.objVal.objVal.arrVal[3].strKey).to.be.eq('processedValue');
			expect(obj.arrVal[0]).to.be.eq('processedValue');
			expect(obj.arrVal[1]).to.be.eq('processedValue');
			// eslint-disable-next-line @typescript-eslint/ban-ts-ignore
			// @ts-ignore
			expect(obj.arrVal[2].strVal).to.be.eq('processedValue');
			// eslint-disable-next-line @typescript-eslint/ban-ts-ignore
			// @ts-ignore
			expect(obj.arrVal[2].objVal.objVal.arrVal[0]).to.be.eq('processedValue');
		});

		it('traverses a heterogenous array', () => {
			const arr = [
				true,
				1,
				'str',
				Symbol('str'),
				() => {},
				{
					str: 'value',
					obj: {
						fun: () => {},
						sym: Symbol('s'),
						num: 1
					}
				},
				null,
				undefined
			];
			traverse(arr, (key, val) => {
				expect(key).to.be.oneOf(['[0]', '[1]', '[2]', '[5].str', '[5].obj.num', '[6]', '[7]']);
				return typeof val !== 'string' ? 'processedValue' : val;
			});

			expect(arr[0]).to.be.eq('processedValue');
			expect(arr[1]).to.be.eq('processedValue');
			expect(arr[2]).to.be.eq('str');
			expect(typeof arr[3]).to.be.eq('symbol');
			expect(typeof arr[4]).to.be.eq('function');
			// eslint-disable-next-line @typescript-eslint/ban-ts-ignore
			// @ts-ignore
			expect(arr[5].str).to.be.eq('value');
			// eslint-disable-next-line @typescript-eslint/ban-ts-ignore
			// @ts-ignore
			expect(typeof arr[5].obj.fun).to.be.eq('function');
			// eslint-disable-next-line @typescript-eslint/ban-ts-ignore
			// @ts-ignore
			expect(typeof arr[5].obj.sym).to.be.eq('symbol');
			// eslint-disable-next-line @typescript-eslint/ban-ts-ignore
			// @ts-ignore
			expect(arr[5].obj.num).to.be.eq('processedValue');
			expect(arr[6]).to.be.eq('processedValue');
			expect(arr[7]).to.be.eq('processedValue');
		});
	});

	describe('sort spec', () => {
		const obj = {
			b: {
				b: [2, '1', '2'],
				a: 1
			},
			a: '1',
			c: {
				b: {
					c: {
						a: 1
					},
					a: 1,
					b: [
						4,
						3,
						{
							b: 1,
							a: 1
						}
					]
				},
				a: 1
			},
			e: /[0-9]/,
			d: null
		};

		function checkObjectIsSorted(sorted: any): void {
			expect(Object.keys(sorted)).to.be.equalTo(['a', 'b', 'c', 'd', 'e']);
			expect(Object.keys(sorted.b)).to.be.equalTo(['a', 'b']);
			expect(Object.keys(sorted.c)).to.be.equalTo(['a', 'b']);
			expect(Object.keys(sorted.c.b)).to.be.equalTo(['a', 'b', 'c']);
			expect(Object.keys(sorted.c.b.c)).to.be.equalTo(['a']);
		}

		it('sorts an object (array sort disabled)', () => {
			const sorted = sort(obj, false) as any;

			checkObjectIsSorted(sorted);

			expect(sorted.b.b).to.be.equalTo([2, '1', '2']);
			expect(Object.keys(sorted.c.b.b[2])).to.be.equalTo(['b', 'a']);
		});

		it('sorts an object (array sort enabled)', () => {
			const sorted = sort(obj) as any;

			checkObjectIsSorted(sorted);

			expect(sorted.b.b).to.be.equalTo(['1', '2', 2]);
			expect(Object.keys(sorted.c.b.b[2])).to.be.equalTo(['a', 'b']);
		});
	});

	describe('flatten spec', () => {
		it('flattens an object', () => {
			const symbol = Symbol('sym');

			const prototype = {
				x: 123
			};

			const obj = {
				a: 1,
				b: {
					a: [
						1,
						'2',
						{
							a: 1,
							b: {
								a: true,
								b: [1, '3']
							}
						}
					]
				},
				c: {
					a: {
						a: {
							a: '1',
							b: true
						}
					},
					b: null,
					c: {
						a: undefined,
						b: symbol
					}
				}
			};
			Object.setPrototypeOf(obj, prototype);
			Object.setPrototypeOf(obj.c.a, prototype);

			const expected = {
				a: 1,
				'b.a.[0]': 1,
				'b.a.[1]': '2',
				'b.a.[2].a': 1,
				'b.a.[2].b.a': true,
				'b.a.[2].b.b.[0]': 1,
				'b.a.[2].b.b.[1]': '3',
				'c.a.a.a': '1',
				'c.a.a.b': true,
				'c.b': null,
				'c.c.a': undefined,
				'c.c.b': symbol
			};
			const flattened = flatten(obj);

			expect(flattened).to.be.deep.eq(expected);
			expect(Object.keys(flattened).length).to.be.eq(12);
		});
	});
});