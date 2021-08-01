import { error, number } from '@thermopylae/lib.utils';
import type { RequireSome } from '@thermopylae/core.declarations';
import type { ClientOpts, RedisError, RetryStrategy } from 'redis';
import redis, { AggregateError } from 'redis';
import type { WrappedNodeRedisClient } from 'handy-redis';
import { createNodeRedisClient } from 'handy-redis';
// eslint-disable-next-line import/extensions
import type { WrappedNodeRedisMulti } from 'handy-redis/dist/node_redis/multi';
import { logger } from './logger';
import { createException, ErrorCodes } from './error';
import { addJsonModuleCommands } from './modules/json';
import type { JsonModuleCommands } from './modules/json';

type RequireHostPortClientOptions = RequireSome<ClientOpts, 'host' | 'port'>;
type RequirePathClientOptions = RequireSome<ClientOpts, 'path'>;
type RequireUrlClientOptions = RequireSome<ClientOpts, 'url'>;
type ConnectionOptions = RequireHostPortClientOptions | RequirePathClientOptions | RequireUrlClientOptions;

type RequiredClientOptions = RequireSome<
	ClientOpts,
	'enable_offline_queue' | 'retry_unfulfilled_commands' | 'password' | 'db' | 'connect_timeout' | 'max_attempts' | 'retry_max_delay'
>;
type OmittedClientOptions = Omit<ClientOpts, 'no_ready_check' | 'disable_resubscribing' | 'rename_commands'>;

/**
 * Type of the events on which debug listener can be attached. <br/>
 * Whenever the event is emitted, listener will log this event along with it's arguments.
 */
type DebuggableEventType = 'subscribe' | 'psubscribe' | 'unsubscribe' | 'punsubscribe' | 'connect' | 'reconnecting' | 'end';

/**
 * Options for Redis Server connection.
 */
type RedisConnectionOptions = (ConnectionOptions | RequiredClientOptions | OmittedClientOptions) & {
	/**
	 * Whether debug listeners need to be attached on redis connection. <br/>
	 * Depending on value of this param, following actions will be taken: <br/>
	 * 	* undefined | false - debug listeners won't be attached <br/>
	 * 	* true - debug listeners will be attached for all {@link DebuggableEventType} <br/>
	 *  * Set<DebuggableEventType> - debug listeners will be attached only to specified events
	 */
	readonly attachDebugListeners?: boolean | Set<DebuggableEventType>;
};

/**
 * Type of the connection established to Redis Server.
 */
const enum ConnectionType {
	/**
	 * Connection used for issuing commands (e.g. SET, GET)
	 */
	REGULAR = 'REGULAR',
	/**
	 * Connection used for subscribing to channels and receiving messages.
	 */
	SUBSCRIBER = 'SUBSCRIBER',
	/**
	 * Connection used for publishing messages into channels.
	 */
	PUBLISHER = 'PUBLISHER'
}

/**
 * [Modules](https://redis.io/modules) that might be used by Redis Server.
 */
const enum RedisModule {
	JSON
}

/**
 * @private
 */
interface NodeRedisClientMulti<Results extends unknown[] = []>
	extends WrappedNodeRedisMulti<Results>,
		JsonModuleCommands<{
			type: 'node_redis_multi';
			results: Results;
		}> {}

/**
 * @private
 */
interface NodeRedisClient extends WrappedNodeRedisClient, JsonModuleCommands {
	multi(): NodeRedisClientMulti;
	batch(): NodeRedisClientMulti;
}

/**
 * {@link RedisClient} initialization options.
 */
interface InitializationOptions {
	/**
	 * [Modules](https://redis.io/modules) that need to be enabled on Redis Connections. <br/>
	 * After enabling, commands from modules will be available on redis connections.
	 */
	readonly modules?: Set<RedisModule>;
}

