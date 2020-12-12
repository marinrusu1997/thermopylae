import {IAbstractStorage, IQuery} from "./abstract-storage";

declare class MemoryStorage implements IAbstractStorage {
    constructor();
    clear: (tokens?: Map<string, string[]>) => Promise<void>;
    defineAudience: (aud: string, ttl: number) => Promise<void>;
    has: (query: IQuery) => Promise<boolean>;
    purge: (aud: string, sub: string, ttl?: number) => Promise<void>;
    revoke: (aud: string, sub: string, iat: number, ttl?: number) => Promise<void>;
}

export {
    MemoryStorage
};
