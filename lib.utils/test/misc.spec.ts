import { describe, it } from 'mocha';
import { chai } from './chai';
import { isEmptyObject, traverse } from '../lib/object';

const { expect } = chai;

describe('misc spec', () => {
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
			traverse(obj, () => {
				processedLeafs += 1;
				return 'processedValue';
			})
		).to.be.deep.eq(obj);

		expect(processedLeafs).to.be.eq(12); // only boolean, number and strings are processed

		expect(obj.strVal).to.be.eq('processedValue');
		expect(obj.boolVal).to.be.eq('processedValue');
		expect(obj.numVal).to.be.eq('processedValue');
		expect(obj.objVal.strVal).to.be.eq('processedValue');
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
});
