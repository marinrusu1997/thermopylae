import LoggerInstance, { WinstonLogger } from '@marin/lib.logger';
import { Modules } from '@marin/declarations/lib/modules';

let redisLogger: WinstonLogger | undefined;
let mysqlLogger: WinstonLogger | undefined;

function getLogger(_for: Modules): WinstonLogger {
	switch (_for) {
		case Modules.REDIS_CLIENT:
			if (!redisLogger) {
				redisLogger = LoggerInstance.for(_for);
			}
			return redisLogger;
		case Modules.MYSQL_CLIENT:
			if (!mysqlLogger) {
				mysqlLogger = LoggerInstance.for(_for);
			}
			return mysqlLogger;
		default:
			throw new Error(`Misconfiguration. No logger exists for ${_for}.`);
	}
}

export { getLogger };
