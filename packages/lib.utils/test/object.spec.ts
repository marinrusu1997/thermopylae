import { chai } from '@thermopylae/lib.unit-test';
import { describe, it } from 'mocha';
import { ObjMap } from '@thermopylae/core.declarations';
import { clone, cloneDeep, flatten, isEmpty, isObject, sort, traverse, TraverseProcessor } from '../lib/object';

const { expect } = chai;

describe('object spec', () => {
	describe(`${clone.name} spec`, () => {
		it('should do a shallow clone', () => {
			const obj = {
				a: 1,
				b: {
					c: 1
				}
			};
			const copy = clone(obj);

			expect(copy).not.to.be.eq(obj); // different references
			expect(copy.a).to.be.eq(obj.a); // same values

			obj.b.c = 2;
			expect(copy.b.c).to.be.eq(obj.b.c); // they share same object under property
		});
	});

	describe(`${cloneDeep.name} spec`, () => {
		it('should do a deep clone', () => {
			const obj = {
				a: 1,
				b: {
					c: 1
				}
			};
			const copy = cloneDeep(obj);

			expect(copy).not.to.be.eq(obj); // different references
			expect(copy.a).to.be.eq(obj.a); // same values

			obj.b.c = 2;
			expect(copy.b.c).not.to.be.eq(obj.b.c); // they don't share same object under property
		});
	});

	describe(`${isObject.name} spec`, () => {
		it('checks that value is an object', () => {
			expect(isObject(undefined)).to.be.eq(false);
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
							symbolVal: Symbol('sumbol'),
							functionVal: () => ({}),
							objVal: {
								arrVal: [1, () => ({}), Symbol('symbol')]
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
			// @ts-ignore
			expect(obj.objVal.objVal.arrVal[3].strKey).to.be.eq('processedValue');
			expect(obj.arrVal[0]).to.be.eq('processedValue');
			expect(obj.arrVal[1]).to.be.eq('processedValue');
			// @ts-ignore
			expect(obj.arrVal[2].strVal).to.be.eq('processedValue');
			// @ts-ignore
			expect(obj.arrVal[2].objVal.objVal.arrVal[0]).to.be.eq('processedValue');
		});

		it('traverses a heterogenous array', () => {
			const arr = [
				true,
				1,
				'str',
				Symbol('str'),
				() => ({}),
				{
					str: 'value',
					obj: {
						fun: () => ({}),
						sym: Symbol('s'),
						num: 1
					}
				},
				null,
				undefined
			];

			const processor: TraverseProcessor = (key, val) => {
				expect(key).to.be.oneOf(['[0]', '[1]', '[2]', '[5].str', '[5].obj.num', '[6]', '[7]']);
				return typeof val !== 'string' ? 'processedValue' : val;
			};

			const arrClone = traverse(arr, processor, true) as Array<any>; // just to ease checks bellow without ts errors
			expect(arrClone).to.not.be.eq(arr); // cloned array
			expect(arrClone[5]).to.not.be.eq(arr[5]); // deep cloned
			expect(arrClone[5].str).to.be.eq((arr[5] as ObjMap)['str']); // deep cloned with internal str key

			expect(arrClone[0]).to.be.eq('processedValue');
			expect(arrClone[1]).to.be.eq('processedValue');
			expect(arrClone[2]).to.be.eq('str');
			expect(typeof arrClone[3]).to.be.eq('symbol');
			expect(typeof arrClone[4]).to.be.eq('function');
			expect(arrClone[5].str).to.be.eq('value');
			expect(typeof arrClone[5].obj.fun).to.be.eq('function');
			expect(typeof arrClone[5].obj.sym).to.be.eq('symbol');
			expect(arrClone[5].obj.num).to.be.eq('processedValue');
			expect(arrClone[6]).to.be.eq('processedValue');
			expect(arrClone[7]).to.be.eq('processedValue');
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
			expect(Object.keys(sorted)).to.be.equalTo(['a', 'b', 'c', 'd', 'e']);
			expect(Object.keys(sorted['b'])).to.be.equalTo(['a', 'b']);
			expect(Object.keys(sorted['c'])).to.be.equalTo(['a', 'b']);
			expect(Object.keys(sorted['c'].b)).to.be.equalTo(['a', 'b', 'c']);
			expect(Object.keys(sorted['c'].b.c)).to.be.equalTo(['a']);
		}

		it('sorts an object (array sort disabled)', () => {
			const sorted = sort(obj, false) as ObjMap;

			checkObjectIsSorted(sorted);

			expect(sorted['b'].b).to.be.equalTo([2, '1', '2']);
			expect(Object.keys(sorted['c'].b.b[2])).to.be.equalTo(['b', 'a']);
		});

		it('sorts an object (array sort enabled)', () => {
			const sorted = sort(obj) as ObjMap;

			checkObjectIsSorted(sorted);

			expect(sorted['b'].b).to.be.equalTo(['1', '2', 2]);
			expect(Object.keys(sorted['c'].b.b[2])).to.be.equalTo(['a', 'b']);
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
