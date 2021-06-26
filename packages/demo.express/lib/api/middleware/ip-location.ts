import { RequestHandler } from 'express';
import { LOCATION_SYM } from '@thermopylae/core.adapter.express';
import { PartialSome, MutableSome } from '@thermopylae/core.declarations';
import { IpLocation } from '@thermopylae/lib.geoip';
import { logger } from '../../logger';
import { GEOIP_LOCATOR } from '../../app/singletons';

const ipLocation: RequestHandler = async (req, _res, next) => {
	try {
		const location = await GEOIP_LOCATOR.locate(req.ip);
		if (location != null) {
			delete (location as MutableSome<PartialSome<IpLocation, 'REPOSITORY_ID'>, 'REPOSITORY_ID'>).REPOSITORY_ID;
			(req as any)[LOCATION_SYM] = location;
		}
	} catch (e) {
		logger.error(`Failed to retrieve location for ip ${req.ip}.`, e);
	} finally {
		next();
	}
};

export { ipLocation };
