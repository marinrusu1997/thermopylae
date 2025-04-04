import type { ObjMap } from '@thermopylae/core.declarations';
import { describe, expect, it } from 'vitest';
import { type TraverseProcessor, flatten, isEmpty, isObject, sort, traverse } from '../lib/object.js';

describe('object spec', () => {
	describe(`${isObject.name} spec`, () => {
		it('checks that value is an object', () => {
			const undef = undefined;
			expect(isObject(undef)).to.be.eq(false);
			expect(isObject(null)).to.be.eq(false);
			expect(isObject(true)).to.be.eq(false);
			expect(isObject(1)).to.be.eq(false);
			expect(isObject('1')).to.be.eq(false);
			expect(isObject(['1'])).to.be.eq(false);
			expect(isObject(Symbol('1'))).to.be.eq(false);
			expect(isObject(() => ({}))).to.be.eq(false);
			expect(isObject({})).to.be.eq(true);
		});
	});

	describe(`${isEmpty.name} spec`, () => {
		it('checks correctly that an object is empty', () => {
			expect(isEmpty({})).to.be.eq(true);
			expect(isEmpty({ key: 'val' })).to.be.eq(false);
			expect(isEmpty(new Date() as unknown as Record<string, unknown>)).to.be.eq(false);
		});
	});

	describe(`${traverse.name} spec`, () => {
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
							objVal: {
								arrVal: [1]
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
					if (key.includes('arrVal')) {
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
			// @ts-expect-error This is just a testa test
			expect(obj.objVal.objVal.arrVal[3].strKey).to.be.eq('processedValue');
			expect(obj.arrVal[0]).to.be.eq('processedValue');
			expect(obj.arrVal[1]).to.be.eq('processedValue');
			// @ts-expect-error This is just a testa test
			expect(obj.arrVal[2].strVal).to.be.eq('processedValue');
			// @ts-expect-error This is just a testa test
			expect(obj.arrVal[2].objVal.objVal.arrVal[0]).to.be.eq('processedValue');
		});

		it('traverses a heterogenous array', () => {
			const arr = [
				true,
				1,
				'str',
				{
					str: 'value',
					obj: {
						num: 1
					}
				},
				null,
				undefined
			] as const;

			const processor: TraverseProcessor = (key, val) => {
				expect(key).to.be.oneOf(['[0]', '[1]', '[2]', '[3].str', '[3].obj.num', '[4]', '[5]']);
				return typeof val === 'string' ? val : 'processedValue';
			};

			const arrClone = traverse(arr, processor, true); // just to ease checks bellow without ts errors
			expect(arrClone).to.not.be.eq(arr); // cloned array
			expect(arrClone[3]).to.not.be.eq(arr[3]); // deep cloned
			expect(arrClone[3].str).to.be.eq((arr[3] as ObjMap)['str']); // deep cloned with internal str key

			expect(arrClone[0]).to.be.eq('processedValue');
			expect(arrClone[1]).to.be.eq('processedValue');
			expect(arrClone[2]).to.be.eq('str');
			expect(arrClone[3].str).to.be.eq('value');
			expect(arrClone[3].obj.num).to.be.eq('processedValue');
			expect(arrClone[4]).to.be.eq('processedValue');
			expect(arrClone[5]).to.be.eq('processedValue');
		});
	});

	describe(`${sort.name} spec`, () => {
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

		function checkObjectIsSorted(sorted: ObjMap): void {
			expect(Object.keys(sorted)).toStrictEqual(['a', 'b', 'c', 'd', 'e']);
			expect(Object.keys(sorted['b'])).toStrictEqual(['a', 'b']);
			expect(Object.keys(sorted['c'])).toStrictEqual(['a', 'b']);
			expect(Object.keys(sorted['c'].b)).toStrictEqual(['a', 'b', 'c']);
			expect(Object.keys(sorted['c'].b.c)).toStrictEqual(['a']);
		}

		it('sorts an object (array sort disabled)', () => {
			const sorted = sort(obj, false) as ObjMap;

			checkObjectIsSorted(sorted);

			expect(sorted['b'].b).toStrictEqual([2, '1', '2']);
			expect(Object.keys(sorted['c'].b.b[2])).toStrictEqual(['b', 'a']);
		});

		it('sorts an object (array sort enabled)', () => {
			const sorted = sort(obj) as ObjMap;

			checkObjectIsSorted(sorted);

			expect(sorted['b'].b).toStrictEqual(['1', '2', 2]);
			expect(Object.keys(sorted['c'].b.b[2])).toStrictEqual(['a', 'b']);
		});
	});

	describe(`${flatten.name} spec`, () => {
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
			const flattened = flatten(obj) as Record<string, unknown>;

			expect(flattened).to.be.deep.eq(expected);
			expect(Object.keys(flattened).length).to.be.eq(12);
		});
	});
});
