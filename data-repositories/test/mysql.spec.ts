import { describe, it } from 'mocha';
import { expect } from 'chai';
import { chrono } from '@marin/lib.utils';
import { MySqlClientInstance } from '../lib';

describe.skip('mysql spec', () => {
	const mySqlIp = '127.0.0.1';
	const mySqlPort = 3306;

	it('connects to mysql with a pool config', async () => {
		MySqlClientInstance.init({
			pool: {
				host: mySqlIp,
				port: mySqlPort,
				user: 'root',
				password: 'secret',
				connectionLimit: 2
			},
			sessionVariablesQueries: ['SET SESSION auto_increment_increment=1;']
		});

		function doQueries(): void {
			for (let i = 0; i < 5; i++) {
				MySqlClientInstance.readPool.query('SELECT 1+1 AS solution;', (error, results) => {
					if (error) {
						console.warn(error);
					} else {
						expect(results[0].solution).to.be.eq(2);
					}
				});
			}
		}

		doQueries();

		setTimeout(doQueries, 60000);
		setTimeout(doQueries, 120000);

		await chrono.sleep(125000);
		await MySqlClientInstance.shutdown();
	}).timeout(126000);

	it('connects to mysql with a cluster config', async () => {
		MySqlClientInstance.init({
			poolCluster: {
				cluster: {
					removeNodeErrorCount: 3
				},
				pools: {
					MASTER: {
						host: mySqlIp,
						port: mySqlPort,
						user: 'root',
						password: 'secret',
						connectionLimit: 2
					},
					'SLAVE-1': {
						host: mySqlIp,
						port: mySqlPort,
						user: 'root',
						password: 'secret',
						connectionLimit: 2
					},
					'SLAVE-2': {
						host: mySqlIp,
						port: mySqlPort,
						user: 'root',
						password: 'secret',
						connectionLimit: 2
					}
				}
			},
			sessionVariablesQueries: ['SET SESSION auto_increment_increment=1;']
		});

		MySqlClientInstance.init({
			poolCluster: {
				cluster: {
					removeNodeErrorCount: 3
				},
				pools: {
					MASTER: {
						host: mySqlIp,
						port: mySqlPort,
						user: 'root',
						password: 'secret',
						connectionLimit: 2
					},
					'SLAVE-1': {
						host: mySqlIp,
						port: mySqlPort,
						user: 'root',
						password: 'secret',
						connectionLimit: 2
					},
					'SLAVE-2': {
						host: mySqlIp,
						port: mySqlPort,
						user: 'root',
						password: 'secret',
						connectionLimit: 2
					}
				}
			},
			sessionVariablesQueries: ['SET SESSION auto_increment_increment=1;']
		}); // should have no effect

		function doQueries(): void {
			for (let i = 0; i < 5; i++) {
				MySqlClientInstance.readPool.query('SELECT 1+1 AS solution;', (error, results) => {
					if (error) {
						console.warn('Query level error', error);
					} else {
						expect(results[0].solution).to.be.eq(2);
					}
				});
			}
		}

		doQueries();

		await chrono.sleep(3000);
		await MySqlClientInstance.shutdown();
		MySqlClientInstance.init({
			poolCluster: {
				cluster: {
					removeNodeErrorCount: 3
				},
				pools: {
					MASTER: {
						host: mySqlIp,
						port: mySqlPort,
						user: 'root',
						password: 'secret',
						connectionLimit: 2
					},
					'SLAVE-1': {
						host: mySqlIp,
						port: mySqlPort,
						user: 'root',
						password: 'secret',
						connectionLimit: 2
					},
					'SLAVE-2': {
						host: mySqlIp,
						port: mySqlPort,
						user: 'root',
						password: 'secret',
						connectionLimit: 2
					}
				}
			},
			sessionVariablesQueries: ['SET SESSION auto_increment_increment=1;']
		}); // should have no effect

		setTimeout(doQueries, 30000); // should generate error, node are removed

		await chrono.sleep(31000);
		await MySqlClientInstance.shutdown();
	}).timeout(71000);
});
