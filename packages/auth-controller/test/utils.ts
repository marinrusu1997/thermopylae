import { HttpStatusCode } from '@marin/lib.utils/dist/declarations';
import { expect } from 'chai';
import { ResponseMock } from './mocks/response';

interface ExpectedMethodInvocation<T> {
	called: boolean;
	with?: T;
}

function checkHttpResponse(
	responseMock: ResponseMock,
	status: ExpectedMethodInvocation<HttpStatusCode> = { called: false },
	json: ExpectedMethodInvocation<any> = { called: false },
	send: ExpectedMethodInvocation<any> = { called: false }
): void {
	if (status.called) {
		expect(responseMock.getStatus()).to.be.deep.eq(status.with);
	} else {
		expect(() => responseMock.getStatus()).to.throw('status method not called only once');
	}

	if (json.called) {
		expect(responseMock.getJson()).to.be.deep.eq(json.with);
	} else {
		expect(() => responseMock.getJson()).to.throw('json method not called only once');
	}

	if (send.called) {
		expect(responseMock.getSend()).to.be.deep.eq(send.with);
	} else {
		expect(() => responseMock.getSend()).to.throw('send method not called only once');
	}
}

export { ExpectedMethodInvocation, checkHttpResponse };
