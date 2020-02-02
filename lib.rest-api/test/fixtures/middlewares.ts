import { RequestHandler } from 'express';
import { HttpStatusCode } from '@marin/lib.utils/dist/declarations';
import { AccountRole } from './jwt';

interface User {
	name: string;
	surname: string;
	age: string;
}

function UserServiceCreateMiddlewareFactory(): Array<RequestHandler> {
	return [
		(req, res): void => {
			res.status(HttpStatusCode.OK).json(req.body);
		}
	];
}

function UserServiceReadMiddlewareFactory(): Array<RequestHandler> {
	return [
		(_req, _res, next) => next(),
		(req, res) => {
			const user: User = {
				name: 'John',
				surname: 'Dee',
				age: req.params.age
			};
			res.json(user);
		}
	];
}

function UserServiceReadAllMiddlewareFactory(): Array<RequestHandler> {
	return [
		(_req, _res, next) => next(),
		(req, res) => {
			const user: User = {
				name: 'John',
				surname: 'Dee',
				age: req.params.age
			};
			res.json([user, user]);
		}
	];
}

function UserServiceEnableMiddlewareFactory(): Array<RequestHandler> {
	return [
		(req, res) => {
			res.status(HttpStatusCode.BAD_REQUEST).send(req.body);
		}
	];
}

function UserServiceDeleteMiddlewareFactory(): Array<RequestHandler> {
	return [
		(req, res) => {
			// @ts-ignore
			if (req.pipeline.jwtPayload.aud !== AccountRole.ADMIN) {
				res.status(HttpStatusCode.FORBIDDEN).send(req.params);
			} else {
				res.status(HttpStatusCode.OK).send(req.params);
			}
		}
	];
}

export {
	UserServiceCreateMiddlewareFactory,
	UserServiceReadMiddlewareFactory,
	UserServiceReadAllMiddlewareFactory,
	UserServiceEnableMiddlewareFactory,
	UserServiceDeleteMiddlewareFactory,
	User
};
