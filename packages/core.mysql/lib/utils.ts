// eslint-disable-next-line import/extensions
import { Connection, Field, QueryError } from 'mysql2/promise';
import { logger } from './logger';

/**
 * @private
 */
function mysqlErrorHandler(error: QueryError): void {
	logger.error(`Connection Error: ${formatMySqlError(error)}`, error);
}

/**
 * Format connection details.
 *
 * @private
 *
 * @param connection 	MySQL connection.
 *
 * @returns		Formatted string.
 */
function formatConnectionDetails(connection: Connection): string {
	return `Connection: Id ${connection.threadId}; Host ${connection.config.host || connection.config.socketPath}; Port ${connection.config.port}; User ${
		connection.config.user
	}; Database ${connection.config.database}. `;
}

/**
 * Format MySQL error.
 *
 * @param error		MySQL error.
 *
 * @returns		Formatted string.
 */
function formatMySqlError(error: QueryError): string {
	return `Code: ${error.code}; Errno: ${error.errno}; Message: ${error.message}; Sql state marker: ${error.sqlStateMarker}; Sql state: ${error.sqlState}; Field count: ${error.fieldCount}; Fatal: ${error.fatal}.`;
}

/**
 * Casts fields of type *TINY* to boolean.
 *
 * @param field		Field.
 * @param next		Next processor.
 *
 * @returns		Boolean value.
 */
function typeCastBooleans(field: Field, next: () => boolean): boolean {
	if (field.type === 'TINY' && field.length === 1) {
		return field.string() === '1'; // 1 = true, 0 = false
	}
	return next();
}

export { mysqlErrorHandler, formatMySqlError, formatConnectionDetails, typeCastBooleans };
