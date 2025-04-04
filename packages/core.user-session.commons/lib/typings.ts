import type { HTTPRequestLocation, HttpDeviceClient, HttpDeviceOs, Nullable } from '@thermopylae/core.declarations';
import type { Exception } from '@thermopylae/lib.exception';
import type { DeviceBase, UserSessionMetaData } from '@thermopylae/lib.user-session.commons';

/** Device associated with the user session. */
interface UserSessionDevice extends DeviceBase {
	readonly client: Nullable<HttpDeviceClient>;
	readonly os: Nullable<HttpDeviceOs>;
}

/**
 * {@link UserSessionMetaData} serializer used by {@link UserSessionRedisStorage}.
 *
 * @template MetaData Type of the user session metadata.
 */
interface UserSessionMetaDataSerializer<MetaData extends UserSessionMetaData<UserSessionDevice, HTTPRequestLocation>> {
	serialize(session: MetaData): Buffer;
	deserialize(buffer: Buffer): MetaData;
}

/**
 * Extract session id from _Authorization_ header.
 *
 * @param   authorization                   Value of the _Authorization_ header.
 *
 * @returns               Extracted token.
 *
 * @throws  {Error | Exception}               When inconsistencies are detected.
 */
type AuthorizationTokenExtractor = (authorization: string | null | undefined) => string;

/** Function which returns an {@link Exception} instance. */
type ExceptionFactory = (code: string, message: string) => Exception;

export type { UserSessionDevice, UserSessionMetaDataSerializer, ExceptionFactory, AuthorizationTokenExtractor };
