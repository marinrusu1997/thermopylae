declare interface JwtPayload {
	readonly sub: string;
	readonly aud?: string;
	readonly iss?: string;
	readonly nbf?: string | number;
	anc?: string;
	readonly [x: string]: any;
}

declare interface IssuedJwtPayload extends JwtPayload {
	readonly iat: number;
	readonly exp: number;
}

export { JwtPayload, IssuedJwtPayload };
