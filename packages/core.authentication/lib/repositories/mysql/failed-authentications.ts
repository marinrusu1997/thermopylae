import type { UnixTimestamp } from '@thermopylae/core.declarations';
import { MySqlClientInstance, QueryType, type ResultSetHeader, type RowDataPacket } from '@thermopylae/core.mysql';
import type { FailedAuthenticationAttemptsRepository, FailedAuthenticationModel } from '@thermopylae/lib.authentication';
import farmhash from 'farmhash';
import stringify from 'fast-json-stable-stringify';
import { TableNames } from '../constants.js';

class FailedAuthenticationsMysqlRepository implements FailedAuthenticationAttemptsRepository {
	public async insert(authentication: FailedAuthenticationModel): Promise<void> {
		const connection = await MySqlClientInstance.getConnection(QueryType.WRITE);

		try {
			let deviceHash: string | null = null;

			if (authentication.device) {
				const deviceJsonString = stringify(authentication.device);
				deviceHash = farmhash.hash64(deviceJsonString).toString();

				await connection.query(
					`INSERT INTO ${TableNames.Device} (id, json) VALUES ('${deviceHash}', '${deviceJsonString}')  ON DUPLICATE KEY UPDATE json='${deviceJsonString}';`
				);
			}

			const [results] = await connection.query<ResultSetHeader>(
				`INSERT INTO ${TableNames.FailedAuthentication} (accountId, ip, deviceId, location, detectedAt) VALUES (${authentication.accountId}, '${authentication.ip}', ?, ?, ${authentication.detectedAt});`,
				[deviceHash, authentication.location ? JSON.stringify(authentication.location) : authentication.location]
			);

			authentication.id = String(results.insertId);
		} finally {
			connection.release();
		}
	}

	public async readRange(accountId: string, startingFrom?: UnixTimestamp, endingTo?: UnixTimestamp): Promise<Array<FailedAuthenticationModel>> {
		let sql = `SELECT fa.id, fa.accountId, fa.ip, ad.json AS device, fa.location, fa.detectedAt FROM ${TableNames.FailedAuthentication} fa LEFT JOIN ${
			TableNames.Device
		} ad ON fa.deviceId = ad.id WHERE fa.accountId = ${MySqlClientInstance.escape(accountId)}`;

		if (startingFrom) {
			sql += ` AND fa.detectedAt >= ${startingFrom}`;
		}
		if (endingTo) {
			sql += ` AND fa.detectedAt <= ${endingTo}`;
		}
		sql += ';';

		const connection = await MySqlClientInstance.getConnection(QueryType.READ);
		try {
			const [results] = await connection.query<RowDataPacket[]>(sql);

			let i = results.length;
			while (i--) {
				results[i]['id'] = String(results[i]['id']);
				results[i]['accountId'] = String(results[i]['accountId']);
				results[i]['device'] = JSON.parse(results[i]['device']);
				results[i]['location'] = JSON.parse(results[i]['location']);
			}

			return results as FailedAuthenticationModel[];
		} finally {
			connection.release();
		}
	}
}

export { FailedAuthenticationsMysqlRepository };
