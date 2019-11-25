import { IAbstractStorage } from "./storage/abstract-storage";
import { IIssuedJWTPayload } from "../auth/jwt-payload";

/** Jwt Blacklist Manager */
declare class JWTBlacklist {
   private static readonly allAudience: string;
   private allTTL?: number;
   private storage?: IAbstractStorage;

   /**
    * Inits manager with underlying storage.
    * If @all audience will be used, allTTL param should be provided
    *
    * @param   storage  AbstractStorage implementation, underlying storage used for storing tokens
    * @param   allTTL   In case there are tokens without audience, there need to be set a default TTL for them
    * @throws {Error}   When storage is already defined
    *                   If @all audience defining will fail
    */
   init: (storage: IAbstractStorage, allTTL?: number) => Promise<void>;

   /**
    * Defines multiple audiences in parallel
    * This is a bulk create operation
    * Use this when underlying storage needs static defined audiences with their TTL
    *
    * @param   audiences   Array of audience name and her TTL
    * @returns             Array of status for each defining, items can be either true or Error object if op failed
    * @throws {Error}      When storage is not defined
    *                      When underlying storage doesn't support static audience defining
    */
   defineAudiences: (audiences: Array<{name: string; ttl: number}>) => Promise<Array<boolean|Error>>;

   /**
    * Check if token is blacklisted basing on his payload.
    * If tokens had an explicit audience, exp - iat will be provided as TTL to underlying storage.
    * Otherwise, @all audience TTL will be used.
    * Notice that underlying storage may discard this TTL (i.e static defined ones).
    *
    * @param   token    Issued token (sub, iat and exp properties are mandatory)
    * @returns          A flag which indicates whether token is blacklisted or not
    * @throws {Error}   When storage is not defined
    *                   When no TTL for operation
    *                   When Jwt payload doesn't contain sub property
    *                   When Jwt payload doesn't contain iat property
    *                   When Jwt payload doesn't contain exp property
    */
   isBlacklisted: (token: IIssuedJWTPayload) => Promise<boolean>;

   /**
    * Revokes token based on his issued time.
    * If explicit TTL is provided as parameter, he will be passed to underlying storage.
    * If no explicit TTL, but token has explicit audience, exp - iat will be used.
    * If no explicit audience, @all audience TTL will be used.
    * Notice that underlying storage may discard this TTL (i.e static defined ones).
    *
    * @param   token    Issued token (sub, iat and exp properties are mandatory)
    * @param   ttl      Explicit TTL for this operation
    * @throws {Error}   When storage is not defined
    *                   When no TTL for operation
    *                   When Jwt payload doesn't contain sub property
    *                   When Jwt payload doesn't contain iat property
    *                   When Jwt payload doesn't contain exp property
    */
   revoke: (token: IIssuedJWTPayload, ttl?: number) => Promise<void>;

   /**
    * Purges all tokes which were issued before current timestamp.
    * When no explicit audience provided, @all audience will be used.
    * If explicit TTL is provided as parameter, he will be passed to underlying storage.
    * If no explicit TTL, @all audience TTL will be used.
    * Notice that underlying storage may discard this TTL (i.e static defined ones).
    *
    * @param   subject  User for which the tokens were issued
    * @param   audience Audience from where the user comes from
    * @param   ttl      Explicit TTL for this operation
    * @throws {Error}   When storage is not defined
    *                   When no TTL for operation
    */
   purge: (subject: string, audience?: string, ttl?: number) => Promise<void>;
}

export {
   JWTBlacklist
};
