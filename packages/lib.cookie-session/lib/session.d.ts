import { DeviceType, UnixTimestamp } from '@thermopylae/core.declarations';

/**
 * Session id type alias.
 */
type SessionId = string;

/**
 * Device from where session was created/accessed.
 */
declare interface SessionDevice {
	/**
	 * Name of the device.
	 */
	readonly name: string;
	/**
	 * Type of the device.
	 */
	readonly type: DeviceType;
	/**
	 * Device description.
	 */
	readonly description?: string;
}

/**
 * Represents context of the session manipulation operation.
 */
declare interface SessionOperationContext {
	/**
	 * Ip from where session was created/accessed.
	 */
	readonly ip: string;
	/**
	 * Device from where session was created/accessed.
	 */
	readonly device: SessionDevice;
	/**
	 * Value of the *User-Agent* header.
	 */
	readonly ['user-agent']: string;
	/**
	 * Value of the *Referer* header.
	 */
	readonly referer?: string;
	/**
	 * Location from where session was created/accessed.
	 */
	readonly location?: string;
}

/**
 * Represents session metadata that are being stored in external storage.
 */
declare interface SessionMetaData {
	/**
	 * Subject this session belongs to.
	 */
	readonly subject: string;
	/**
	 * IP from where session was created.
	 */
	readonly ip: string;
	/**
	 * Device from where session was created.
	 */
	readonly device: SessionDevice;
	/**
	 * When session was created.
	 */
	readonly createdAt: UnixTimestamp;
	/**
	 * When session was accessed last time. <br/>
	 * If it has {@link RENEWED_SESSION_FLAG} value, it means session was renewed
	 * and it's about to expire very soon. <br/>
	 * **After {@link RENEWED_SESSION_FLAG} value was assigned, this property should not be updated!**
	 */
	accessedAt: UnixTimestamp;
}

export { SessionId, SessionOperationContext, SessionMetaData, SessionDevice };