/**
 * Redis client which wraps *node_redis* client and handles: <br/>
 * 	- connection <br/>
 * 	- disconnection <br/>
 * 	- event listeners <br/>
 * 	- logging
 */
class RedisClient {
	private static readonly EXCLUDE_PROPS_FROM_FORMATTED_REDIS_ERR: ReadonlyArray<keyof AggregateError | string> = ['stack', 'errors'];

	private static readonly REDIS_MODULE_INITIALIZERS: Record<RedisModule, () => void> = {
		[RedisModule.JSON]: addJsonModuleCommands
	};

	private readonly connections: Record<ConnectionType, NodeRedisClient> = {
		[ConnectionType.REGULAR]: null!,
		[ConnectionType.SUBSCRIBER]: null!,
		[ConnectionType.PUBLISHER]: null!
	};

	private readonly queuedEventListeners: Record<ConnectionType, Array<[string, (...args: any[]) => void]>> = {
		[ConnectionType.REGULAR]: [],
		[ConnectionType.SUBSCRIBER]: [],
		[ConnectionType.PUBLISHER]: []
	};

	private options!: Readonly<Record<ConnectionType, RedisConnectionOptions>>;

	/**
	 * Get connection options.
	 */
	public get connectionOptions(): Readonly<Record<ConnectionType, RedisConnectionOptions>> {
		return this.options;
	}

	/**
	 * Get index of the database where {@link ConnectionType.REGULAR} connection was established.
	 *
	 * > **⚠ WARNING: Do not change database after {@link ConnectionType.REGULAR} connection was established.**
	 */
	public get db(): string | number {
		return this.options[ConnectionType.REGULAR].db!;
	}

	/**
	 * Check whether [redis](https://www.npmjs.com/package/redis) is in *debug_mode*.
	 */
	public get debug(): boolean {
		return redis.debug_mode;
	}

	/**
	 * Enable/Disable [redis](https://www.npmjs.com/package/redis) *debug_mode*.
	 *
	 * @param enable	Whether to enable.
	 */
	public set debug(enable: boolean) {
		redis.debug_mode = enable;
	}

	/**
	 * Get {@link ConnectionType.REGULAR} redis client.
	 */
	public get client(): NodeRedisClient {
		return this.connections[ConnectionType.REGULAR];
	}

	/**
	 * Get {@link ConnectionType.SUBSCRIBER} redis client.
	 */
	public get subscriber(): NodeRedisClient {
		return this.connections[ConnectionType.SUBSCRIBER];
	}

	/**
	 * Get {@link ConnectionType.PUBLISHER} redis client.
	 */
	public get publisher(): NodeRedisClient {
		return this.connections[ConnectionType.PUBLISHER];
	}

	/**
	 * Attach `listener` for `event` on `connectionType`. <br/>
	 * This method is made because application modules tend to register listeners before connections are established.
	 * Connection is made from the client constructor, meaning that on listeners registering clients are not created yet.
	 * Therefore, listeners are queued before connections are established, and then registered.
	 * In case connection is established already, they will be registered on it and skip the queueing phase.
	 *
	 * @param connectionType	Connection on which `listener` needs to be registered.
	 * @param event				Event name.
	 * @param listener			Event listener.
	 */
	public on(connectionType: ConnectionType, event: 'message' | 'message_buffer', listener: (channel: string, message: string) => void): this;

	/**
	 * Attach `listener` for `event` on `connectionType`. <br/>
	 * This method is made because application modules tend to register listeners before connections are established.
	 * Connection is made from the client constructor, meaning that on listeners registering clients are not created yet.
	 * Therefore, listeners are queued before connections are established, and then registered.
	 * In case connection is established already, they will be registered on it and skip the queueing phase.
	 *
	 * @param connectionType	Connection on which `listener` needs to be registered.
	 * @param event				Event name.
	 * @param listener			Event listener.
	 */
	public on(
		connectionType: ConnectionType,
		event: 'pmessage' | 'pmessage_buffer',
		listener: (pattern: string, channel: string, message: string) => void
	): this;

