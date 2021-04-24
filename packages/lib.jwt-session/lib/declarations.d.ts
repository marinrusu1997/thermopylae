/**
 * Payload of the JWT token. <br/>
 * This payload needs to signed first, before being issue to clients.
 */
declare interface JwtPayload {
	/**
	 * Other properties.
	 */
	readonly [x: string]: any;
}

/**
 * JWT payload that has been issued to clients.
 */
declare interface IssuedJwtPayload extends JwtPayload {
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
	 * The value should be in NumericDate[10][11] format.
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
}

export { JwtPayload, IssuedJwtPayload };
