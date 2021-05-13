import { ErrorCodes } from '@thermopylae/core.declarations';
import type { Seconds, HTTPRequestLocation } from '@thermopylae/core.declarations';
import type { Subject, SessionId, UserSessionMetaData, UserSessionStorage } from '@thermopylae/lib.user-session.commons';
import type { WinstonLogger } from '@thermopylae/lib.logger';
import type { Exception } from '@thermopylae/lib.exception';
import type { UserSessionDevice, UserSessionMetaDataSerializer } from '../typings';
interface UserSessionRedisStorageOptions<MetaData extends UserSessionMetaData<UserSessionDevice, HTTPRequestLocation>> {
    /**
     * Prefixes used for keys stored in Redis.
     */
    readonly keyPrefix: {
        /**
         * Key prefix used for storing a list of session id's belonging to a concrete subject.
         */
        readonly sessions: string;
        /**
         * Key prefix used for storing session id as key and metadata as value.
         */
        readonly sessionId: string;
    };
    /**
     * Maximum number of concurrent sessions that a user can have. <br/>
     * Creating a new session above this threshold will result in an error. <br/>
     * When left *undefined*, user can have an unlimited number of sessions.
     */
    readonly concurrentSessions?: number;
    /**
     * Serializer used for session metadata serialization.
     */
    readonly serializer: UserSessionMetaDataSerializer<MetaData>;
    /**
     * Logger used by the storage.
     */
    readonly logger: WinstonLogger;
    /**
     * Factory for exceptions thrown by storage.
     */
    readonly exceptionFactory: (code: ErrorCodes, message: string) => Exception;
}
/**
 * User session storage backed by [Redis](https://redis.io/). <br/>
 * This implementation uses *core.redis* as client and imposes the following requirements to him: <br/>
 * 	- {@link ConnectionType.SUBSCRIBER} connection needs to be established and available.
 * 		This is needed for receiving of key space notification events about refresh token keys deletion, expiration or eviction,
 * 		in order to remove them from list of active user sessions. <br/>
 * 	- {@link ConnectionType.REGULAR} connection needs to have **detect_buffers** option enabled, because it stores and reads
 * 		serialized user session metadata as {@link Buffer} instances. <br/>
 * 	- {@link RedisClientInstance.db} property should always return a valid db index.
 * 		It is recommended to not change db after {@link ConnectionType.REGULAR} connection was established.
 *
 * @template MetaData	Type of the user session metadata.
 */
declare class UserSessionRedisStorage<MetaData extends UserSessionMetaData<UserSessionDevice, HTTPRequestLocation> = UserSessionMetaData<UserSessionDevice, HTTPRequestLocation>> implements UserSessionStorage<UserSessionDevice, HTTPRequestLocation, MetaData> {
    private static readonly REDIS_OK_BUFFER_RESPONSE;
    private static readonly NO_ACTIVE_SESSIONS;
    private readonly options;
    constructor(options: UserSessionRedisStorageOptions<MetaData>);
    insert(subject: Subject, sessionId: SessionId, metaData: MetaData, ttl: Seconds): Promise<void>;
    read(subject: Subject, sessionId: SessionId): Promise<MetaData | undefined>;
    readAll(subject: Subject): Promise<ReadonlyMap<SessionId, MetaData>>;
    delete(subject: Subject, sessionId: SessionId): Promise<void>;
    deleteAll(subject: Subject): Promise<number>;
    private activeSessionsKey;
    private sessionIdKey;
    private sessionIdKeyBuffer;
}
export { UserSessionRedisStorage, UserSessionRedisStorageOptions };
//# sourceMappingURL=index.d.ts.map