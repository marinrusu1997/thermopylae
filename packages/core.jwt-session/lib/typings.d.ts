import type { HttpDeviceClient, HttpDeviceOs } from '@thermopylae/core.declarations';
import type { DeviceBase } from '@thermopylae/lib.jwt-session/lib';

/**
 * Device associated with the JWT user session.
 */
export interface JwtSessionDevice extends DeviceBase {
	readonly client?: HttpDeviceClient;
	readonly os?: HttpDeviceOs;
}
