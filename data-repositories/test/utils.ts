import { expect } from 'chai';
import { MySqlClientInstance, queryAsync } from '@marin/lib.data-access';

async function checkSQLStoredResourcesNo(tableName: string, expectedNo: number): Promise<void> {
	expect((await queryAsync(MySqlClientInstance.readPool, `SELECT COUNT(*) as row_count FROM ${tableName};`)).results[0].row_count).to.be.eq(expectedNo);
}

export { checkSQLStoredResourcesNo };
