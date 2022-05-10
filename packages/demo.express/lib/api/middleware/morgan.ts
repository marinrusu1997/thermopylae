import morgan, { FormatFn } from 'morgan';
import { logger } from '../../logger';

morgan.token('id', (req) => {
	return (req as any).id as string;
});
const morganFormat: FormatFn = (tokens, req, res): string => {
	// get the status code if response written
	const status = res.headersSent ? res.statusCode : undefined;

	// get status color
	const color =
		status! >= 500
			? 31 // red
			: status! >= 400
			? 33 // yellow
			: status! >= 300
			? 36 // cyan
			: status! >= 200
			? 32 // green
			: 0; // no color

	// @ts-ignore We embed colors in morgan object
	let fn = morganFormat[color];

	if (!fn) {
		// @ts-ignore We embed colors in morgan object
		// eslint-disable-next-line no-multi-assign
		fn = morganFormat[color] = morgan.compile(`:id \x1b[0m:method :url \x1b[${color}m:status\x1b[0m :response-time ms - :res[content-length]\x1b[0m`);
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