	/**
	 * Attach `listener` for `event` on `connectionType`. <br/>
	 * This method is made because application modules tend to register listeners before connections are established.
	 * Connection is made from the client constructor, meaning that on listeners registering clients are not created yet.
	 * Therefore, listeners are queued before connections are established, and then registered.
	 * In case connection is established already, they will be registered on it and skip the queueing phase.
	 *
	 * @param connectionType	Connection on which `listener` needs to be registered.
	 * @param event				Event name.
	 * @param listener			Event listener.
	 */
	public on(connectionType: ConnectionType, event: 'subscribe' | 'unsubscribe', listener: (channel: string, count: number) => void): this;

	/**
	 * Attach `listener` for `event` on `connectionType`. <br/>
	 * This method is made because application modules tend to register listeners before connections are established.
	 * Connection is made from the client constructor, meaning that on listeners registering clients are not created yet.
	 * Therefore, listeners are queued before connections are established, and then registered.
	 * In case connection is established already, they will be registered on it and skip the queueing phase.
	 *
	 * @param connectionType	Connection on which `listener` needs to be registered.
	 * @param event				Event name.
	 * @param listener			Event listener.
	 */
	public on(connectionType: ConnectionType, event: 'psubscribe' | 'punsubscribe', listener: (pattern: string, count: number) => void): this;

	/**
	 * Attach `listener` for `event` on `connectionType`. <br/>
	 * This method is made because application modules tend to register listeners before connections are established.
	 * Connection is made from the client constructor, meaning that on listeners registering clients are not created yet.
	 * Therefore, listeners are queued before connections are established, and then registered.
	 * In case connection is established already, they will be registered on it and skip the queueing phase.
	 *
	 * @param connectionType	Connection on which `listener` needs to be registered.
	 * @param event				Event name.
	 * @param listener			Event listener.
	 */
	public on(connectionType: ConnectionType, event: string, listener: (...args: any[]) => void): this {
		if (this.connections[connectionType] != null) {
			this.connections[connectionType].nodeRedis.on(event, listener);
		} else {
			this.queuedEventListeners[connectionType].push([event, listener]);
		}
		return this;
	}

	/**
	 * Connect to Redis server.
	 *
	 * @param connections				Which connections needs to be opened. <br/>
	 * 									At least {@link ConnectionType.REGULAR} connection needs to be specified.
	 * @param initializationOptions		Initialization options. These options are available for all established connections.
	 */
	public async connect(
		connections: Readonly<Partial<Record<ConnectionType, RedisConnectionOptions>>>,
		initializationOptions?: InitializationOptions
	): Promise<void> {
		if (connections[ConnectionType.REGULAR] == null) {
			throw createException(ErrorCodes.REGULAR_CONNECTION_CONFIG_REQUIRED, `Options for ${ConnectionType.REGULAR} connection are required.`);
		}

		if (initializationOptions) {
			if (initializationOptions.modules) {
				for (const module of initializationOptions.modules) {
					RedisClient.REDIS_MODULE_INITIALIZERS[module]();
				}
			}
		}

		try {
			await Promise.all(
				(Object.entries(connections) as [ConnectionType, RedisConnectionOptions][]).map(([connectionType, connectionOptions]) => {
					if (connectionOptions.retry_strategy == null) {
						connectionOptions.retry_strategy = RedisClient.createRetryStrategy(connectionType, connectionOptions);
					}
					if (connectionOptions.db == null) {
						connectionOptions.db = 0;
					}

					return this.establishConnection(connectionOptions, connectionType);
				})
			);

			for (const [connectionType, queuedEvents] of Object.entries(this.queuedEventListeners)) {
				if (queuedEvents.length !== 0) {
					throw new Error(
						`Redis connections were established, but there are ${queuedEvents.length} queued event listeners for ${connectionType} connection that weren't registered.`
					); // automatic connection quit for those that were established
				}
			}

			this.options = connections as Readonly<Required<Record<ConnectionType, RedisConnectionOptions>>>;
		} catch (e) {
			// close connections that were successfully established
			for (const connection of Object.values(this.connections)) {
				if (connection == null) {
					continue;
				}
				await connection.quit();
			}
			throw e;
		}
	}

