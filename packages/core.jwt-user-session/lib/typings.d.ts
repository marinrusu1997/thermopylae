import type { HttpDeviceClient, HttpDeviceOs, Nullable, HTTPRequestLocation } from '@thermopylae/core.declarations';
import type { DeviceBase, UserSessionMetaData } from '@thermopylae/lib.user-session.commons';

/**
 * Device associated with the JWT user session.
 */
export interface JwtSessionDevice extends DeviceBase {
	readonly client: Nullable<HttpDeviceClient>;
	readonly os: Nullable<HttpDeviceOs>;
}

/**
 * {@link UserSessionMetaData} serializer used by {@link RefreshTokensRedisStorage}.
 */
export interface UserSessionMetaDataSerializer {
	serialize(session: UserSessionMetaData<JwtSessionDevice, HTTPRequestLocation>): Buffer;
	deserialize(buffer: Buffer): UserSessionMetaData<JwtSessionDevice, HTTPRequestLocation>;
}
