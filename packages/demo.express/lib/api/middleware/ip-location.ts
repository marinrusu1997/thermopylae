import { RequestHandler } from 'express';
import { LOCATION_SYM } from '@thermopylae/core.adapter.express';
import { logger } from '../../logger';
import { GEOIP_LOCATOR } from '../../app/singletons';

const ipLocation: RequestHandler = async (req, _res, next) => {
	try {
		const location = await GEOIP_LOCATOR.locate(req.ip);
		if (location != null) {
			(req as any)[LOCATION_SYM] = location;
		}
	} catch (e) {
		logger.error(`Failed to retrieve location for ip ${req.ip}.`, e);
	} finally {
		next();
	}
};

export { ipLocation };
