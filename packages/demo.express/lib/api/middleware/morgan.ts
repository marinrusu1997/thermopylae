import type { types } from '@thermopylae/lib.utils';
import morgan, { type FormatFn } from 'morgan';
import { logger } from '../../logger.js';

morgan.token('id', (req) => (req as types.Any).id);
const morganFormat: FormatFn = (tokens, req, res): string => {
	// get the status code if response written
	const status = res.headersSent ? res.statusCode : -1;

	// get status color
	const color =
		status >= 500
			? 31 // red
			: status >= 400
				? 33 // yellow
				: status >= 300
					? 36 // cyan
					: status >= 200
						? 32 // green
						: 0; // no color

	// @ts-expect-error We embed colors in morgan objectobject
	let fn = morganFormat[color];

	if (!fn) {
		const compiledFormat = morgan.compile(`:id \u001B[0m:method :url \u001B[${color}m:status\u001B[0m :response-time ms - :res[content-length]\u001B[0m`);
		(morganFormat as types.Any)[color] = compiledFormat;
		fn = compiledFormat;
	}

	return fn(tokens, req, res);
};

const morganMiddleware = morgan(morganFormat, {
	stream: {
		write(str) {
			logger.debug(str);
		}
	}
});

export { morganMiddleware };
