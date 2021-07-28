import { JSONSchema } from 'json-schema-typed';
import deepFreeze from 'deep-freeze';

const PersonJsonSchema: JSONSchema = {
	$schema: 'http://json-schema.org/draft-07/schema',
	type: 'object',
	properties: {
		id: {
			type: 'string',
			minLength: 5,
			maxLength: 36
		},
		firstName: {
			type: 'string',
			maxLength: 50
		},
		birthYear: {
			type: 'integer',
			minimum: 1990,
			maximum: 2020
		},
		address: {
			type: 'object',
			properties: {
				countryCode: {
					type: 'string',
					minLength: 2,
					maxLength: 3
				},
				city: {
					type: 'string',
					minLength: 2
				}
			},
			required: ['countryCode', 'city'],
			additionalProperties: false
		},
		finance: {
			type: 'object',
			properties: {
				bank: {
					type: 'object',
					properties: {
						name: {
							type: 'string',
							minLength: 3
						}
					},
					required: ['name'],
					additionalProperties: false
				},
				transactions: {
					type: 'array',
					items: {
						type: 'object',
						properties: {
							transactionType: {
								type: 'string',
								minLength: 2
							},
							amount: {
								type: 'string'
							},
							currencySymbol: {
								type: 'string',
								minLength: 1
							}
						},
						required: ['transactionType', 'amount', 'currencySymbol'],
						additionalProperties: false
					}
				}
			},
			required: ['bank', 'transactions'],
			additionalProperties: false
		},
		visitedCountries: {
			type: 'array',
			items: {
				type: 'string',
				minLength: 2,
				maxLength: 3
			}
		}
	},
	required: ['id', 'firstName', 'birthYear', 'address', 'finance', 'visitedCountries'],
	additionalProperties: false
};
deepFreeze(PersonJsonSchema);

export { PersonJsonSchema };
