import { Kafka, Producer, Consumer, logLevel } from 'kafkajs';
import { ObjMap } from '@thermopylae/core.declarations';
import { logger } from '../logger';

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

const toWinstonLogLevel = (level: logLevel): string => {
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
			throw new Error('Unknown kafka log level');
	}
};

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
				logger.log({
					level: toWinstonLogLevel(logEntry.level),
					message: `KAFKA [${logEntry.namespace}] ${logEntry.log.message}` // @fixme
				});
			}
		});
		this.producer = this.client.producer();
		this.consumer = this.client.consumer({
			groupId: options.groupId
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
						if (Number(payload.message.key.toString()) !== process.pid) {
							this.onMessage!(JSON.parse(payload.message.value!.toString()));
						}
					} catch (e) {
						logger.error('Error occurred in Kafka each message handler.', e);
					}
				}
			})
			.catch((e) => logger.error('Kafka consumer caught exception.', e));
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
						key: String(process.pid),
						value: JSON.stringify(msg)
					}
				]
			});
		} catch (e) {
			logger.error(`Failed to publish message to Kafka topic '${this.topic}'.`, e);
		}
	}
}

export { KafkaClient, KafkaMessage };
