import { Nullable } from '@thermopylae/core.declarations';
import * as TransportStream from 'winston-transport';
import WinstonGraylog2 from 'winston-graylog2';
// eslint-disable-next-line import/extensions, import/no-unresolved
import { AbstractTransportManager } from '../typings';
import { createException, ErrorCodes } from '../error';

interface GraylogEndpoint {
	host: string;
	port: number;
}

interface GraylogLoggingChannel {
	level: string;
	input: string;
}

/**
 * Class responsible for holding references to graylog inputs.
 */
class GrayLogsManager implements AbstractTransportManager {
	private inputs: Nullable<Map<string, GraylogEndpoint>>;

	private channels: Nullable<Map<string, GraylogLoggingChannel>>;

	public constructor() {
		this.inputs = null;
		this.channels = null;
	}

	/**
	 * Registers a new graylog2 input.
	 *
	 * @param   input       Input name, acting as an identifier.
	 * @param   endpoint    Options based on which transport will be created.
	 */
	public register(input: string, endpoint: GraylogEndpoint): void {
		if (this.inputs == null) {
			this.inputs = new Map();
		}

		if (this.inputs.has(input)) {
			throw createException(ErrorCodes.GRAYLOG2_INPUT_EXISTS, `${input} has been registered already with ${JSON.stringify(this.inputs.get(input))}.`);
		}

		this.inputs.set(input, endpoint);
	}

	/**
	 * Defines a logging channel for module, which instructs the manager
	 * which log level and input to use for him. <br>
	 * '@all' module can be specified as default channel.
	 *
	 * @param module     Module name.
	 * @param channel    Module channel.
	 */
	public setChannel(module: string, channel: GraylogLoggingChannel): void {
		if (this.channels == null) {
			this.channels = new Map();
		}

		if (this.channels.has(module)) {
			throw createException(
				ErrorCodes.GRAYLOG2_CHANNEL_EXISTS,
				`${module} has been registered already with ${JSON.stringify(this.channels.get(module))}.`
			);
		}

		this.channels.set(module, channel);
	}

	/**
	 * Create transport for module.
	 * When no inputs configured, it means graylog transport is not used. <br>
	 * Do not pass @all module name, as it will be removed.
	 *
	 * @private
	 */
	public get(module: string): Nullable<TransportStream> {
		if (this.inputs == null) {
			return null;
		}
		if (this.channels == null) {
			throw createException(ErrorCodes.NO_GRAYLOG2_CHANNELS, 'No channels configured.');
		}

		const channel = this.channels.get(module) || this.channels.get('@all');
		if (channel == null) {
			throw createException(ErrorCodes.GRAYLOG2_CHANNEL_NOT_FOUND, `Neither '@all' recipe, nor '${module}' recipe were configured.`);
		}

		const endpoint = this.inputs.get(channel.input);
		if (endpoint == null) {
			throw createException(ErrorCodes.GRAYLOG2_INPUT_NOT_FOUND, `Graylog2 endpoint for input ${channel.input} not configured.`);
		}

		this.channels.delete(module); // transport for specific system can be obtained only once, so clean memory, be kind :)

		const transport = new WinstonGraylog2({
			name: `graylog-${module}`,
			level: channel.level,
			graylog: {
				servers: [endpoint]
			},
			staticMeta: { system: module }
		});
		return transport as TransportStream;
	}
}

export { GrayLogsManager, GraylogEndpoint, GraylogLoggingChannel };
