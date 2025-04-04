import type { HTTPRequestLocation } from '@thermopylae/core.declarations';
import type { UserSessionMetaData } from '@thermopylae/lib.user-session';
import avsc from 'avsc';
import type { Schema } from 'avsc';
import cloneDeep from 'lodash.clonedeep';
import type { UserSessionDevice, UserSessionMetaDataSerializer } from '../../../typings.js';
import { AVRO_SCHEMA } from '../common/avro-schema.js';

/** @private */
const SCHEMA: Schema = cloneDeep(AVRO_SCHEMA);
(SCHEMA as any).fields.push({ name: 'accessedAt', type: 'long' });

/** @private */
const AVRO_TYPE = avsc.Type.forSchema(SCHEMA, { omitRecordMethods: true });

/** @private */
const AVRO_SERIALIZER: Readonly<UserSessionMetaDataSerializer<UserSessionMetaData<UserSessionDevice, HTTPRequestLocation>>> = Object.freeze({
	serialize(session: UserSessionMetaData<UserSessionDevice, HTTPRequestLocation>): Buffer {
		return AVRO_TYPE.toBuffer(session);
	},
	deserialize(buffer: Buffer): UserSessionMetaData<UserSessionDevice, HTTPRequestLocation> {
		return AVRO_TYPE.fromBuffer(buffer);
	}
});

export { AVRO_SERIALIZER };
