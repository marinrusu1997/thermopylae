import { describe, it } from 'mocha';
import { chai } from './chai';
import { isEmptyObject, traverse } from '../lib/object';

const { expect } = chai;

describe('object spec', () => {
	it('checks correctly that an object is empty', () => {
		expect(isEmptyObject({})).to.be.eq(true);
		expect(isEmptyObject({ key: 'val' })).to.be.eq(false);
		expect(isEmptyObject(new Date())).to.be.eq(false);
	});

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
