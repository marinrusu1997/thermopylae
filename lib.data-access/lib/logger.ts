import LoggerInstance, { WinstonLogger } from '@marin/lib.logger';
import { Clients } from '@marin/lib.utils/dist/declarations';

let redisLogger: WinstonLogger | undefined;
let mysqlLogger: WinstonLogger | undefined;

function getLogger(_for: Clients): WinstonLogger {
	switch (_for) {
		case Clients.REDIS:
			if (!redisLogger) {
				redisLogger = LoggerInstance.for(_for);
			}
			return redisLogger;
		case Clients.MYSQL:
			if (!mysqlLogger) {
				mysqlLogger = LoggerInstance.for(_for);
			}
			return mysqlLogger;
		default:
			throw new Error(`Misconfiguration. No logger exists for ${_for}.`);
	}
}

export { getLogger };
