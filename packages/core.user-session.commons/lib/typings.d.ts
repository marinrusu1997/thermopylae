import type { HttpDeviceClient, HttpDeviceOs, Nullable, HTTPRequestLocation, ErrorCodes } from '@thermopylae/core.declarations';
import type { DeviceBase, UserSessionMetaData } from '@thermopylae/lib.user-session.commons';
import type { Exception } from '@thermopylae/lib.exception';

/**
 * Device associated with the user session.
 */
interface UserSessionDevice extends DeviceBase {
	readonly client: Nullable<HttpDeviceClient>;
	readonly os: Nullable<HttpDeviceOs>;
}

/**
 * {@link UserSessionMetaData} serializer used by {@link UserSessionRedisStorage}.
 *
 * @template MetaData   Type of the user session metadata.
 */
interface UserSessionMetaDataSerializer<MetaData extends UserSessionMetaData<UserSessionDevice, HTTPRequestLocation>> {
	serialize(session: MetaData): Buffer;
	deserialize(buffer: Buffer): MetaData;
}

/**
 * Function which returns an {@link Exception} instance.
 */
type ExceptionFactory = (code: ErrorCodes, message: string) => Exception;

export { UserSessionDevice, UserSessionMetaDataSerializer, ExceptionFactory };
