import { DeviceType, Nullable, UnixTimestamp } from '@thermopylae/core.declarations';
import type { DeepReadonly } from 'utility-types';

/**
 * Payload of the JWT token. <br/>
 * This payload needs to signed first, before being issue to clients.
 */
declare type JwtPayload = {
	/**
	 * Payload data.
	 */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	readonly [x: string]: any;
};

/**
 * JWT payload that has been issued to clients.
 */
declare interface IssuedJwtPayload {
	/**
	 * Identifies the subject of the JWT.
	 */
	readonly sub: string;

	/**
	 * The "iat" (issued at) claim identifies the time at which the JWT was issued.
	 */
	readonly iat: number;

	/**
	 * The "exp" (expiration time) claim identifies the expiration time on or after which the JWT must not be accepted for processing.
	 * The value should be in NumericDate format.
	 */
	readonly exp: number;

	/**
	 * Anchored refresh token.
	 * Represents a sub-part (usually the first 6 letters) of the refresh token.
	 * Anchor is used for invalidation purposes.
	 */
	readonly anc: string;

	/**
	 * The "aud" (audience) claim identifies the recipients that the JWT is intended for. <br/>
	 * Each principal intended to process the JWT must identify itself with a value in the audience claim.
	 * If the principal processing the claim does not identify itself with a value in the aud claim when this claim is present, then the JWT must be rejected.
	 */
	readonly aud?: string | Array<string>;

	/**
	 * Identifies principal that issued the JWT.
	 */
	readonly iss?: string;

	/**
	 * The not-before time claim identifies the time on which the JWT will start to be accepted for processing.
	 */
	readonly nbf?: string | number;

	/**
	 * Role of the subject (e.g. *admin*, *user*).
	 */
	readonly role?: string;

	/**
	 * Other properties.
	 */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	readonly [x: string]: any;
}

/**
 * Represents minimal requirements for the {@link UserSessionOperationContext.device}.
 */
interface DeviceBase {
	/**
	 * Name of the device.
	 */
	name: string;
	/**
	 * Type of the device.
	 */
	type: DeviceType;
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
	 * Can be *undefined* if device is unknown.
	 */
	readonly device?: Nullable<DeepReadonly<Device>>;
	/**
	 * Location from where session was created/accessed. <br/>
	 * Can be *undefined* if location is unknown.
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
	createdAt: UnixTimestamp;
}

/**
 * Represents user session metadata that is queried by external to application clients.
 *
 * @template Device		Type of the device.
 * @template Location	Type of the location.
 */
interface QueriedUserSessionMetaData<Device extends DeviceBase, Location> extends UserSessionMetaData<Device, Location> {
	/**
	 * When session will expire.
	 */
	expiresAt: UnixTimestamp;
}

export { JwtPayload, IssuedJwtPayload, DeviceBase, UserSessionOperationContext, UserSessionMetaData, QueriedUserSessionMetaData };
