import { error, number } from '@thermopylae/lib.utils';
import type { RequireSome } from '@thermopylae/core.declarations';
import { ErrorCodes } from '@thermopylae/core.declarations';
import type { ClientOpts, RedisError, RetryStrategy } from 'redis';
import redis, { AggregateError } from 'redis';
import type { WrappedNodeRedisClient } from 'handy-redis';
import { createNodeRedisClient } from 'handy-redis';
import { logger } from './logger';
import { createException } from './error';

type RequireHostPortClientOptions = RequireSome<ClientOpts, 'host' | 'port'>;
type RequirePathClientOptions = RequireSome<ClientOpts, 'path'>;
type RequireUrlClientOptions = RequireSome<ClientOpts, 'url'>;
type ConnectionOptions = RequireHostPortClientOptions | RequirePathClientOptions | RequireUrlClientOptions;

type RequiredClientOptions = RequireSome<
	ClientOpts,
	'enable_offline_queue' | 'retry_unfulfilled_commands' | 'password' | 'db' | 'connect_timeout' | 'max_attempts' | 'retry_max_delay'
>;
type OmittedClientOptions = Omit<ClientOpts, 'no_ready_check' | 'disable_resubscribing' | 'rename_commands' | 'prefix'>;

type RedisClientOptions = ConnectionOptions | RequiredClientOptions | OmittedClientOptions;

const enum ConnectionType {
	REGULAR = 'REGULAR',
	SUBSCRIBER = 'SUBSCRIBER',
	PUBLISHER = 'PUBLISHER'
}

/**
 * Redis client which wraps *node_redis* client and handles:
 * 	- connection
 * 	- disconnection
 * 	- event listeners
 * 	- logging
 */
class RedisClient {
	private static readonly EXCLUDE_PROPS_FROM_FORMATTED_REDIS_ERR: ReadonlyArray<keyof AggregateError | string> = ['stack', 'errors'];

	private readonly connections: Record<ConnectionType, WrappedNodeRedisClient> = {
		[ConnectionType.REGULAR]: null!,
		[ConnectionType.SUBSCRIBER]: null!,
		[ConnectionType.PUBLISHER]: null!
	};

	private readonly queuedEventListeners: Record<ConnectionType, Array<[string, (...args: any[]) => void]>> = {
		[ConnectionType.REGULAR]: [],
		[ConnectionType.SUBSCRIBER]: [],
		[ConnectionType.PUBLISHER]: []
	};

	private options!: Readonly<Record<ConnectionType, RedisClientOptions>>;

	public get db(): string | number {
		return this.options[ConnectionType.REGULAR].db!;
	}

	public get debug(): boolean {
		return redis.debug_mode;
	}

	public set debug(value: boolean) {
		redis.debug_mode = value;
	}

	/**
	 * Get regular redis client.
	 */
	public get client(): WrappedNodeRedisClient {
		return this.connections[ConnectionType.REGULAR];
	}

	/**
	 * Get subscriber redis client.
	 */
	public get subscriber(): WrappedNodeRedisClient {
		return this.connections[ConnectionType.SUBSCRIBER];
	}

	/**
	 * Get publisher redis client.
	 */
	public get publisher(): WrappedNodeRedisClient {
		return this.connections[ConnectionType.PUBLISHER];
	}

	public on(connectionType: ConnectionType, event: 'message' | 'message_buffer', listener: (channel: string, message: string) => void): this;

	public on(
		connectionType: ConnectionType,
		event: 'pmessage' | 'pmessage_buffer',
		listener: (pattern: string, channel: string, message: string) => void
	): this;

