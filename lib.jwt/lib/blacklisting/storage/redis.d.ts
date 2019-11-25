import {IAbstractStorage, IQuery} from "./abstract-storage";

declare class RedisStorage implements IAbstractStorage {
    constructor(opts: RedisStorage.IRedisStorageOpts);
    has: (query: IQuery) => Promise<boolean>;
    purge: (aud: string, sub: string, ttl?: number) => Promise<void>;
    revoke: (aud: string, sub: string, iat: number, ttl?: number) => Promise<void>;
    clear: (tokens?: Map<string, string[]>) => Promise<void>;
}

declare namespace RedisStorage {
    interface IRedisStorageOpts {
        readonly redis: any;
        readonly keyPrefix?: string;
        readonly clean?: boolean;
    }
}

export {
    RedisStorage
};
