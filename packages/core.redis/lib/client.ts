import { number, error } from '@thermopylae/lib.utils';
import type { RequireSome } from '@thermopylae/core.declarations';
import redis, { AggregateError } from 'redis';
import type { ClientOpts, RedisError, RetryStrategy } from 'redis';
import { createNodeRedisClient } from 'handy-redis';
import type { WrappedNodeRedisClient } from 'handy-redis';
import { logger } from './logger';

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

	/**
	 * Connect to Redis server.
	 *
	 * @param connections	Which connections needs to be opened.
	 */
	public async connect(connections: Readonly<Partial<Record<ConnectionType, RedisClientOptions>>>): Promise<void> {
		try {
			await Promise.all(
				(Object.entries(connections) as [ConnectionType, RedisClientOptions][]).map(([connectionType, options]) => {
					if (options.retry_strategy == null) {
						options.retry_strategy = RedisClient.createRetryStrategy(connectionType, options);
					}

					return this.establishConnection(options, connectionType);
				})
			);
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
				logger.info(`Establishing ${connectionType} connection to ${RedisClient.redisUrl(options)}.`);

				let redisClient = createNodeRedisClient(options);
				RedisClient.attachEventListeners(redisClient, connectionType);

				redisClient.nodeRedis.on('ready', () => {
					this.connections[connectionType] = redisClient;
					redisClient = null!;

					logger.debug(`${connectionType} connection is ready.`);
					resolve();
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
		redisClient.nodeRedis.on('warning', (msg) => {
			logger.warning(`${connectionType} connection warning: ${msg}.`);
		});

		redisClient.nodeRedis.on('connect', () => {
			logger.debug(`${connectionType} connection is established.`);
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
