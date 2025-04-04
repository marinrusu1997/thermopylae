import { ExpressRequestAdapter, ExpressResponseAdapter, LOCATION_SYM } from '@thermopylae/core.adapter.express';
import { type HTTPRequestLocation, HttpStatusCode } from '@thermopylae/core.declarations';
import type { UserSessionDevice } from '@thermopylae/core.user-session.commons';
import { logger } from '@thermopylae/dev.unit-test';
import type { UserSessionMetaData } from '@thermopylae/lib.user-session.commons';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import express from 'express';
import handler from 'express-async-handler';
// @ts-ignore
import addRequestId from 'express-request-id';
import morgan, { type FormatFn } from 'morgan';
import { middleware } from './middleware.js';
import { routes } from './routes.js';

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

	// @ts-ignore Typings are not correct, we are hacking here
	let fn = morganFormat[color];

	if (!fn) {
		// @ts-ignore Typings are not correct, we are hacking here
		fn = morganFormat[color] = morgan.compile(`:id \x1b[0m:method :url \x1b[${color}m:status\x1b[0m :response-time ms - :res[content-length]\x1b[0m`);
	}

	return fn(tokens, req, res);
};

const app = express();
app.set('trust proxy', true);
app.use(bodyParser.json());
app.use(cookieParser());
app.use(
	addRequestId({
		setHeader: false
	})
);
app.use(
	morgan(morganFormat, {
		stream: {
			write(str) {
				logger.debug(str);
			}
		}
	})
);

app[routes.login.method](
	routes.login.path,
	handler(async (req, res) => {
		const request = new ExpressRequestAdapter(req);
		const response = new ExpressResponseAdapter(res);

		if (request.query('location') === '1') {
			(req as any)[LOCATION_SYM] = {
				countryCode: 'RO',
				regionCode: null,
				city: 'Bucharest',
				latitude: 15.6,
				longitude: null,
				timezone: null
			};
		}

		try {
			await middleware.create(request, response, 'uid1');
			response.status(HttpStatusCode.Created).send();
		} catch (e) {
			logger.error(`ERROR ${routes.login.method} ${routes.login.path}`, e);
			response.status(HttpStatusCode.BadRequest).send({ message: e.message });
		}
	})
);

app[routes.get_resource.method](
	routes.get_resource.path,
	handler(async (req, res) => {
		const request = new ExpressRequestAdapter(req);
		const response = new ExpressResponseAdapter(res);

		try {
			const userSessionMetaData = await middleware.verify(request, response, request.query('uid') as string);
			response.status(HttpStatusCode.Ok).send(userSessionMetaData);
		} catch (e) {
			logger.error(`ERROR ${routes.get_resource.method} ${routes.get_resource.path}`, e);
			response.status(HttpStatusCode.Forbidden).send({ message: e.message });
		}
	})
);

type GetActiveSessionsBody = Record<string, UserSessionMetaData<UserSessionDevice, HTTPRequestLocation>>;

app[routes.get_active_sessions.method](
	routes.get_active_sessions.path,
	handler(async (req, res) => {
		const request = new ExpressRequestAdapter(req);
		const response = new ExpressResponseAdapter(res);

		const subject = request.query('uid')!;
		const activeSessions = await middleware.userSessionManager.readAll(subject);
		response.send(Object.fromEntries(activeSessions));
	})
);

app[routes.renew_session.method](
	routes.renew_session.path,
	handler(async (req, res) => {
		const request = new ExpressRequestAdapter(req);
		const response = new ExpressResponseAdapter(res);

		try {
			const subject = request.query('uid')!;
			const userSessionMetaData = await middleware.verify(request, response, subject);
			await middleware.renew(request, response, subject, userSessionMetaData);
			response.status(HttpStatusCode.Ok).send();
		} catch (e) {
			logger.error(`ERROR ${routes.renew_session.method} ${routes.renew_session.path}`, e);
			response.status(HttpStatusCode.NotFound).send({ message: e.message });
		}
	})
);

app[routes.logout.method](
	routes.logout.path,
	handler(async (req, res) => {
		const request = new ExpressRequestAdapter(req);
		const response = new ExpressResponseAdapter(res);

		try {
			await middleware.delete(request, response, request.query('uid')!, null, true);
			response.status(HttpStatusCode.Ok).send();
		} catch (e) {
			logger.error(`ERROR ${routes.logout.method} ${routes.logout.path}`, e);
			response.status(HttpStatusCode.NotFound).send({ message: e.message });
		}
	})
);

export { app };
export type { GetActiveSessionsBody };
