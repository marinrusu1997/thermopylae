import { Modules } from '@marin/declarations/lib/modules';
import bluebird from 'bluebird';
import redis, { AggregateError, ClientOpts, RedisClient, RedisError, ReplyError } from 'redis';
import { getLogger } from './logger';

// FIXME remove this bluebird!
bluebird.promisifyAll(redis);

let redisClient: RedisClient;

function handleRedisError(error: RedisError): void {
	let errMsg = 'Error encountered. ';
	// @ts-ignore
	if (error.origin) {
		// @ts-ignore
		errMsg += `Origin: ${JSON.stringify(error.origin)}. `;
	}
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

let connectedAfterInitialization = false;

function initRedisClient(options: ClientOpts, debug?: boolean, monitor?: boolean): Promise<void> {
	if (!redisClient) {
		return new Promise((resolve, reject) => {
			redis.debug_mode = debug || false;

			redisClient = redis.createClient({
				...options,
				retry_strategy: retryOptions => {
					if (retryOptions.error && retryOptions.error.code === 'ECONNREFUSED') {
						// End reconnecting on a specific error and flush all commands with a individual error
						return new Error(`Reconnecting... The server refused the connection. Cause: ${JSON.stringify(retryOptions.error)}. `);
					}
					if (retryOptions.total_retry_time > options.connect_timeout!) {
						// End reconnecting after a specific timeout and flush all commands with a individual error
						return new Error(`Reconnecting... Giving up. Total retry time: ${retryOptions.total_retry_time}. Retry time exhausted. `);
					}
					if (retryOptions.attempt > options.max_attempts!) {
						// End reconnecting with built in error
						return new Error(`Reconnecting... Maximum reconnect attempts of ${options.max_attempts!} has been reached. `);
					}
					// reconnect after
					return Math.min(retryOptions.attempt * 100, options.retry_max_delay!);
				}
			});
			redisClient.on('ready', () => {
				getLogger(Modules.REDIS_CLIENT).debug('Connection established. ');

				if (monitor) {
					redisClient.on('monitor', (timestamp: string, args: any[], replyStr: string) => {
						getLogger(Modules.REDIS_CLIENT).debug(
							`Monitoring... Timestamp: ${new Date(Number(timestamp) * 1000)}. Args: ${JSON.stringify(args)}. Raw reply: ${replyStr}. `
						);
					});

					redisClient.MONITOR(err => {
						if (err) {
							return handleRedisError(err);
						}
						return getLogger(Modules.REDIS_CLIENT).debug('Entering monitor mode.');
					});
				}

				if (debug) {
					getLogger(Modules.REDIS_CLIENT).debug(`Server info: ${JSON.stringify(redisClient.server_info)}. `);
				}

				connectedAfterInitialization = true;
				resolve();
			});
			redisClient.on('connect', () => getLogger(Modules.REDIS_CLIENT).debug('Stream is connected. '));
			redisClient.on('reconnecting', (reconnect: { delay: number; attempt: number; error: RedisError }) => {
				getLogger(Modules.REDIS_CLIENT).info(`Reconnecting... Delay: ${reconnect.delay}. Attempt: ${reconnect.attempt}. `);
				if (reconnect.error) {
					handleRedisError(reconnect.error);
				}
			});
			redisClient.on('error', err => {
				if (!connectedAfterInitialization) {
					return reject(err);
				}
				return handleRedisError(err);
			});
			redisClient.on('end', () => getLogger(Modules.REDIS_CLIENT).debug('Connection closed. '));
			redisClient.on('warning', (msg: string) => getLogger(Modules.REDIS_CLIENT).warning(`Warning: ${msg}. `));
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
		redisClient.quit((err, res) => {
			if (err) {
				return reject(err);
			}
			if (res !== 'OK') {
				return reject(new Error(`Redis client, unexpected quit result: ${res}. `));
			}
			return resolve();
		});
	} else {
		redisClient.end(true);
		process.nextTick(resolve!);
	}

	return promise;
}

function getRedisClient(): RedisClient {
	return redisClient;
}

export { initRedisClient, shutdownRedisClient, getRedisClient, RedisClient, ClientOpts };
