import { URL } from 'url';
import * as http from 'http';
import * as https from 'https';
import { Nullable, ObjMap } from '@thermopylae/core.declarations';
import { createException } from './exception';

interface HTTPPostData {
	'content-type': string;
	data: string | Buffer;
}

interface HTTPResponse {
	data: Nullable<string | ObjMap>;
	status: number;
	headers: http.IncomingHttpHeaders;
}

const enum ErrorCodes {
	NO_HTTP_STATUS_CODE = 'NO_HTTP_STATUS_CODE',
	NO_CONTENT_TYPE = 'NO_CONTENT_TYPE',
	REDIRECT_NOT_SUPPORTED = 'REDIRECT_NOT_SUPPORTED',
	UNSUPPORTED_CONTENT_TYPE = 'UNSUPPORTED_CONTENT_TYPE'
}

type HTTPRequestOpts = http.RequestOptions;
type HTTPRequest = (url: string | URL, options: HTTPRequestOpts, callback?: (res: http.IncomingMessage) => void) => http.ClientRequest;

type HTTPSRequestOpts = https.RequestOptions;
type HTTPSRequest = (url: string | URL, options: HTTPSRequestOpts, callback?: (res: http.IncomingMessage) => void) => http.ClientRequest;

type BodyParser = (body: string) => string | ObjMap;

const parsersRepo = new Map<string, BodyParser>();
parsersRepo.set('application/json', (body) => JSON.parse(body));
parsersRepo.set('text/plain', (body) => body);
parsersRepo.set('text/html', (body) => body);

/**
 * Extracts content type from `Content-Type` header.
 *
 * @private
 *
 * @param contentTypeHeaderValue	Value of the `Content-Type` header.
 *
 * @returns	Content type.
 */
function extractContentType(contentTypeHeaderValue: string): string {
	const contentTypeParts = contentTypeHeaderValue.split(';');
	return contentTypeParts[0];
}

/**
 * Parses the body of HTTP response.
 *
 * @private
 *
 * @param body			HTTP response body.
 * @param contentType	Value of the `Content-Type` header.
 *
 * @returns	Parsed body.
 */
function parseBody(body: string, contentType?: string): string | ObjMap {
	if (!contentType) {
		throw createException(ErrorCodes.NO_CONTENT_TYPE, `Content-Type not present for body: ${body}`);
	}

	const parser = parsersRepo.get(extractContentType(contentType));
	if (parser == null) {
		throw createException(ErrorCodes.UNSUPPORTED_CONTENT_TYPE, `Content-Type ${contentType} is not supported.`);
	}

	return parser.call(null, body);
}

/**
 * Makes a HTTP/HTTPS request.
 *
 * @private
 *
 * @param url			URL where request should be made.
 * @param requestImpl       NodeJs request object.
 * @param params        Request options.
 * @param [postData]    Data which needs to be sent in the request body.
 *
 * @returns HTTP response.
 */
function makeRequest(
	url: string | URL,
	requestImpl: HTTPRequest | HTTPSRequest,
	params: HTTPRequestOpts | HTTPSRequestOpts,
	postData?: HTTPPostData
): Promise<HTTPResponse> {
	// fixme careful, the actual lib.geoip highly depends on this API, i.e. positive => HTTPResponse with resolve, negative 400- => HTTPResponse with reject, other errors => Exception with reject

	return new Promise((resolve, reject) => {
		// eslint-disable-next-line consistent-return
		const req = requestImpl(url, params, (res: http.IncomingMessage): void => {
			// reject if no status code, WTF no status code
			if (!res.statusCode) {
				return reject(createException(ErrorCodes.NO_HTTP_STATUS_CODE, 'Status code not found'));
			}

			if (res.statusCode >= 300 && res.statusCode < 400) {
				return reject(createException(ErrorCodes.REDIRECT_NOT_SUPPORTED, res.statusCode.toString()));
			}

			// accumulate data
			const body = new Array<Buffer>();
			res.on('data', (chunk) => body.push(chunk));

			// resolve on end
			res.on('end', (): void => {
				const httpResponse: HTTPResponse = {
					status: res.statusCode!,
					headers: res.headers,
					data: body.length ? parseBody(Buffer.concat(body).toString(), res.headers['content-type']) : null
				};
				return res.statusCode! >= 400 ? reject(httpResponse) : resolve(httpResponse);
			});
		});

		if (postData) {
			req.setHeader('content-type', postData['content-type']);
			req.write(postData.data);
		}

		// reject on request error
		req.on('error', (err) => {
			// This is not a "Second reject", just a different sort of failure
			reject(err);
		});

		// IMPORTANT
		req.end();
	});
}

/**
 * Makes a HTTP request.
 *
 * @param url			URL where request should be made.
 * @param params        Request options.
 * @param [postData]    Data which needs to be sent in the request body.
 *
 * @returns HTTP response.
 */
function request(url: string | URL, params: HTTPRequestOpts, postData?: HTTPPostData): Promise<HTTPResponse> {
	return makeRequest(url, http.request, params, postData);
}

/**
 * Makes a HTTPS request.
 *
 * @param url			URL where request should be made.
 * @param params        Request options.
 * @param [postData]    Data which needs to be sent in the request body.
 *
 * @returns HTTP response.
 */
function requestSecure(url: string | URL, params: HTTPSRequestOpts, postData?: HTTPPostData): Promise<HTTPResponse> {
	return makeRequest(url, https.request, params, postData);
}

// eslint-disable-next-line no-undef
export { request, requestSecure, HTTPRequestOpts, HTTPSRequestOpts, HTTPPostData, HTTPResponse, ErrorCodes };
