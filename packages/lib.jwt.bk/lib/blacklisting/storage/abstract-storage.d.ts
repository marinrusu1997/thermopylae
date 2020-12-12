/* Storage used for storing blacklisted tokens */
declare interface IAbstractStorage {
    /* Used to ask storage whether a token is blacklisted or not */
    has: (query: IQuery) => Promise<boolean>;
    /* Used to staticaly define an audience (i.e category of users),
     * this way a static ttl will be used for all tokens from this category
     * Some of the storages cannot be aware of tokens or dynamic validity is used,
     * in this case this method can be skipped and not used
     */
    defineAudience?: (aud: string, ttl: number) => Promise<void>;
    /* Revokes a token, adding it to revoke list */
    revoke: (aud: string, sub: string, iat: number, ttl?: number) => Promise<void>;
    /* Purges all tokens which were issued before current timestamp in seconds */
    purge: (aud: string, sub: string, ttl?: number) => Promise<void>;
    /* Clear all storage or only selectively using querry map */
    clear: (tokens?: Map<string, string[]>) => Promise<void>;
}

/* Query ussed to check whether token is blacklisted */
declare interface IQuery {
    /* Audience of the token (i.e category of users) */
    audience: string;
    /* Subject of the token (i.e used it) */
    subject: string;
    /* When the token was issued (in `seconds`)*/
    issued: number;
    /* What ttl was specified when token was stored (in `seconds`)
     * when dynamic expiration is used or storage is not aware about tokens validity
     */
    ttl?: number;
}

declare interface IBlacklistModel {
    /* Represents a list of issuedAt property of tokens which were revoked */
    revoke?: number[];
    /* All tokens which have the issuedAt property below or equal to purge timestamp are considered invalid */
    purge?: number;
}

export {
    IAbstractStorage,
    IQuery,
    IBlacklistModel
};
