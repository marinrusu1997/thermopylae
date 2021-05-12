import type { UnixTimestamp } from '@thermopylae/core.declarations';
import type { DeviceBase, UserSessionMetaData as BaseUserSessionMetaData } from '@thermopylae/lib.user-session.commons';

/**
 * Represents user session metadata.
 *
 * @template Device		Type of the device.
 * @template Location	Type of the location.
 */
interface UserSessionMetaData<Device extends DeviceBase, Location> extends BaseUserSessionMetaData<Device, Location> {
	/**
	 * When session was accessed last time. <br/>
	 * If it has {@link RENEWED_SESSION_FLAG} value, it means session was renewed
	 * and it's about to expire very soon. <br/>
	 * **After {@link RENEWED_SESSION_FLAG} value was assigned, this property should not be updated!**
	 */
	accessedAt: UnixTimestamp;
}

export { UserSessionMetaData };
