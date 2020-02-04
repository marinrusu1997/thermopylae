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

function UserServiceAboutMiddlewareFactory(): Array<RequestHandler> {
	return [
		(req, res) => {
			res.status(HttpStatusCode.BAD_REQUEST).json(req.query);
		}
	];
}

function UserServiceDeleteMiddlewareFactory(): Array<RequestHandler> {
	return [
		(req, res) => {
			// @ts-ignore
			if (req.pipeline.jwtPayload.aud !== AccountRole.ADMIN) {
				res.status(HttpStatusCode.FORBIDDEN).json(req.query);
			} else {
				res.status(HttpStatusCode.OK).json(req.query);
			}
		}
	];
}

export {
	UserServiceCreateMiddlewareFactory,
	UserServiceReadMiddlewareFactory,
	UserServiceUpdateMiddlewareFactory,
	UserServiceAboutMiddlewareFactory,
	UserServiceDeleteMiddlewareFactory,
	User
};
