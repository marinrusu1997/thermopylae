declare interface JwtPayload {
	sub: string;
	readonly aud?: string;
	readonly iss?: string;
	readonly nbf?: string | number;
	anc?: string;
	role?: string;
	readonly [x: string]: any;
}

declare interface IssuedJwtPayload extends JwtPayload {
	readonly sub: string;
	readonly iat: number;
	readonly exp: number;
	readonly anc?: string;
}

export { JwtPayload, IssuedJwtPayload };
