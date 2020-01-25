function extractJWT(req) {
	if (
		(req.headers.authorization && req.headers.authorization.split(' ')[0] === 'Token') ||
		(req.headers.authorization && req.headers.authorization.split(' ')[0] === 'Bearer')
	) {
		const jwt = req.headers.authorization.split(' ')[1];
		return jwt || null;
	}
	if (req.query && req.query.jwt) {
		return req.query.jwt;
	}
	if (req.body && req.body.jwt) {
		return req.body.jwt;
	}
	if (req.cookies && req.cookies.jwt) {
		return req.cookies.jwt;
	}
	return null;
}

function resolveBasicOptions(opts) {
	return {
		verifyOptsProvider: opts && opts.verifyOptsProvider,
		extractor: (opts && opts.extractor) || extractJWT,
		attach: (opts && opts.attach) || 'jwtPayload',
		logger: opts && opts.logger
	};
}

function tryToLogError(err, msg, logger) {
	if (logger) {
		try {
			logger.error(msg, err);
			// eslint-disable-next-line no-empty
		} catch (e) {}
	}
}

export default {
	extractJWT,
	resolveBasicOptions,
	tryToLogError
};
export { extractJWT, resolveBasicOptions, tryToLogError };
