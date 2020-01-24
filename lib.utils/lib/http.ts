import { URL } from 'url';
import * as http from 'http';
import * as https from 'https';
import { createException } from './exception';
import { ErrorCodes } from './errors';

interface HTTPPostData {
	'content-type': string;
	data: string | Buffer;
}

interface HTTPResponse {
	data: string | object;
	status: number;
	headers: http.IncomingHttpHeaders;
}

type HTTPRequestOpts = http.RequestOptions;
type HTTPRequest = (url: string | URL, options: HTTPRequestOpts, callback?: (res: http.IncomingMessage) => void) => http.ClientRequest;

type HTTPSRequestOpts = https.RequestOptions;
type HTTPSRequest = (url: string | URL, options: HTTPSRequestOpts, callback?: (res: http.IncomingMessage) => void) => http.ClientRequest;

type BodyParser = (body: string) => any;

const parsersRepo = new Map<string, BodyParser>();
parsersRepo.set('application/json', body => JSON.parse(body));
parsersRepo.set('text/plain', body => body);

function extractContentType(contentTypeHeaderValue: string): string {
	const contentTypeParts = contentTypeHeaderValue.split(';');
	return contentTypeParts[0];
}

function parseBody(body: string, contentType?: string): any {
	if (!contentType) {
		return null;
	}
	// let it throw TypeError exception if parser for requested content type was not registered
	return parsersRepo.get(extractContentType(contentType))!.call(null, body);
}

/**
 * Makes a HTTP/HTTPS request
 *
 * @param {string|URL}										url				URL where request should be made
 * @param {HTTPRequest|HTTPSRequest}						request         NodeJs request object
 * @param {HTTPRequestOpts|HTTPSRequestOpts}  		params          Request options
 * @param {HTTPPostData}          								[postData]      Data which needs to be sent in the request body
 *
 * @returns {Promise<string| object>}
 */
function makeRequest(url: string | URL, request: HTTPRequest | HTTPSRequest, params: HTTPRequestOpts | HTTPSRequestOpts, postData?: HTTPPostData): Promise<HTTPResponse> {
	// fixme careful, the actual lib.geoip highly depends on this API, i.e. positive => HTTPResponse with resolve, negative 400- => HTTPResponse with reject, other errors => Exception with reject

	return new Promise((resolve, reject) => {
		// eslint-disable-next-line consistent-return
		const req = request(url, params, (res: http.IncomingMessage): void => {
			// reject if no status code, WTF no status code
			if (!res.statusCode) {
				return reject(createException(ErrorCodes.NOT_FOUND, 'Status code not found'));
			}

			// redirection is not supported :(
			if (res.statusCode >= 300 && res.statusCode < 400) {
				return reject(createException(ErrorCodes.NOT_SUPPORTED, res.statusCode.toString()));
			}

			// accumulate data
			const body: any[] = [];
			res.on('data', chunk => body.push(chunk));

			// resolve on end
			res.on('end', (): void => {
				const httpResponse: HTTPResponse = {
					status: res.statusCode!,
					headers: res.headers,
					data: parseBody(Buffer.concat(body).toString(), res.headers['content-type'])
				};
				return res.statusCode! >= 400 ? reject(httpResponse) : resolve(httpResponse);
			});
		});

		if (postData) {
			req.setHeader('content-type', postData['content-type']);
			req.write(postData.data);
		}

		// reject on request error
		req.on('error', err => {
			// This is not a "Second reject", just a different sort of failure
			reject(err);
		});

		// IMPORTANT
		req.end();
	});
}

/**
 * Makes a HTTP request
 *
 * @param {string|URL}			url				URL where request should be made
 * @param {HTTPRequestOpts} params          Request options
 * @param {HTTPPostData}          	[postData]      Data which needs to be sent in the request body
 *
 * @returns {Promise<string| object>}
 */
function makeHTTPRequest(url: string | URL, params: HTTPRequestOpts, postData?: HTTPPostData): Promise<HTTPResponse> {
	return makeRequest(url, http.request, params, postData);
}

/**
 * Makes a HTTPS request
 *
 * @param {string|URL}				url			URL where request should be made
 * @param {HTTPSRequestOpts}	params  	Request options
 * @param {HTTPPostData}				[postData]	Data which needs to be sent in the request body
 *
 * @returns {Promise<string|object>}
 */
function makeHTTPSRequest(url: string | URL, params: HTTPSRequestOpts, postData?: HTTPPostData): Promise<HTTPResponse> {
	return makeRequest(url, https.request, params, postData);
}

// eslint-disable-next-line no-undef
export { makeHTTPRequest, makeHTTPSRequest, HTTPRequestOpts, HTTPSRequestOpts, HTTPPostData, HTTPResponse };
