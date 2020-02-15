import { Modules } from '@marin/declarations/lib/modules';
import bluebird from 'bluebird';
import redis, { AggregateError, ClientOpts, RedisClient as RedisLibraryClient, RedisError, ReplyError } from 'redis';
import { number } from '@marin/lib.utils';
import { getLogger } from './logger';

// FIXME remove this bluebird!8
bluebird.promisifyAll(redis);

interface RedisClientOptions {
	client: ClientOpts;
	monitor?: boolean;
	debug?: boolean;
}

class RedisClient {
	private redisClient: RedisLibraryClient | null = null;

	private connectedAfterInitialization = false;

	public init(options: RedisClientOptions): Promise<void> {
		if (!this.redisClient) {
			return new Promise((resolve, reject) => {
				redis.debug_mode = options.debug || false;

				this.redisClient = redis.createClient({
					...options,
					retry_strategy: retryOptions => {
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
						return Math.min(
							number.generateRandom(2 ** (retryOptions.attempt - 1), 2 ** retryOptions.attempt) * 1000,
							options.client.retry_max_delay!
						);
					}
				});

				this.redisClient.on('ready', () => {
					getLogger(Modules.REDIS_CLIENT).info(`Connection established. Server info: ${JSON.stringify(this.redisClient!.server_info)}. `);

					if (options.monitor) {
						this.redisClient!.on('monitor', (timestamp: string, args: any[], replyStr: string) => {
							getLogger(Modules.REDIS_CLIENT).debug(
								`Monitored: Raw reply: ${replyStr}. Args: ${JSON.stringify(args)}. Timestamp: ${new Date(Number(timestamp) * 1000)}. `
							);
						});

						this.redisClient!.MONITOR(err => {
							if (err) {
								return reject(err);
							}
							getLogger(Modules.REDIS_CLIENT).debug('Entering monitor mode.');
							this.connectedAfterInitialization = true;
							return resolve();
						});
					} else {
						this.connectedAfterInitialization = true;
						resolve();
					}
				});

				this.redisClient.on('error', err => {
					if (!this.connectedAfterInitialization) {
						return reject(err);
					}

					if (err.code === 'CONNECTION_BROKEN') {
						throw err;
					}

					return RedisClient.logRedisError(err);
				});

				this.redisClient.on('warning', (msg: string) => getLogger(Modules.REDIS_CLIENT).warning(`Warning: ${msg}. `));

				this.redisClient.on('connect', () => getLogger(Modules.REDIS_CLIENT).info('Stream is connecting... '));

				this.redisClient.on('reconnecting', (reconnect: { delay: number; attempt: number; error: RedisError }) => {
					getLogger(Modules.REDIS_CLIENT).info(`Reconnecting... Delay: ${reconnect.delay} ms. Attempt: ${reconnect.attempt}. `);
					if (reconnect.error) {
						RedisClient.logRedisError(reconnect.error);
					}
				});

				this.redisClient.on('end', () => getLogger(Modules.REDIS_CLIENT).warning('Connection closed. '));
			});
		}
		return Promise.resolve();
	}

	public shutdown(graceful = true): Promise<void> {
		let resolve: Function;
		let reject: Function;
		const promise = new Promise<void>((_resolve, _reject) => {
			resolve = _resolve;
			reject = _reject;
		});

		const shutdownCallback = (err: Error | null, res: 'OK'): void => {
			this.reset();

			if (err) {
				return reject(err);
			}

			if (res !== 'OK') {
				return reject(new Error(`Redis client, unexpected quit result: ${res}. `));
			}

			getLogger(Modules.REDIS_CLIENT).notice('Redis client has been shut down.');
			return resolve();
		};

		if (graceful) {
			this.redisClient!.quit(shutdownCallback);
		} else {
			this.redisClient!.end(true);
			process.nextTick(() => {
				shutdownCallback(null, 'OK');
			});
		}

		return promise;
	}

	public getClient(): RedisLibraryClient {
		return this.redisClient!;
	}

	private reset(): void {
		this.redisClient = null;
		this.connectedAfterInitialization = false;
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
		getLogger(Modules.REDIS_CLIENT).error(errMsg, error);
	}
}

const RedisClientInstance = new RedisClient();

export { RedisClientInstance, RedisClientOptions, ClientOpts, RedisLibraryClient };
