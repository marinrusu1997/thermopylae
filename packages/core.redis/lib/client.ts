import { number } from '@thermopylae/lib.utils';
import redis, { AggregateError, ClientOpts, RedisError, ReplyError } from 'redis';
import { createNodeRedisClient, WrappedNodeRedisClient } from 'handy-redis';
import type { RequireSome } from '@thermopylae/core.declarations';
import { logger } from './logger';

// @fixme reimplement according to https://www.npmjs.com/package/redis

type ConnectOptions = RequireSome<ClientOpts, 'connect_timeout' | 'max_attempts' | 'retry_max_delay'>;

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
	private readonly connections: Record<ConnectionType, WrappedNodeRedisClient> = {
		[ConnectionType.REGULAR]: null!,
		[ConnectionType.SUBSCRIBER]: null!,
		[ConnectionType.PUBLISHER]: null!
	};

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
	 * @param options	Client options.
	 */
	public async connect(options: ConnectOptions): Promise<void> {
		options.retry_strategy = (retryOptions) => {
			if (retryOptions.error && retryOptions.error.code === 'ECONNREFUSED') {
				return new Error(`Reconnecting... The server refused the connection. Cause: ${JSON.stringify(retryOptions.error)}.`);
			}
			if (retryOptions.total_retry_time > options.connect_timeout) {
				return new Error(`Reconnecting... Giving up. Total retry time: ${retryOptions.total_retry_time}. Retry time exhausted.`);
			}
			if (retryOptions.attempt > options.max_attempts) {
				return new Error(`Reconnecting... Maximum reconnect attempts of ${options.max_attempts} have been reached.`);
			}

			// retry after x milliseconds
			return Math.min(number.randomInt(2 ** (retryOptions.attempt - 1), 2 ** retryOptions.attempt) * 1000, options.retry_max_delay);
		};

		logger.info(`Establishing connections to ${options.host}:${options.port} ...`);
		await Promise.all([
			this.establishConnection(options, ConnectionType.REGULAR),
			this.establishConnection(options, ConnectionType.SUBSCRIBER),
			this.establishConnection(options, ConnectionType.PUBLISHER)
		]);
	}

	/**
	 * Disconnect from Redis server.
	 *
	 * @param graceful		Whether to perform graceful disconnect.
	 */
	public async disconnect(graceful = true): Promise<void> {
		if (graceful) {
			logger.notice('Shutting down gracefully...');
			await Promise.all([
				this.connections[ConnectionType.REGULAR].quit(),
				this.connections[ConnectionType.SUBSCRIBER].quit(),
				this.connections[ConnectionType.PUBLISHER].quit()
			]);
		} else {
			logger.notice('Shutting down forcibly...');
			this.connections[ConnectionType.REGULAR].end(true);
			this.connections[ConnectionType.SUBSCRIBER].end(true);
			this.connections[ConnectionType.PUBLISHER].end(true);
		}
	}

	private async establishConnection(options: ConnectOptions, connectionType: ConnectionType): Promise<void> {
		return new Promise((resolve, reject) => {
			try {
				let redisClient = createNodeRedisClient(options);
				RedisClient.attachEventListeners(redisClient, connectionType);

				redisClient.nodeRedis.on('ready', () => {
					this.connections[connectionType] = redisClient;
					redisClient = null!;

					logger.debug(`${connectionType} connection established.`);
					resolve(); // @fixme test what happens when can't connect
				});
			} catch (e) {
				reject(e);
			}
		});
	}

	private static attachEventListeners(redisClient: WrappedNodeRedisClient, connectionType: ConnectionType): void {
		redisClient.nodeRedis.on('error', (err) => {
			logger.error(`${connectionType} ${RedisClient.formatRedisError(err)}`);
		});
		redisClient.nodeRedis.on('warning', (msg) => {
			logger.warning(`${connectionType} warning: ${msg}.`);
		});

		redisClient.nodeRedis.on('connect', () => {
			logger.info(`${connectionType} stream is connecting...`);
		});
		redisClient.nodeRedis.on('reconnecting', (reconnect: { delay: number; attempt: number; error: RedisError }) => {
			logger.debug(`${connectionType} reconnecting... Delay: ${reconnect.delay} ms. Attempt: ${reconnect.attempt}.`);
			if (reconnect.error) {
				logger.error(`${connectionType} ${RedisClient.formatRedisError(reconnect.error)}`);
			}
		});
		redisClient.nodeRedis.on('end', () => {
			logger.warning(`${connectionType} connection closed.`);
		});
	}

	private static formatRedisError(error: RedisError): string {
		// @ts-ignore
		let errMsg = `Code: ${error.code}. Origin: ${error.origin}. `;
		if (error instanceof ReplyError) {
			// @ts-ignore
			errMsg += `Command: ${error.command}. Arguments: ${JSON.stringify(error.args)}. `;
		}
		if (error instanceof AggregateError) {
			// @ts-ignore
			errMsg += `Aggregated errors: ${JSON.stringify(error.errors)}.`;
		}
		return errMsg;
	}
}

export { RedisClient, ConnectOptions };
