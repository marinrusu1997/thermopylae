import { before, after } from 'mocha';
import LoggerInstance, { FormattingManager, WinstonLogger } from '@marin/lib.logger/lib';
import Dockerode, { Container } from 'dockerode';
import { Connection, createConnection, MysqlError } from 'mysql';
import { spawn } from 'child_process';
import { streamWrite, streamEnd, onExit } from '@rauschma/stringio';
import { number } from '@marin/lib.utils';
import { config as dotEnvConfig } from 'dotenv';
import { MySqlClientInstance } from '../lib/clients/mysql';

interface MySqlEnv {
	host: string;
	port: number;
	user: string;
	password: string;
	database: string;
	tables: {
		account: string;
	};
}

const MySqlEnv: MySqlEnv = {
	host: '127.0.0.1',
	port: number.generateRandom(3310, 4000),
	user: 'root',
	password: 'secret',
	database: 'test_data_repositories',
	tables: {
		account: 'account'
	}
};

// eslint-disable-next-line import/no-mutable-exports
const docker: Dockerode = new Dockerode({
	socketPath: '/var/run/docker.sock'
});

async function assertImageAvailability(imageName: string): Promise<void> {
	const images = await docker.listImages();
	if (images.findIndex(image => image.RepoTags.includes(imageName)) === -1) {
		throw new Error(`${imageName} image not found. Install it then rerun tests.`);
	}
}

let mySqlSetupConnection: Connection;
function createNewMySqlConnectionForSetUp(env?: Partial<MySqlEnv>): Connection {
	mySqlSetupConnection = createConnection({
		host: (env && env.host) || MySqlEnv.host,
		port: (env && env.port) || MySqlEnv.port,
		user: (env && env.user) || MySqlEnv.user,
		password: (env && env.password) || MySqlEnv.password,
		database: (env && env.database) || MySqlEnv.database
	});
	return mySqlSetupConnection;
}

async function changeMySqlAuthToNativePassword(): Promise<void> {
	logger.debug('Spawning mysql client...');
	const mysql = spawn(`mysql`, ['-h', MySqlEnv.host, `-P${MySqlEnv.port}`, `-u${MySqlEnv.user}`, `-p${MySqlEnv.password}`], {
		stdio: ['pipe', process.stdout, process.stderr]
	});

	(async () => {
		logger.debug('Executing query to change auth type to native password...');
		await streamWrite(mysql.stdin, `ALTER USER 'root' IDENTIFIED WITH mysql_native_password BY '${MySqlEnv.password}';\n`);
		await streamEnd(mysql.stdin);
	})();

	await onExit(mysql);
}

function setUpMySqlContainer(resolve: Function, reject: Function): Promise<void> {
	return changeMySqlAuthToNativePassword()
		.then(() => {
			createNewMySqlConnectionForSetUp().connect(setupConnectionError => {
				if (setupConnectionError) {
					reject(setupConnectionError);
				}

				const boolType = 'TINYINT(1)';
				const stringType = 'VARCHAR(20)';

				logger.debug(`Creating ${MySqlEnv.tables.account} table...`);
				mySqlSetupConnection.query(
					`CREATE TABLE IF NOT EXISTS ${MySqlEnv.tables.account} (id ${stringType}, username ${stringType}, password VARCHAR(100), salt ${stringType}, telephone ${stringType}, email ${stringType}, locked ${boolType}, activated ${boolType}, mfa ${boolType}, role ${stringType}, pubKey ${boolType});`,
					createAccountTableErr => {
						if (createAccountTableErr) {
							return reject(createAccountTableErr);
						}

						logger.debug('Closing MySql set-up connection...');
						return mySqlSetupConnection.end(endErr => {
							if (endErr) {
								return reject(endErr);
							}
							return resolve();
						});
					}
				);
			});
		})
		.catch(changeMySqlAuthTypeErr => reject(changeMySqlAuthTypeErr));
}

