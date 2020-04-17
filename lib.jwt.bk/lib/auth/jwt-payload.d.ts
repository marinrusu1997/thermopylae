
/* Jwt Payload which needs to be signed */
interface IJWTPayload {
  readonly sub: string;
  readonly aud?: string;
  readonly iss?: string;
  readonly nbf?: string | number;
  /* Custom properties */
  readonly [x: string]: any;
}

/* Jwt Payload which was signed, contains `iat` and `exp` timestamps */
interface IIssuedJWTPayload extends IJWTPayload {
  readonly iat: number;
  readonly exp: number;
}

export {
  IJWTPayload,
  IIssuedJWTPayload
}
