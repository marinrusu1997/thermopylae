import { HTTPClient, HTTPResponse } from '../lib';

const enum ServiceFailureType {
	NETWORK,
	LIMIT_EXPIRED
}

class HttpClientMock implements HTTPClient {
	public static COUNTRY_CODES = {
		IP_STACK: 'IP_STACK',
		IP_LOCATE: 'IP_LOCATE'
	};

	public serviceFailures: {
		ipStack?: ServiceFailureType;
		ipLocate?: ServiceFailureType;
	} = {};

	public serviceCalls = {
		ipStack: 0,
		ipLocate: 0
	};

	public request(url: string): Promise<HTTPResponse> {
		return this.httpRequestImpl(url);
	}

	public secure(url: string): Promise<HTTPResponse> {
		return this.httpRequestImpl(url);
	}

	public resetServiceCalls(): void {
		this.serviceCalls.ipStack = 0;
		this.serviceCalls.ipLocate = 0;
	}

	private async httpRequestImpl(url: string): Promise<HTTPResponse> {
		const domainRegex = /^(?:https?:\/\/)?(?:[^@\n]+@)?(?:www\.)?([^:/\n?]+)/gim;
		const domain = domainRegex.exec(url)![1];

		switch (domain) {
			case 'api.ipstack.com':
				this.serviceCalls.ipStack += 1;

				if (this.serviceFailures.ipStack === ServiceFailureType.NETWORK) {
					throw new Error('Network error');
				}
				if (this.serviceFailures.ipStack === ServiceFailureType.LIMIT_EXPIRED) {
					// see https://ipstack.com/documentation
					return { status: 200, data: { success: false, error: { code: 104, type: 'monthly_limit_reached' } }, headers: {} };
				}

				// eslint-disable-next-line @typescript-eslint/camelcase
				return { status: 200, data: { country_code: HttpClientMock.COUNTRY_CODES.IP_STACK }, headers: {} };
			case 'iplocate.io':
				this.serviceCalls.ipLocate += 1;

				if (this.serviceFailures.ipLocate === ServiceFailureType.NETWORK) {
					throw new Error('Network error');
				}
				if (this.serviceFailures.ipLocate === ServiceFailureType.LIMIT_EXPIRED) {
					// eslint-disable-next-line no-throw-literal
					throw { status: 429, data: {}, headers: {} };
				}

				// eslint-disable-next-line @typescript-eslint/camelcase
				return { status: 200, data: { country_code: HttpClientMock.COUNTRY_CODES.IP_LOCATE }, headers: {} };
			default:
				throw new Error('Unknown domain for ip location service');
		}
	}
}

export { HttpClientMock, ServiceFailureType };
