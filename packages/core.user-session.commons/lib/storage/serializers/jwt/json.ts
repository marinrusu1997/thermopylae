import type { HTTPRequestLocation } from '@thermopylae/core.declarations';
import type { UserSessionMetaData } from '@thermopylae/lib.user-session.commons';
import type { UserSessionDevice, UserSessionMetaDataSerializer } from '../../../typings.js';

/** @private */
const JSON_SERIALIZER: Readonly<UserSessionMetaDataSerializer<UserSessionMetaData<UserSessionDevice, HTTPRequestLocation>>> = Object.freeze({
	serialize(session: UserSessionMetaData<UserSessionDevice, HTTPRequestLocation>): Buffer {
		return Buffer.from(JSON.stringify(session));
	},
	deserialize(buffer: Buffer): UserSessionMetaData<UserSessionDevice, HTTPRequestLocation> {
		return JSON.parse(buffer as unknown as string) as UserSessionMetaData<UserSessionDevice, HTTPRequestLocation>;
	}
});

export { JSON_SERIALIZER };
