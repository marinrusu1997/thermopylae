import type { UserSessionMetaData } from '@thermopylae/lib.jwt-session';
import type { HTTPRequestLocation } from '@thermopylae/core.declarations';
import type { JwtSessionDevice, UserSessionMetaDataSerializer } from '../../typings';

/**
 * @private
 */
const JSON_SERIALIZER: Readonly<UserSessionMetaDataSerializer> = Object.freeze({
	serialize(session: UserSessionMetaData<JwtSessionDevice, HTTPRequestLocation>): Buffer {
		return Buffer.from(JSON.stringify(session));
	},
	deserialize(buffer: Buffer): UserSessionMetaData<JwtSessionDevice, HTTPRequestLocation> {
		return JSON.parse((buffer as unknown) as string);
	}
});

export { JSON_SERIALIZER };
