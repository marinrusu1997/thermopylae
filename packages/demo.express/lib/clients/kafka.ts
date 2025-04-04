import type { ObjMap } from '@thermopylae/core.declarations';
import { json, type types } from '@thermopylae/lib.utils';
import { type Consumer, Kafka, type Producer, logLevel } from 'kafkajs';
import type { SyslogConfigSetLevels } from 'winston/lib/winston/config/index.js';
import { APP_NODE_ID } from '../constants.js';
import { ErrorCodes, createException } from '../error.js';
import { kafkaLogger, logger } from '../logger.js';

interface KafkaClientOptions {
	clientId: string;
	brokers: string[];
	groupId: string;
	topic: string;
}

interface KafkaMessage<Type, Payload> {
	type: Type;
	payload: Payload;
}

type OnKafkaMessageHandler<Type, Payload> = (message: KafkaMessage<Type, Payload>) => void;

class KafkaClient {
	private readonly client: Kafka;

	private readonly producer: Producer;

	private readonly consumer: Consumer;

	private readonly topic: string;

	public onMessage: OnKafkaMessageHandler<types.Any, types.Any> | null = null;

	public constructor(options: KafkaClientOptions) {
		this.client = new Kafka({
			clientId: options.clientId,
			brokers: options.brokers,
			logCreator: () => (logEntry) => {
				kafkaLogger.log({
					level: KafkaClient.toWinstonLogLevel(logEntry.level) as string,
					message: `[${logEntry.namespace}] ${logEntry.log.message}`
				});
			}
		});
		this.producer = this.client.producer();
		this.consumer = this.client.consumer({
			groupId: options.groupId + APP_NODE_ID
		});
		this.topic = options.topic;
	}

	public async connect(): Promise<void> {
		await Promise.all([this.producer.connect(), this.consumer.connect()]);

		await this.consumer.subscribe({ topic: this.topic });
		this.consumer
			.run({
				eachMessage: (payload) => {
					try {
						const key = payload.message.key == null ? null : payload.message.key.toString();
						const value = payload.message.value?.toString() ?? '{';
						kafkaLogger.debug(`Received message with key '${key}' and value '${value}'.`);

						if (key !== APP_NODE_ID && this.onMessage) {
							this.onMessage(json.TypedJson.parse(value));
						}
					} catch (error) {
						logger.error('Error occurred in Kafka eachMessage handler.', error);
					}

					return Promise.resolve();
				}
			})
			// oxlint-disable-next-line prefer-await-to-callbacks
			.catch((error) => kafkaLogger.error('Consumer run method caught exception.', error));
	}

	public async disconnect(): Promise<void> {
		await Promise.all([this.producer.disconnect(), this.consumer.disconnect()]);
	}

	public async publishMessage<Type extends string, Payload extends ObjMap>(msg: KafkaMessage<Type, Payload>): Promise<void> {
		try {
			await this.producer.send({
				topic: this.topic,
				messages: [
					{
						key: APP_NODE_ID,
						value: JSON.stringify(msg)
					}
				]
			});
		} catch (error) {
			logger.error(`Failed to publish message to Kafka topic '${this.topic}'.`, error);
		}
	}

	private static toWinstonLogLevel(level: logLevel): keyof SyslogConfigSetLevels {
		switch (level) {
			case logLevel.ERROR:
			case logLevel.NOTHING:
				return 'error';
			case logLevel.WARN:
				return 'warn';
			case logLevel.INFO:
				return 'info';
			case logLevel.DEBUG:
				return 'debug';
			default:
				throw createException(ErrorCodes.UNKNOWN, `Unknown kafka log level '${level}'.`);
		}
	}
}

export { KafkaClient, type KafkaMessage, type KafkaClientOptions, type OnKafkaMessageHandler };
