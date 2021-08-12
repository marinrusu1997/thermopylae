import { Consumer, Kafka, logLevel, Producer } from 'kafkajs';
import { ObjMap } from '@thermopylae/core.declarations';
// eslint-disable-next-line import/extensions, node/no-extraneous-import
import type { SyslogConfigSetLevels } from 'winston/lib/winston/config';
import { createException, ErrorCodes } from '../error';
import { kafkaLogger, logger } from '../logger';
import { APP_NODE_ID } from '../constants';

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

	public onMessage: OnKafkaMessageHandler<any, any> | null = null;

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
				eachMessage: async (payload) => {
					try {
						const key = payload.message.key.toString();
						const value = payload.message.value!.toString();
						kafkaLogger.debug(`Received message with key '${key}' and value '${value}'.`);

						if (key !== APP_NODE_ID) {
							this.onMessage!(JSON.parse(value));
						}
					} catch (e) {
						logger.error('Error occurred in Kafka eachMessage handler.', e);
					}
				}
			})
			.catch((e) => kafkaLogger.error('Consumer run method caught exception.', e));
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
		} catch (e) {
			logger.error(`Failed to publish message to Kafka topic '${this.topic}'.`, e);
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

export { KafkaClient, KafkaMessage, KafkaClientOptions, OnKafkaMessageHandler };
