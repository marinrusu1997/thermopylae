import { type AdaptedExpressRequest, LOCATION_SYM } from '@thermopylae/core.adapter.express';
import type { MutableSome, PartialSome } from '@thermopylae/core.declarations';
import type { IpLocation } from '@thermopylae/lib.geoip';
import type { NextFunction, RequestHandler, Response } from 'express';
import { GEOIP_LOCATOR } from '../../app/singletons.js';
import { logger } from '../../logger.js';

const ipLocation: RequestHandler = async (req: AdaptedExpressRequest, _res: Response, next: NextFunction) => {
	try {
		const location = await GEOIP_LOCATOR.locate(req.ip ?? '');
		if (location != null) {
			delete (location as MutableSome<PartialSome<IpLocation, 'REPOSITORY_ID'>, 'REPOSITORY_ID'>).REPOSITORY_ID;
			req[LOCATION_SYM] = location;
		}
	} catch (e) {
		logger.error(`Failed to retrieve location for ip ${req.ip}.`, e);
	} finally {
		next();
	}
};

export { ipLocation };