	/**
	 * Disconnect from Redis server. <br/>
	 * Closes all of the earlier established connections.
	 *
	 * @param graceful		Whether to perform graceful disconnect.
	 */
	public async disconnect(graceful = true): Promise<void> {
		if (graceful) {
			await Promise.all(
				Object.values(this.connections)
					.filter((connection) => connection != null)
					.map((connection) => connection.quit())
			);
		} else {
			for (const [type, connection] of Object.entries(this.connections)) {
				if (connection == null) {
					continue;
				}
				logger.warning(`Forcefully closing ${type} connection.`);
				connection.end(true);
			}
		}
	}

	private async establishConnection(options: RedisConnectionOptions, connectionType: ConnectionType): Promise<void> {
		return new Promise((resolve, reject) => {
			try {
				logger.debug(`Establishing ${connectionType} connection to ${RedisClient.redisUrl(options)}.`);

				let redisClient = createNodeRedisClient(options);
				RedisClient.attachEventListeners(redisClient, connectionType, options);

				redisClient.nodeRedis.on('ready', () => {
					try {
						logger.debug(`${connectionType} connection is ready. Connection id: ${redisClient.nodeRedis.connection_id}.`);

						if (this.queuedEventListeners[connectionType].length) {
							logger.debug(
								`${connectionType} connection has ${this.queuedEventListeners[connectionType].length} queued event listener. Registering them.`
							);

							for (const [event, listener] of this.queuedEventListeners[connectionType]) {
								redisClient.nodeRedis.on(event, listener);
							}

							this.queuedEventListeners[connectionType].length = 0;
							delete this.queuedEventListeners[connectionType];
						}

						this.connections[connectionType] = redisClient as NodeRedisClient;
						redisClient = null!;

						resolve();
					} catch (e) {
						reject(e);
					}
				});

				redisClient.nodeRedis.on('error', (err) => {
					if (this.connections[connectionType] == null) {
						return reject(err);
					}

					logger.error(`${connectionType} connection:\n${RedisClient.formatRedisError(err)}`);
				});

				redisClient.nodeRedis.on('warning', (msg) => {
					logger.warning(`${connectionType} connection warning: ${msg}.`);
				});
			} catch (e) {
				reject(e);
			}
		});
	}

