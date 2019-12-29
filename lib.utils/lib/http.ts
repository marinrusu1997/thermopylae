import { URL } from 'url';
import * as http from 'http';
import * as https from 'https';
import { createException } from './exception';
import { ErrorCodes } from './errors';

interface PostData {
	'content-type': string;
	data: string | Buffer;
}

type HTTPRequest = (url: string | URL, options: http.RequestOptions, callback?: (res: http.IncomingMessage) => void) => http.ClientRequest;
type HTTPSRequest = (url: string | URL, options: https.RequestOptions, callback?: (res: http.IncomingMessage) => void) => http.ClientRequest;
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
 * @param {http.RequestOptions|https.RequestOptions}  		params          Request options
 * @param {PostData}          								[postData]      Data which needs to be sent in the request body
 *
 * @returns {Promise<string| object>}
 */
function makeRequest(
	url: string | URL,
	request: HTTPRequest | HTTPSRequest,
	params: http.RequestOptions | https.RequestOptions,
	postData?: PostData
): Promise<string | any> {
	return new Promise((resolve, reject) => {
		// eslint-disable-next-line consistent-return
		const req = request(url, params, (res: http.IncomingMessage): void => {
			// reject if no status code, WTF no status code
			/* istanbul ignore if */
			if (!res.statusCode) {
				return reject(createException(ErrorCodes.NOT_FOUND, 'Status code not found'));
			}

			if (res.statusCode < 200 || (res.statusCode >= 300 && res.statusCode < 400)) {
				return reject(createException(ErrorCodes.NOT_SUPPORTED, res.statusCode.toString()));
			}

			// cumulate data
			const body: any[] = [];
			res.on('data', chunk => body.push(chunk));

			// resolve on end
			res.on('end', (): void => {
				const parsedBody = parseBody(Buffer.concat(body).toString(), res.headers['content-type']);
				// reject on bad status
				if (res.statusCode! >= 400) {
					return reject(createException(ErrorCodes.REQUEST_FAILED, `statusCode: ${res.statusCode}`, parsedBody));
				}
				return resolve(parsedBody);
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
 * @param {http.RequestOptions} params          Request options
 * @param {PostData}          	[postData]      Data which needs to be sent in the request body
 *
 * @returns {Promise<string| object>}
 */
function makeHTTPRequest(url: string | URL, params: http.RequestOptions, postData?: PostData): Promise<string | any> {
	return makeRequest(url, http.request, params, postData);
}

/**
 * Makes a HTTPS request
 *
 * @param {string|URL}				url			URL where request should be made
 * @param {https.RequestOptions}	params  	Request options
 * @param {PostData}				[postData]	Data which needs to be sent in the request body
 *
 * @returns {Promise<string|object>}
 */
function makeHTTPSRequest(url: string | URL, params: https.RequestOptions, postData?: PostData): Promise<string | any> {
	return makeRequest(url, https.request, params, postData);
}

export { makeHTTPRequest, makeHTTPSRequest };