	public on(connectionType: ConnectionType, event: 'subscribe' | 'unsubscribe', listener: (channel: string, count: number) => void): this;

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
	 * @param connections	Which connections needs to be opened. <br/>
	 * 						At least {@link ConnectionType.REGULAR} connection needs to be specified.
	 */
	public async connect(connections: Readonly<Partial<Record<ConnectionType, RedisClientOptions>>>): Promise<void> {
		if (connections[ConnectionType.REGULAR] == null) {
			throw createException(ErrorCodes.REQUIRED, `Options for ${ConnectionType.REGULAR} connection are required.`);
		}

		try {
			await Promise.all(
				(Object.entries(connections) as [ConnectionType, RedisClientOptions][]).map(([connectionType, options]) => {
					if (options.retry_strategy == null) {
						options.retry_strategy = RedisClient.createRetryStrategy(connectionType, options);
					}
					if (options.db == null) {
						options.db = 0;
					}

					return this.establishConnection(options, connectionType);
				})
			);

			for (const [connectionType, queuedEvents] of Object.entries(this.queuedEventListeners)) {
				if (queuedEvents.length !== 0) {
					throw new Error(
						`Redis connections were established, but there are ${queuedEvents.length} queued event listeners for ${connectionType} connection that weren't registered.`
					); // automatic connection quit for those that were established
				}
			}

			this.options = connections as Readonly<Required<Record<ConnectionType, RedisClientOptions>>>;
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
	 * Disconnect from Redis server.
	 *
	 * @param graceful		Whether to perform graceful disconnect.
	 */
	public async disconnect(graceful = true): Promise<void> {
		if (graceful) {
			await Promise.all(
				Object.entries(this.connections)
					.filter(([, connection]) => connection != null)
					.map(([type, connection]) => {
						logger.debug(`Shutting down gracefully ${type} connection.`);
						return connection.quit();
					})
			);
		} else {
			for (const [type, connection] of Object.entries(this.connections)) {
				if (connection == null) {
					continue;
				}
				logger.debug(`Shutting down forcibly ${type} connection`);
				connection.end(true);
			}
		}
	}

	private async establishConnection(options: RedisClientOptions, connectionType: ConnectionType): Promise<void> {
		return new Promise((resolve, reject) => {
			try {
				logger.debug(`Establishing ${connectionType} connection to ${RedisClient.redisUrl(options)}.`);

				let redisClient = createNodeRedisClient(options);
				RedisClient.attachEventListeners(redisClient, connectionType);

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

						this.connections[connectionType] = redisClient;
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
			} catch (e) {
				reject(e);
			}
		});
	}

	private static attachEventListeners(redisClient: WrappedNodeRedisClient, connectionType: ConnectionType): void {
		if (connectionType === ConnectionType.SUBSCRIBER) {
			redisClient.nodeRedis.on('subscribe', (channel, count) => {
				logger.debug(`${connectionType} connection subscribed to channel '${channel}' and now it has ${count} active subscriptions.`);
			});
			redisClient.nodeRedis.on('psubscribe', (pattern, count) => {
				logger.debug(`${connectionType} connection subscribed to pattern '${pattern}' and now it has ${count} active subscriptions.`);
			});
			redisClient.nodeRedis.on('unsubscribe', (channel, count) => {
				logger.debug(`${connectionType} connection unsubscribed from channel '${channel}' and now it has ${count} active subscriptions.`);
			});
			redisClient.nodeRedis.on('punsubscribe', (pattern, count) => {
				logger.debug(`${connectionType} connection unsubscribed from pattern '${pattern}' and now it has ${count} active subscriptions.`);
			});
		}

		redisClient.nodeRedis.on('warning', (msg) => {
			logger.warning(`${connectionType} connection warning: ${msg}.`);
		});
		redisClient.nodeRedis.on('connect', () => {
			logger.info(`${connectionType} connection established.`);
		});
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
		redisClient.nodeRedis.on('end', () => {
			logger.notice(`${connectionType} connection closed.`);
		});
	}

	private static redisUrl(options: RedisClientOptions): string {
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

	private static createRetryStrategy(connectionType: ConnectionType, options: RedisClientOptions): RetryStrategy {
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

export { RedisClient, RedisClientOptions, ConnectionType };
