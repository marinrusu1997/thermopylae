import { Modules } from '@marin/declarations/lib/modules';
import bluebird from 'bluebird';
import redis, { AggregateError, ClientOpts, RedisClient, RedisError, ReplyError } from 'redis';
import { number } from '@marin/lib.utils';
import { getLogger } from './logger';

// FIXME remove this bluebird!
bluebird.promisifyAll(redis);

let redisClient: RedisClient | null = null;
let connectedAfterInitialization = false;

function resetRedisClient(): void {
	redisClient = null;
	connectedAfterInitialization = false;
}

function logRedisError(error: RedisError): void {
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

function initRedisClient(options: ClientOpts, debug?: boolean, monitor?: boolean): Promise<void> {
	if (!redisClient) {
		return new Promise((resolve, reject) => {
			redis.debug_mode = debug || false;

			redisClient = redis.createClient({
				...options,
				retry_strategy: retryOptions => {
					if (retryOptions.error && retryOptions.error.code === 'ECONNREFUSED') {
						return new Error(`Reconnecting... The server refused the connection. Cause: ${JSON.stringify(retryOptions.error)}.`);
					}
					if (retryOptions.total_retry_time > options.connect_timeout!) {
						return new Error(`Reconnecting... Giving up. Total retry time: ${retryOptions.total_retry_time}. Retry time exhausted.`);
					}
					if (retryOptions.attempt > options.max_attempts!) {
						return new Error(`Reconnecting... Maximum reconnect attempts of ${options.max_attempts!} have been reached.`);
					}

					// retry after x milliseconds
					return Math.min(number.generateRandom(2 ** (retryOptions.attempt - 1), 2 ** retryOptions.attempt) * 1000, options.retry_max_delay!);
				}
			});
			redisClient.on('ready', () => {
				getLogger(Modules.REDIS_CLIENT).debug(`Connection established. Server info: ${JSON.stringify(redisClient!.server_info)}. `);

				if (monitor) {
					redisClient!.on('monitor', (timestamp: string, args: any[], replyStr: string) => {
						getLogger(Modules.REDIS_CLIENT).debug(
							`Monitored: Raw reply: ${replyStr}. Args: ${JSON.stringify(args)}. Timestamp: ${new Date(Number(timestamp) * 1000)}. `
						);
					});

					redisClient!.MONITOR(err => {
						if (err) {
							return reject(err);
						}
						getLogger(Modules.REDIS_CLIENT).debug('Entering monitor mode.');
						connectedAfterInitialization = true;
						return resolve();
					});
				} else {
					connectedAfterInitialization = true;
					resolve();
				}
			});
			redisClient.on('error', err => {
				if (!connectedAfterInitialization) {
					return reject(err);
				}
				if (err.code === 'CONNECTION_BROKEN') {
					throw err;
				}
				return logRedisError(err);
			});
			redisClient.on('warning', (msg: string) => getLogger(Modules.REDIS_CLIENT).warning(`Warning: ${msg}. `));

			if (debug) {
				redisClient.on('connect', () => getLogger(Modules.REDIS_CLIENT).debug('Stream is connecting... '));
				redisClient.on('reconnecting', (reconnect: { delay: number; attempt: number; error: RedisError }) => {
					getLogger(Modules.REDIS_CLIENT).debug(`Reconnecting... Delay: ${reconnect.delay} ms. Attempt: ${reconnect.attempt}. `);
					if (reconnect.error) {
						logRedisError(reconnect.error);
					}
				});
				redisClient.on('end', () => getLogger(Modules.REDIS_CLIENT).debug('Connection closed. '));
			}
		});
	}
	return Promise.resolve();
}

function shutdownRedisClient(graceful = true): Promise<void> {
	let resolve: Function;
	let reject: Function;
	const promise = new Promise<void>((_resolve, _reject) => {
		resolve = _resolve;
		reject = _reject;
	});
	if (graceful) {
		redisClient!.quit((err, res) => {
			resetRedisClient();

			if (err) {
				return reject(err);
			}

			if (res !== 'OK') {
				return reject(new Error(`Redis client, unexpected quit result: ${res}. `));
			}

			return resolve();
		});
	} else {
		redisClient!.end(true);
		process.nextTick(() => {
			resetRedisClient();
			resolve();
		});
	}

	return promise;
}

function getRedisClient(): RedisClient {
	return redisClient!;
}

export { initRedisClient, shutdownRedisClient, getRedisClient, RedisClient, ClientOpts };
