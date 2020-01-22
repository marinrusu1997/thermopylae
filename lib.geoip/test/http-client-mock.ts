import { HTTPClient, HTTPResponse } from '../lib';

class HttpClientMock implements HTTPClient {
	// eslint-disable-next-line class-methods-use-this,@typescript-eslint/no-unused-vars,@typescript-eslint/ban-ts-ignore
	// @ts-ignore
	// eslint-disable-next-line class-methods-use-this
	request(url: string, params: { method: string }): Promise<HTTPResponse> {
		throw new Error('NOT IMPL');
	}

	// eslint-disable-next-line class-methods-use-this,@typescript-eslint/no-unused-vars,@typescript-eslint/ban-ts-ignore
	// @ts-ignore
	// eslint-disable-next-line class-methods-use-this
	secure(url: string, params: { method: string }): Promise<HTTPResponse> {
		throw new Error('NOT IMPL');
	}
}

export { HttpClientMock };
