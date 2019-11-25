import { Strategy } from 'passport-custom';
import set from 'lodash.set';
import { resolveBasicOptions, tryToLogError } from '../commons';

function Authenticator(auth, opts) {
	const usedOpts = resolveBasicOptions(opts);

	return function validate(req, done) {
		const { verifyOptsProvider, extractor, attach, logger } = usedOpts;
		const token = extractor(req);
		if (!token) {
			done(new Error('Jwt not present in request'));
			return;
		}
		auth.validate(token, verifyOptsProvider ? verifyOptsProvider(req) : undefined)
			.then(jwtPayload => {
				set(req, attach, jwtPayload);
				done(null, jwtPayload);
			})
			.catch(err => {
				tryToLogError(err, `Request: ${JSON.stringify(req)}`, logger);
				done(null, false, { message: 'Invalid token' });
			});
	};
}

function JwtStrategy(auth, opts) {
	return new Strategy(Authenticator(auth, opts));
}

export default JwtStrategy;
export { JwtStrategy, Authenticator };
