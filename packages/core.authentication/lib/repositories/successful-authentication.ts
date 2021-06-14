import type { SuccessfulAuthenticationModel, SuccessfulAuthenticationsRepository } from '@thermopylae/lib.authentication';
import type { HttpDevice, UnixTimestamp } from '@thermopylae/core.declarations';
import { MySqlClientInstance, QueryType, ResultSetHeader, RowDataPacket } from '@thermopylae/core.mysql';
import stringify from 'fast-json-stable-stringify';
import farmhash from 'farmhash';
import { TableNames } from './constants';

class SuccessfulAuthenticationsMysqlRepository implements SuccessfulAuthenticationsRepository {
	public async insert(authentication: SuccessfulAuthenticationModel): Promise<void> {
		const connection = await MySqlClientInstance.getConnection(QueryType.WRITE);

		try {
			let deviceHash: string | null = null;

			if (authentication.device) {
				const deviceJsonString = stringify(authentication.device);
				deviceHash = farmhash.hash64(deviceJsonString);

				await connection.query(
					`INSERT INTO ${TableNames.Device} (id, json) VALUES ('${deviceHash}', '${deviceJsonString}')  ON DUPLICATE KEY UPDATE json='${deviceJsonString}';`
				);
			}

			const [results] = await connection.query<ResultSetHeader>(
				`INSERT INTO ${TableNames.SuccessfulAuthentication} (accountId, ip, deviceId, location, authenticatedAt) VALUES (${authentication.accountId}, '${authentication.ip}', ?, ?, ${authentication.authenticatedAt});`,
				[deviceHash, authentication.location ? JSON.stringify(authentication.location) : authentication.location]
			);

			authentication.id = String(results.insertId);
		} finally {
			connection.release();
		}
	}

	public async authBeforeFromThisDevice(accountId: string, device: HttpDevice): Promise<boolean> {
		const deviceJsonString = stringify(device);
		const deviceHash = farmhash.hash64(deviceJsonString);

		const connection = await MySqlClientInstance.getConnection(QueryType.READ);
		try {
			const [results] = await connection.query<RowDataPacket[]>(
				`SELECT EXISTS(SELECT * FROM ${TableNames.SuccessfulAuthentication} WHERE accountId=${accountId} AND deviceId='${deviceHash}') AS found;`
			);

			if (results.length !== 1) {
				return false;
			}

			return results[0]['found'] === 1;
		} finally {
			connection.release();
		}
	}

	public async readRange(accountId: string, startingFrom?: UnixTimestamp, endingTo?: UnixTimestamp): Promise<Array<SuccessfulAuthenticationModel>> {
		let sql = `SELECT sa.id, sa.accountId, sa.ip, ad.json AS device, sa.location, sa.authenticatedAt FROM ${
			TableNames.SuccessfulAuthentication
		} sa LEFT JOIN ${TableNames.Device} ad ON sa.deviceId = ad.id WHERE sa.accountId = ${MySqlClientInstance.escape(accountId)}`;

		if (startingFrom) {
			sql += ` AND sa.authenticatedAt >= ${startingFrom}`;
		}
		if (endingTo) {
			sql += ` AND sa.authenticatedAt <= ${endingTo}`;
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

			return results as SuccessfulAuthenticationModel[];
		} finally {
			connection.release();
		}
	}
}

export { SuccessfulAuthenticationsMysqlRepository };
