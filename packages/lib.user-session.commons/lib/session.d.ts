import type { DeviceType, UnixTimestamp, Nullable } from '@thermopylae/core.declarations';
import type { DeepReadonly } from 'utility-types';

/**
 * Session id type alias.
 */
type SessionId = string;

/**
 * Subject alias.
 */
type Subject = string;

/**
 * Represents minimal requirements for the {@link UserSessionOperationContext.device}.
 */
interface DeviceBase {
	/**
	 * Name of the device.
	 */
	readonly name: string;
	/**
	 * Type of the device.
	 */
	readonly type: DeviceType;
}

/**
 * Represents context of the user session at it's creation/access.
 *
 * @template Device		Type of the device.
 * @template Location	Type of the location.
 */
interface UserSessionOperationContext<Device extends DeviceBase, Location> {
	/**
	 * Ip from where session was created/accessed.
	 */
	readonly ip: string;
	/**
	 * Device from where session was created/accessed. <br/>
	 * Can be *undefined* or *null* if device is unknown.
	 */
	readonly device?: Nullable<DeepReadonly<Device>>;
	/**
	 * Location from where session was created/accessed. <br/>
	 * Can be *undefined* or *null* if location is unknown.
	 */
	readonly location?: Nullable<DeepReadonly<Location>>;
}

/**
 * Represents user session metadata that is stored along the refresh token.
 *
 * @template Device		Type of the device.
 * @template Location	Type of the location.
 */
interface UserSessionMetaData<Device extends DeviceBase, Location> extends UserSessionOperationContext<Device, Location> {
	/**
	 * When session was created.
	 */
	readonly createdAt: UnixTimestamp;
	/**
	 * When session will expire.
	 */
	readonly expiresAt: UnixTimestamp;
}

export { SessionId, Subject, DeviceBase, UserSessionOperationContext, UserSessionMetaData };
