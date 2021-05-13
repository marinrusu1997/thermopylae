import fastJSON, { ObjectSchema } from 'fast-json-stringify';
import cloneDeep from 'lodash.clonedeep';
import type { HTTPRequestLocation } from '@thermopylae/core.declarations';
import type { UserSessionMetaData } from '@thermopylae/lib.user-session';
import type { UserSessionDevice, UserSessionMetaDataSerializer } from '../../../typings';
import { FAST_JSON_SCHEMA } from '../common/fast-json-schema';

/**
 * @private
 */
const SCHEMA: ObjectSchema = cloneDeep(FAST_JSON_SCHEMA);
SCHEMA.properties!['accessedAt'] = { type: 'integer', nullable: false };
SCHEMA.required!.push('accessedAt');

/**
 * @private
 */
const FAST_JSON = fastJSON(SCHEMA, {
	ajv: {
		allErrors: true,
		verbose: true,
		strictNumbers: true
	},
	rounding: 'round'
});

/**
 * @private
 */
const FAST_JSON_SERIALIZER: Readonly<UserSessionMetaDataSerializer<UserSessionMetaData<UserSessionDevice, HTTPRequestLocation>>> = Object.freeze({
	serialize(session: UserSessionMetaData<UserSessionDevice, HTTPRequestLocation>): Buffer {
		return Buffer.from(FAST_JSON(session));
	},
	deserialize(buffer: Buffer): UserSessionMetaData<UserSessionDevice, HTTPRequestLocation> {
		return JSON.parse(buffer as unknown as string);
	}
});

export { FAST_JSON_SERIALIZER };
