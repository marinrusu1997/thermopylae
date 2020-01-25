import set from 'lodash.set';
import unless from 'express-unless';
import { resolveBasicOptions, tryToLogError } from '../commons';

function getDefaultFailureHandler(logger) {
	return async function onFailureHandler(err, status, res) {
		if (err && status === null) {
			// hard error
			tryToLogError(err, 'Authorization failed (non jwt related)', logger);
			res.status(500).send();
		} else if (err && status === false) {
			// token validation error
			tryToLogError(err, 'Authorization failed.', logger);
			res.status(403).send();
		} else {
			throw new Error('Invalid err & status parameters combination');
		}
	};
}

/**
 * Resolves options used by Express Jwt Authenticator Middleware
 *
 * @param {IExpressMiddlewareOpts}    opts  Options provided by client
 * @returns {IExpressMiddlewareOpts}        Resolved options
 */
function resolveMiddlewareOpts(opts) {
	const basicOpts = resolveBasicOptions(opts);
	return {
		...basicOpts,
		unless: opts && opts.unless,
		onFailure: (opts && opts.onFailure) || getDefaultFailureHandler(basicOpts.logger)
	};
}

function JwtAuthMiddleware(auth, opts) {
	const usedOpts = resolveMiddlewareOpts(opts);

	let middleware = async (req, res, next) => {
		const { verifyOptsProvider, extractor, attach, onFailure } = usedOpts;
		const token = extractor(req);
		if (!token) {
			await onFailure(new Error('Jwt not present in request.'), false, res);
			return;
		}
		try {
			const payload = await auth.validate(token, verifyOptsProvider ? verifyOptsProvider(req) : undefined);
			set(req, attach, payload);
			next();
		} catch (e) {
			await onFailure(e, false, res);
		}
	};

	if (usedOpts.unless) {
		middleware = unless(middleware, opts.unless);
	}

	return middleware;
}

export default {
	JwtAuthMiddleware,
	getDefaultFailureHandler
};
export { JwtAuthMiddleware, getDefaultFailureHandler };
