import { Exception } from '@thermopylae/lib.exception';
import { CoreModule } from '@thermopylae/core.declarations';

const enum ErrorCodes {
	TRANSPORT_EXISTS = 'TRANSPORT_EXISTS',

	GRAYLOG2_INPUT_EXISTS = 'GRAYLOG2_INPUT_EXISTS',
	GRAYLOG2_CHANNEL_EXISTS = 'GRAYLOG2_CHANNEL_EXISTS',
	NO_GRAYLOG2_CHANNELS = 'NO_GRAYLOG2_CHANNELS',
	GRAYLOG2_INPUT_NOT_FOUND = 'GRAYLOG2_INPUT_NOT_FOUND',
	GRAYLOG2_CHANNEL_NOT_FOUND = 'GRAYLOG2_CHANNEL_NOT_FOUND',

	FORMATTING_ORDER_EXISTS = 'FORMATTING_ORDER_EXISTS',
	FORMATTING_ORDER_NOT_CONFIGURED = 'FORMATTING_ORDER_NOT_CONFIGURED',
	FORMATTER_NOT_REGISTERED = 'FORMATTER_NOT_REGISTERED',
	UNKNOWN_OUTPUT_FORMAT = 'UNKNOWN_OUTPUT_FORMAT',

	NO_TRANSPORTS_FOR_MODULE = 'NO_TRANSPORTS_FOR_MODULE'
}

/**
 * Create exception thrown by this library.
 *
 * @private
 *
 * @param code		Error code.
 * @param message	Error message.
 *
 * @returns		Exception to be thrown.
 */
function createException(code: ErrorCodes, message: string): Exception {
	return new Exception(CoreModule.LOGGER, code, message);
}

export { createException, ErrorCodes };
