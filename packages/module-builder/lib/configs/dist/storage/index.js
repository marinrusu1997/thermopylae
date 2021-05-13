"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserSessionRedisStorage = void 0;
const core_redis_1 = require("@thermopylae/core.redis");
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
class UserSessionRedisStorage {
    constructor(options) {
        this.options = options;
        core_redis_1.RedisClientInstance.on("SUBSCRIBER" /* SUBSCRIBER */, 'message', (channel, message) => {
            if (!channel.startsWith('__keyspace@') || !(message === 'del' || message === 'expired' || message === 'evicted')) {
                return;
            }
            const [, prefix, subject, sessionId] = channel.split(':');
            if (prefix !== this.options.keyPrefix.sessionId) {
                return;
            }
            core_redis_1.RedisClientInstance.subscriber.unsubscribe(channel).catch((e) => {
                this.options.logger.error(`Failed to unsubscribe from '${channel}' channel.`, e);
            });
            core_redis_1.RedisClientInstance.client.lrem(this.activeSessionsKey(subject), 1, sessionId).catch((e) => {
                this.options.logger.error(`Failed to remove '${sessionId}' from the list of active sessions of the subject '${subject}'.`, e);
            });
        });
    }
    async insert(subject, sessionId, metaData, ttl) {
        const activeSessionsKey = this.activeSessionsKey(subject);
        if (this.options.concurrentSessions) {
            const activeSessions = await core_redis_1.RedisClientInstance.client.llen(activeSessionsKey);
            if (activeSessions >= this.options.concurrentSessions) {
                throw this.options.exceptionFactory("OVERFLOW" /* OVERFLOW */, `Concurrent user sessions limit reached for subject '${subject}', as he has ${activeSessions} active sessions.`);
            }
        }
        const sessionIdKey = this.sessionIdKey(subject, sessionId);
        const [wasSet, activeSessions] = (await core_redis_1.RedisClientInstance.client
            .multi()
            .set(sessionIdKey, this.options.serializer.serialize(metaData), ['EX', ttl], 'NX')
            .lpush(activeSessionsKey, sessionId)
            .exec());
        if (!wasSet.equals(UserSessionRedisStorage.REDIS_OK_BUFFER_RESPONSE)) {
            throw this.options.exceptionFactory("NOT_CREATED" /* NOT_CREATED */, `Failed to insert user session under key '${sessionIdKey}'.`);
        }
        this.options.logger.debug(`Inserted user session for subject '${subject}'. He has ${activeSessions} active sessions.`);
        await core_redis_1.RedisClientInstance.subscriber.subscribe(`__keyspace@${core_redis_1.RedisClientInstance.db}__:${sessionIdKey}`);
    }
    async read(subject, sessionId) {
        const sessionBuffer = (await core_redis_1.RedisClientInstance.client.get(this.sessionIdKeyBuffer(subject, sessionId)));
        return sessionBuffer ? this.options.serializer.deserialize(sessionBuffer) : undefined;
    }
    async readAll(subject) {
        const activeSessionIds = await core_redis_1.RedisClientInstance.client.lrange(this.activeSessionsKey(subject), 0, -1);
        if (activeSessionIds.length === 0) {
            // mget command bellow expects at least one key, therefore we early return
            return UserSessionRedisStorage.NO_ACTIVE_SESSIONS;
        }
        const sessionIdKeysBuffers = new Array(activeSessionIds.length);
        for (let i = 0; i < activeSessionIds.length; i++) {
            sessionIdKeysBuffers[i] = this.sessionIdKeyBuffer(subject, activeSessionIds[i]);
        }
        const activeSessions = (await core_redis_1.RedisClientInstance.client.mget(...sessionIdKeysBuffers));
        const refreshTokenToActiveSessions = new Map();
        for (let i = 0; i < activeSessions.length; i++) {
            if (activeSessions[i] == null) {
                continue;
            }
            refreshTokenToActiveSessions.set(activeSessionIds[i], this.options.serializer.deserialize(activeSessions[i]));
        }
        return refreshTokenToActiveSessions;
    }
    async delete(subject, sessionId) {
        if ((await core_redis_1.RedisClientInstance.client.del(this.sessionIdKey(subject, sessionId))) !== 1) {
            this.options.logger.warning(`Failed to delete session '${sessionId}' of the subject '${subject}'.`);
        }
        // auto remove from active sessions list via emitted 'del' event via PubSub
    }
    async deleteAll(subject) {
        const activeSessionIds = await core_redis_1.RedisClientInstance.client.lrange(this.activeSessionsKey(subject), 0, -1);
        if (activeSessionIds.length === 0) {
            return 0;
        }
        for (let i = 0; i < activeSessionIds.length; i++) {
            activeSessionIds[i] = this.sessionIdKey(subject, activeSessionIds[i]);
        }
        // auto remove from active sessions list via emitted 'del' event via PubSub
        const deletedSessionsNo = await core_redis_1.RedisClientInstance.client.del(...activeSessionIds);
        if (deletedSessionsNo !== activeSessionIds.length) {
            this.options.logger.warning(`Failed to delete all sessions of the subject '${subject}'. Expected to delete ${activeSessionIds.length} sessions, but actually deleted ${deletedSessionsNo} sessions.`);
        }
        return deletedSessionsNo;
    }
    activeSessionsKey(subject) {
        return `${this.options.keyPrefix.sessions}:${subject}`;
    }
    sessionIdKey(subject, sessionId) {
        return `${this.options.keyPrefix.sessionId}:${subject}:${sessionId}`;
    }
    sessionIdKeyBuffer(subject, sessionId) {
        const buffer = Buffer.allocUnsafe(this.options.keyPrefix.sessionId.length + subject.length + sessionId.length + 2);
        buffer.write(this.options.keyPrefix.sessionId, 0, this.options.keyPrefix.sessionId.length);
        buffer.write(':', this.options.keyPrefix.sessionId.length, 1);
        buffer.write(subject, this.options.keyPrefix.sessionId.length + 1, subject.length);
        buffer.write(':', this.options.keyPrefix.sessionId.length + 1 + subject.length, 1);
        buffer.write(sessionId, this.options.keyPrefix.sessionId.length + subject.length + 2, sessionId.length);
        return buffer;
    }
}
exports.UserSessionRedisStorage = UserSessionRedisStorage;
UserSessionRedisStorage.REDIS_OK_BUFFER_RESPONSE = Buffer.from('OK');
UserSessionRedisStorage.NO_ACTIVE_SESSIONS = new Map();
//# sourceMappingURL=index.js.map