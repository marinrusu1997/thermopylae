import fastJSON from 'fast-json-stringify';
import type { UserSessionMetaData } from '@thermopylae/lib.jwt-session';
import type { HTTPRequestLocation } from '@thermopylae/core.declarations';
import type { JwtSessionDevice, UserSessionMetaDataSerializer } from '../../typings';

/**
 * @private
 */
const FAST_JSON_SCHEMA = fastJSON(
	{
		title: 'User Session Meta Data Schema',
		type: 'object',
		properties: {
			ip: { type: 'string', nullable: false },
			device: {
				type: 'object',
				properties: {
					name: { type: 'string', nullable: false },
					type: { type: 'string', nullable: false },
					client: {
						type: 'object',
						properties: {
							name: { type: 'string', nullable: false },
							type: { type: 'string', nullable: false },
							version: { type: 'string', nullable: false }
						},
						required: ['name', 'type', 'version'],
						default: null,
						nullable: true,
						additionalProperties: true
					},
					os: {
						type: 'object',
						properties: {
							name: { type: 'string', nullable: false },
							version: { type: 'string', nullable: false },
							platform: { type: 'string', nullable: false }
						},
						required: ['name', 'version', 'platform'],
						default: null,
						nullable: true,
						additionalProperties: false
					}
				},
				required: ['name', 'type', 'client', 'os'],
				default: null,
				nullable: true,
				additionalProperties: false
			},
			location: {
				type: 'object',
				properties: {
					countryCode: { type: 'string', nullable: true },
					regionCode: { type: 'string', nullable: true },
					city: { type: 'string', nullable: true },
					latitude: { type: 'number', nullable: true },
					longitude: { type: 'number', nullable: true },
					timezone: { type: 'string', nullable: true }
				},
				required: ['countryCode', 'regionCode', 'city', 'latitude', 'longitude', 'timezone'],
				default: null,
				nullable: true,
				additionalProperties: false
			},
			createdAt: { type: 'integer', nullable: false }
		},
		required: ['ip', 'device', 'location', 'createdAt'],
		nullable: false,
		additionalProperties: false
	},
	{
		ajv: {
			allErrors: true,
			verbose: true,
			strictNumbers: true
		},
		rounding: 'round'
	}
);

/**
 * @private
 */
const FAST_JSON_SERIALIZER: Readonly<UserSessionMetaDataSerializer> = Object.freeze({
	serialize(session: UserSessionMetaData<JwtSessionDevice, HTTPRequestLocation>): Buffer {
		return Buffer.from(FAST_JSON_SCHEMA(session));
	},
	deserialize(buffer: Buffer): UserSessionMetaData<JwtSessionDevice, HTTPRequestLocation> {
		return JSON.parse((buffer as unknown) as string);
	}
});

export { FAST_JSON_SERIALIZER };
