// eslint-disable-next-line import/no-unresolved
import { Response } from 'express';

// @ts-ignore
class ResponseMock implements Response {
	// eslint-disable-next-lin no-underscore-dangle
	private _status: number | undefined;

	// eslint-disable-next-lin no-underscore-dangle
	private _statusCalled = 0;

	// eslint-disable-next-line no-underscore-dangle
	private _json: object | undefined;

	// eslint-disable-next-line no-underscore-dangle
	private _jsonCalled = 0;

	private _sendCalled = 0;

	private _send: any;

	status(httpStatus: number): this {
		// eslint-disable-next-line no-underscore-dangle
		this._status = httpStatus;
		// eslint-disable-next-line no-underscore-dangle
		this._statusCalled += 1;
		return this;
	}

	json(obj: object): this {
		// eslint-disable-next-line no-underscore-dangle
		this._json = obj;
		// eslint-disable-next-line no-underscore-dangle
		this._jsonCalled += 1;
		return this;
	}

	send(data: any): this {
		// eslint-disable-next-line no-underscore-dangle
		this._send = data;
		// eslint-disable-next-line no-underscore-dangle
		this._sendCalled += 1;
		return this;
	}

	getStatus(): number | undefined {
		// eslint-disable-next-line no-underscore-dangle
		if (this._statusCalled !== 1) {
			throw new Error('status method not called only once');
		}
		// eslint-disable-next-line no-underscore-dangle
		return this._status;
	}

	getJson(): object | undefined {
		// eslint-disable-next-line no-underscore-dangle
		if (this._jsonCalled !== 1) {
			throw new Error('json method not called only once');
		}
		// eslint-disable-next-line no-underscore-dangle
		return this._json;
	}

	getSend(): any {
		// eslint-disable-next-line no-underscore-dangle
		if (this._sendCalled !== 1) {
			throw new Error('send method not called only once');
		}
		// eslint-disable-next-line no-underscore-dangle
		return this._send;
	}
}

export { ResponseMock };