	private static attachEventListeners(redisClient: WrappedNodeRedisClient, connectionType: ConnectionType, options: RedisConnectionOptions): void {
		if (!options.attachDebugListeners) {
			return;
		}

		if (connectionType === ConnectionType.SUBSCRIBER) {
			if (options.attachDebugListeners === true || options.attachDebugListeners.has('subscribe')) {
				redisClient.nodeRedis.on('subscribe', (channel, count) => {
					logger.debug(`${connectionType} connection subscribed to channel '${channel}' and now it has ${count} active subscriptions.`);
				});
			}

			if (options.attachDebugListeners === true || options.attachDebugListeners.has('psubscribe')) {
				redisClient.nodeRedis.on('psubscribe', (pattern, count) => {
					logger.debug(`${connectionType} connection subscribed to pattern '${pattern}' and now it has ${count} active subscriptions.`);
				});
			}

			if (options.attachDebugListeners === true || options.attachDebugListeners.has('unsubscribe')) {
				redisClient.nodeRedis.on('unsubscribe', (channel, count) => {
					logger.debug(`${connectionType} connection unsubscribed from channel '${channel}' and now it has ${count} active subscriptions.`);
				});
			}

			if (options.attachDebugListeners === true || options.attachDebugListeners.has('punsubscribe')) {
				redisClient.nodeRedis.on('punsubscribe', (pattern, count) => {
					logger.debug(`${connectionType} connection unsubscribed from pattern '${pattern}' and now it has ${count} active subscriptions.`);
				});
			}
		}

		if (options.attachDebugListeners === true || options.attachDebugListeners.has('connect')) {
			redisClient.nodeRedis.on('connect', () => {
				logger.debug(`${connectionType} connection established.`);
			});
		}

		if (options.attachDebugListeners === true || options.attachDebugListeners.has('reconnecting')) {
			redisClient.nodeRedis.on('reconnecting', (reconnect: { delay: number; attempt: number; error?: RedisError }) => {
				logger.debug(
					`${connectionType} connection is reconnecting.${RedisClient.isNumber(reconnect.delay) ? ` Delay: ${reconnect.delay} ms.` : ''} Attempt: ${
						reconnect.attempt
					}.`
				);
				if (reconnect.error) {
					logger.error(`${connectionType} connection reconnect error:\n${RedisClient.formatRedisError(reconnect.error)}`);
				}
			});
		}

		if (options.attachDebugListeners === true || options.attachDebugListeners.has('end')) {
			redisClient.nodeRedis.on('end', () => {
				logger.notice(`${connectionType} connection closed.`);
			});
		}
	}

	private static redisUrl(options: RedisConnectionOptions): string {
		if (options.path) {
			return options.path;
		}
		if (options.url) {
			return options.url;
		}
		return `${options.tls ? 'rediss' : 'redis'}://${options.password ? `:${options.password}@` : ''}${options.host || '127.0.0.1'}${
			options.port ? `:${options.port}` : ''
		}${options.db ? `/${options.db}` : ''}`;
	}

	private static formatRedisError(redisError: RedisError): string {
		if (redisError instanceof AggregateError) {
			const message = new Array<string>(error.format(redisError, RedisClient.EXCLUDE_PROPS_FROM_FORMATTED_REDIS_ERR), 'Aggregated Errors:');
			// @ts-ignore
			for (const err of redisError.errors) {
				message.push(error.format(err, error.format.NO_STACK_TRACE), '\n');
			}
			return message.join('\n');
		}

		return error.format(redisError, error.format.NO_STACK_TRACE);
	}

	private static createRetryStrategy(connectionType: ConnectionType, options: RedisConnectionOptions): RetryStrategy {
		if (options.connect_timeout == null) {
			options.connect_timeout = 3600000;
		}
		if (options.max_attempts == null) {
			options.max_attempts = 10;
		}
		if (options.retry_max_delay == null) {
			options.retry_max_delay = 3000;
		}

		return (retryOptions) => {
			if (retryOptions.error && retryOptions.error.code === 'ECONNREFUSED') {
				return new Error(
					`${connectionType} reconnection stopped. The server refused the connection.\n${RedisClient.formatRedisError(retryOptions.error)}.`
				);
			}
			if (retryOptions.total_retry_time > options.connect_timeout!) {
				return new Error(
					`${connectionType} reconnection stopped. Total retry time ${retryOptions.total_retry_time} exceeds connect timeout ${options.connect_timeout}.`
				);
			}
			if (retryOptions.attempt > options.max_attempts!) {
				return new Error(`${connectionType} reconnection stopped. Maximum reconnect attempts ${options.max_attempts} have been reached.`);
			}

			// retry after x milliseconds
			return Math.min(number.randomInt(2 ** (retryOptions.attempt - 1), 2 ** retryOptions.attempt) * 1000, options.retry_max_delay!);
		};
	}

	private static isNumber(num: any): boolean {
		if (typeof num === 'number') {
			return !Number.isNaN(num);
		}
		return false;
	}
}

export { RedisClient, NodeRedisClient, NodeRedisClientMulti, RedisConnectionOptions, RedisModule, InitializationOptions, ConnectionType, DebuggableEventType };
