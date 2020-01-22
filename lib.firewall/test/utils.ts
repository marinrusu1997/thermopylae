import { services, string } from '@marin/lib.utils';
import { expect } from 'chai';
import { Firewall } from '../lib';

async function testType(service: services.SERVICES, method: string, data: object, dataPath: string, type: string): Promise<void> {
	let err;
	try {
		await Firewall.validate(service, method, data);
	} catch (e) {
		err = e;
	}
	expect(err.message).to.be.eq('validation failed');
	expect(err.errors.length).to.be.eq(1);
	expect(err.errors[0].keyword).to.be.eq('type');
	expect(err.errors[0].dataPath).to.be.eq(dataPath);
	expect(err.errors[0].message).to.be.eq(`should be ${type}`);
}

async function testPattern(service: services.SERVICES, method: string, data: object, dataPath: string, pattern: string): Promise<void> {
	let err;
	try {
		await Firewall.validate(service, method, data);
	} catch (e) {
		err = e;
	}
	expect(err.message).to.be.eq('validation failed');
	expect(err.errors.length).to.be.eq(1);
	expect(err.errors[0].keyword).to.be.eq('pattern');
	expect(err.errors[0].dataPath).to.be.eq(dataPath);
	expect(err.errors[0].message).to.be.eq(`should match pattern "${pattern}"`);
}

async function testFormat(service: services.SERVICES, method: string, data: object, dataPath: string, format: string): Promise<void> {
	let err;
	try {
		await Firewall.validate(service, method, data);
	} catch (e) {
		err = e;
	}
	expect(err.message).to.be.eq('validation failed');
	expect(err.errors.length).to.be.eq(1);
	expect(err.errors[0].keyword).to.be.eq('format');
	expect(err.errors[0].dataPath).to.be.eq(dataPath);
	expect(err.errors[0].message).to.be.eq(`should match format "${format}"`);
}

async function testMinLength(service: services.SERVICES, method: string, data: object, dataPath: string, length: number): Promise<void> {
	let err;
	try {
		await Firewall.validate(service, method, data);
	} catch (e) {
		err = e;
	}
	expect(err.message).to.be.eq('validation failed');
	expect(err.errors.length).to.be.eq(1);
	expect(err.errors[0].keyword).to.be.eq('minLength');
	expect(err.errors[0].dataPath).to.be.eq(dataPath);
	expect(err.errors[0].message).to.be.eq(`should NOT be shorter than ${length} characters`);
}

async function testMaxLength(service: services.SERVICES, method: string, data: object, dataPath: string, length: number): Promise<void> {
	let err;
	try {
		await Firewall.validate(service, method, data);
	} catch (e) {
		err = e;
	}
	expect(err.message).to.be.eq('validation failed');
	expect(err.errors.length).to.be.eq(1);
	expect(err.errors[0].keyword).to.be.eq('maxLength');
	expect(err.errors[0].dataPath).to.be.eq(dataPath);
	expect(err.errors[0].message).to.be.eq(`should NOT be longer than ${length} characters`);
}

async function testRequired(service: services.SERVICES, method: string, data: object, dataPath: string, requiredProperty: string | string[]): Promise<void> {
	let err;
	try {
		await Firewall.validate(service, method, data);
	} catch (e) {
		err = e;
	}
	expect(err.message).to.be.eq('validation failed');
	expect(err.errors.length).to.be.eq(1);
	expect(err.errors[0].keyword).to.be.eq('required');
	expect(err.errors[0].dataPath).to.be.eq(dataPath);
	if (Array.isArray(requiredProperty)) {
		expect(err.errors[0].message).to.be.oneOf(requiredProperty.map(prop => `should have required property '${prop}'`));
	} else {
		expect(err.errors[0].message).to.be.eq(`should have required property '${requiredProperty}'`);
	}
}

async function testPassesValidation(service: services.SERVICES, method: string, data: object): Promise<void> {
	expect(await Firewall.validate(service, method, data)).to.be.deep.eq(data);
}

async function testMinValue(service: services.SERVICES, method: string, data: object, dataPath: string, value: number): Promise<void> {
	let err;
	try {
		await Firewall.validate(service, method, data);
	} catch (e) {
		err = e;
	}
	expect(err.message).to.be.eq('validation failed');
	expect(err.errors.length).to.be.eq(1);
	expect(err.errors[0].keyword).to.be.eq('minimum');
	expect(err.errors[0].dataPath).to.be.eq(dataPath);
	expect(err.errors[0].message).to.be.eq(`should be >= ${value}`);
}

async function testEnum(service: services.SERVICES, method: string, data: object, dataPath: string): Promise<void> {
	let err;
	try {
		await Firewall.validate(service, method, data);
	} catch (e) {
		err = e;
	}
	expect(err.message).to.be.eq('validation failed');
	expect(err.errors.length).to.be.eq(1);
	expect(err.errors[0].keyword).to.be.eq('enum');
	expect(err.errors[0].dataPath).to.be.eq(dataPath);
	expect(err.errors[0].message).to.be.eq('should be equal to one of the allowed values');
}

async function testAdditionalProperties(service: services.SERVICES, method: string, data: object): Promise<void> {
	let err;
	try {
		await Firewall.validate(service, method, data);
	} catch (e) {
		err = e;
	}
	expect(err.message).to.be.eq('validation failed');
	expect(err.errors.length).to.be.eq(1);
	expect(err.errors[0].keyword).to.be.eq('additionalProperties');
	expect(err.errors[0].dataPath).to.be.eq('');
	expect(err.errors[0].message).to.be.eq('should NOT have additional properties');
}

const { generateString } = string;

export {
	generateString,
	testType,
	testMinValue,
	testPattern,
	testFormat,
	testMinLength,
	testMaxLength,
	testRequired,
	testPassesValidation,
	testEnum,
	testAdditionalProperties
};