async function waitMySqlContainerToBoot(): Promise<void> {
	// eslint-disable-next-line no-underscore-dangle
	let _resolve: Function;
	// eslint-disable-next-line no-underscore-dangle
	let _reject: Function;
	const promise = new Promise<void>((resolve, reject) => {
		_resolve = resolve;
		_reject = reject;
	});

	let retryNo = 0;

	// eslint-disable-next-line consistent-return
	function connectHandler(err?: MysqlError): void {
		if (err) {
			if (err.code === 'ER_NOT_SUPPORTED_AUTH_MODE') {
				// @ts-ignore
				return setUpMySqlContainer(_resolve, _reject);
			}

			// eslint-disable-next-line no-plusplus
			if (++retryNo > 15) {
				return _reject(err);
			}

			logger.error(`Error connecting to my sql. Retry no ${retryNo}.`);
			// @ts-ignore
			return setTimeout(() => createNewMySqlConnectionForSetUp().connect(connectHandler), 20000);
		}
	}

	logger.debug('Start connecting to my sql...');
	createNewMySqlConnectionForSetUp().connect(connectHandler);

	return promise;
}

// @ts-ignore
async function newMySqlContainerNeedsToBeCreated(portOfExistingContainer: number): Promise<boolean> {
	return new Promise<boolean>(resolve => {
		createNewMySqlConnectionForSetUp({ port: portOfExistingContainer }).connect(err => {
			if (err) {
				if (err.code === 'ER_NOT_SUPPORTED_AUTH_MODE') {
					// @ts-ignore
					return setUpMySqlContainer(
						() => resolve(false),
						(setUpError: Error) => {
							logger.error('Failed to set up already created MySql container. ', setUpError);
							resolve(true);
						}
					);
				}
				return resolve(true);
			}
			return resolve(false);
		});
	});
}

async function bootMySqlContainer(): Promise<void> {
	const containers = await docker.listContainers();
	for (let i = containers.length - 1; i >= 0; i--) {
		if (containers[i].Names.includes(`/${mySqlContainerName}`)) {
			logger.debug(`Found container created in previous run in ${containers[i].State} state.`);
			if (containers[i].State !== 'running') {
				// eslint-disable-next-line no-await-in-loop
				await (await docker.getContainer(containers[i].Id)).start();
			}
			for (let j = containers[i].Ports.length - 1; j >= 0; j--) {
				if (containers[i].Ports[j].PrivatePort === 3306 && typeof containers[i].Ports[j].PublicPort === 'number') {
					MySqlEnv.port = containers[i].Ports[j].PublicPort;
					break;
				}
			}
			return;
		}
	}

	await assertImageAvailability('mysql:latest');

	logger.debug('Creating MySql container...');
	mySqlContainer = await docker.createContainer({
		Image: 'mysql',
		name: mySqlContainerName,
		ExposedPorts: { '3306/tcp': {} },
		HostConfig: {
			PortBindings: {
				'3306/tcp': [
					{
						HostPort: `${MySqlEnv.port}`
					}
				]
			}
		},
		Env: [`MYSQL_ROOT_PASSWORD=${MySqlEnv.password}`, `MYSQL_DATABASE=${MySqlEnv.database}`]
	});

	logger.debug(`Starting MySql container ${mySqlContainer!.id} ...`);
	await mySqlContainer!.start();

	logger.debug('Waiting till MySql container will boot...');
	await waitMySqlContainerToBoot();
}

let mySqlContainer: Container | null = null;
const mySqlContainerName = 'sql_test_data_repositories';
let logger: WinstonLogger;

before(async function(): Promise<void> {
	this.timeout(3000000);

	const dotEnv = dotEnvConfig();
	if (dotEnv.error) {
		throw dotEnv.error;
	}

	LoggerInstance.console.setConfig({ level: 'debug' });
	LoggerInstance.formatting.applyOrderFor(FormattingManager.OutputFormat.PRINTF, true);
	logger = LoggerInstance.for('MOCHA');

	await bootMySqlContainer();

	MySqlClientInstance.init({
		pool: {
			host: MySqlEnv.host,
			port: MySqlEnv.port,
			user: MySqlEnv.user,
			password: MySqlEnv.password,
			database: MySqlEnv.database
		}
	});
});

after(async function(): Promise<void> {
	if (mySqlContainer) {
		this.timeout(20000);
		logger.debug(`Stopping created MySql container ${mySqlContainer.id} ...`);
		await mySqlContainer.stop();
		if (typeof process.env.DELETE_MY_SQL_CONTAINER_AFTER_TESTS === 'undefined' || process.env.DELETE_MY_SQL_CONTAINER_AFTER_TESTS === 'true') {
			logger.debug('Removing created MySql container...');
			await mySqlContainer.remove();
		}
	}
});

export { MySqlEnv };
