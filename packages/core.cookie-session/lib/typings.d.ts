import type { DeviceBase } from '@thermopylae/lib.cookie-session';
import type { HttpDeviceClient, HttpDeviceOs, Nullable } from '@thermopylae/core.declarations/lib';

/**
 * Device associated with the user session.
 */
export interface UserSessionDevice extends DeviceBase {
	readonly client: Nullable<HttpDeviceClient>;
	readonly os: Nullable<HttpDeviceOs>;
}
