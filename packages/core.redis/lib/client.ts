import { number } from '@thermopylae/lib.utils';
import redis, { AggregateError, ClientOpts, RedisError, ReplyError } from 'redis';
import { createNodeRedisClient, WrappedNodeRedisClient } from 'handy-redis';
import { logger } from './logger';

interface ConnectOptions {
	/**
	 * Options for the underlying redis client.
	 */
	client: ClientOpts;
	/**
	 * Whether to issue **MONITOR** command after client connected.
	 */
	monitor?: boolean;
	/**
	 * Whether to enable debug mode on the underlying redis client.
	 */
	debug?: boolean;
}

/**
 * Redis client which wraps *node_redis* client and handles:
 * 	- connection
 * 	- disconnection
 * 	- event listeners
 * 	- logging
 */
class RedisClient {
	private redisClient: WrappedNodeRedisClient | null = null;

	private connectedAfterInitialization = false;

	/**
	 * Get wrapped redis client.
	 */
	public client(): WrappedNodeRedisClient {
		return this.redisClient!;
	}

	/**
	 * Connect to Redis server.
	 *
	 * @param options	Connect options.
	 */
	public connect(options: ConnectOptions): Promise<void> {
		if (!this.redisClient) {
			return new Promise((resolve, reject) => {
				try {
					options.client.retry_strategy = (retryOptions) => {
						if (retryOptions.error && retryOptions.error.code === 'ECONNREFUSED') {
							return new Error(`Reconnecting... The server refused the connection. Cause: ${JSON.stringify(retryOptions.error)}.`);
						}
						if (retryOptions.total_retry_time > options.client.connect_timeout!) {
							return new Error(`Reconnecting... Giving up. Total retry time: ${retryOptions.total_retry_time}. Retry time exhausted.`);
						}
						if (retryOptions.attempt > options.client.max_attempts!) {
							return new Error(`Reconnecting... Maximum reconnect attempts of ${options.client.max_attempts!} have been reached.`);
						}

						// retry after x milliseconds
						return Math.min(number.randomInt(2 ** (retryOptions.attempt - 1), 2 ** retryOptions.attempt) * 1000, options.client.retry_max_delay!);
					};

					logger.info(`Redis client connecting to ${options.client.host}:${options.client.port} ...`);
					redis.debug_mode = options.debug || false;
					this.redisClient = createNodeRedisClient(options.client);

					this.redisClient.nodeRedis.on('ready', () => {
						logger.debug('Connection established.');

						if (options.monitor) {
							this.redisClient!.nodeRedis.on('monitor', (timestamp: string, args: any[], replyStr: string) => {
								logger.debug(
									`Monitored: Raw reply: ${replyStr}. Args: ${JSON.stringify(args)}. Timestamp: ${new Date(Number(timestamp) * 1000)}.`
								);
							});

							logger.debug('Entering monitor mode...');
							this.redisClient!.nodeRedis.MONITOR((err) => {
								if (err) {
									return reject(err);
								}
								this.connectedAfterInitialization = true;
								return resolve();
							});
						} else {
							this.connectedAfterInitialization = true;
							resolve();
						}
					});

					this.redisClient.nodeRedis.on('error', (err) => {
						if (!this.connectedAfterInitialization) {
							return reject(err);
						}

						if (err.code === 'CONNECTION_BROKEN') {
							throw err;
						}

						return RedisClient.logRedisError(err);
					});

					this.redisClient.nodeRedis.on('warning', (msg: string) => logger.warning(`Warning: ${msg}.`));

					this.redisClient.nodeRedis.on('connect', () => logger.info('Stream is connecting...'));

					this.redisClient.nodeRedis.on('reconnecting', (reconnect: { delay: number; attempt: number; error: RedisError }) => {
						logger.info(`Reconnecting... Delay: ${reconnect.delay} ms. Attempt: ${reconnect.attempt}.`);
						if (reconnect.error) {
							RedisClient.logRedisError(reconnect.error);
						}
					});

					this.redisClient.nodeRedis.on('end', () => logger.warning('Connection closed.'));
				} catch (e) {
					reject(e);
				}
			});
		}
		return Promise.resolve();
	}

	/**
	 * Disconnect from Redis server.
	 *
	 * @param graceful		Whether to perform graceful disconnect.
	 */
	public async disconnect(graceful = true): Promise<void> {
		if (graceful) {
			logger.notice('Shutting down gracefully...');
			await this.redisClient!.quit();
		} else {
			logger.notice('Shutting down forcibly...');
			await this.redisClient!.end(true);
		}
	}

	private static logRedisError(error: RedisError): void {
		// @ts-ignore
		let errMsg = `Code: ${error.code}. Origin: ${error.origin}. `;
		if (error instanceof ReplyError) {
			// @ts-ignore
			errMsg += `Command: ${error.command}. Arguments: ${JSON.stringify(error.args)}. `;
		}
		if (error instanceof AggregateError) {
			// @ts-ignore
			errMsg += `Aggregated errors: ${JSON.stringify(error.errors)}. `;
		}
		logger.error(errMsg, error);
	}
}

export { RedisClient, ConnectOptions, ClientOpts };
