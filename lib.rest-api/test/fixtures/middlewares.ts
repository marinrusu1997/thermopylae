import { RequestHandler } from 'express';
import { HttpStatusCode } from '@marin/lib.utils/dist/declarations';
import { AccountRole } from './jwt';

interface User {
	name: string;
	surname: string;
	age: string;
	birth?: string;
	address?: string;
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
		(req, _res, next) => {
			req.params.birth = 'yesterday';
			next();
		},
		(req, res) => {
			const user: User = {
				name: 'John',
				surname: 'Dee',
				age: req.query.age,
				birth: req.params.birth
			};
			res.json(user);
		}
	];
}

function UserServiceUpdateMiddlewareFactory(): Array<RequestHandler> {
	return [
		(req, _res, next) => {
			req.query.address = 'New York';
			next();
		},
		(req, res) => {
			const user: User = {
				name: 'John',
				surname: 'Dee',
				age: req.params.age,
				birth: req.params.birth,
				address: req.query.address
			};
			res.json(user);
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
	UserServiceUpdateMiddlewareFactory,
	UserServiceEnableMiddlewareFactory,
	UserServiceDeleteMiddlewareFactory,
	User
};
