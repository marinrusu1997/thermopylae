import { before, after } from 'mocha';
import LoggerInstance, { FormattingManager, WinstonLogger } from '@marin/lib.logger';
import Dockerode, { Container, ContainerInfo, Port } from 'dockerode';
import { Connection, createConnection, MysqlError } from 'mysql';
import { spawn } from 'child_process';
import { streamWrite, streamEnd, onExit } from '@rauschma/stringio';
import { chrono, number } from '@marin/lib.utils';
import { config as dotEnvConfig } from 'dotenv';
import { MySqlClientInstance } from '../lib/clients/mysql';
import { RedisClientInstance } from '../lib/clients/redis';

interface Env {
	host: string;
	port: number;
	password: string;
}

interface MySqlEnv extends Env {
	user: string;
	database: string;
	tables: {
		account: string;
	};
}

type AdjustPortsFun = (port: Port) => boolean;

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

const RedisEnv: Env = {
	host: '127.0.0.1',
	port: number.generateRandom(6400, 7000),
	password: 'secret'
};

const docker: Dockerode = new Dockerode({
	socketPath: '/var/run/docker.sock'
});

const mySqlContainerName = 'sql_test_data_repositories';
let mySqlContainer: Container | null = null;

const redisContainerName = 'redis_test_data_repositories';
let redisContainer: Container | null = null;

let logger: WinstonLogger;

let mySqlSetupConnection: Connection;

async function assertImageAvailability(imageName: string): Promise<void> {
	const images = await docker.listImages();
	if (images.findIndex(image => image.RepoTags.includes(imageName)) === -1) {
		logger.debug(`Pulling image ${imageName}...`);
		const image = await docker.pull(imageName, {});
		logger.debug(`Image created with id ${image.id}. Waiting 200 ms...`);
		await chrono.sleep(200);
	}
}

async function isContainerAlreadyAvailable(containerInfos: Array<ContainerInfo>, containerName: string, adjustPorts: AdjustPortsFun): Promise<boolean> {
	for (let i = containerInfos.length - 1; i >= 0; i--) {
		if (containerInfos[i].Names.includes(`/${containerName}`)) {
			logger.debug(`Found container ${containerName} created in previous run in ${containerInfos[i].State} state.`);
			if (containerInfos[i].State !== 'running') {
				// eslint-disable-next-line no-await-in-loop
				await (await docker.getContainer(containerInfos[i].Id)).start();
			}
			for (let j = containerInfos[i].Ports.length - 1; j >= 0; j--) {
				if (adjustPorts(containerInfos[i].Ports[j])) {
					break;
				}
			}
			return true;
		}
	}
	return false;
}

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
					`CREATE TABLE IF NOT EXISTS ${MySqlEnv.tables.account} (id INT AUTO_INCREMENT PRIMARY KEY, username ${stringType}, password VARCHAR(100), salt ${stringType}, telephone ${stringType}, email ${stringType}, locked ${boolType}, activated ${boolType}, mfa ${boolType}, role ${stringType}, pubKey ${stringType});`,
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

async function bootMySqlContainer(containerInfos: Array<ContainerInfo>): Promise<void> {
	const adjustMySqlPorts: AdjustPortsFun = containerPort => {
		if (containerPort.PrivatePort === 3306 && typeof containerPort.PublicPort === 'number') {
			MySqlEnv.port = containerPort.PublicPort;
			return true;
		}
		return false;
	};

	if (await isContainerAlreadyAvailable(containerInfos, mySqlContainerName, adjustMySqlPorts)) {
		return;
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

async function bootRedisContainer(containerInfos: Array<ContainerInfo>): Promise<void> {
	const adjustRedisPorts: AdjustPortsFun = containerPort => {
		if (containerPort.PrivatePort === 6379 && typeof containerPort.PublicPort === 'number') {
			RedisEnv.port = containerPort.PublicPort;
			return true;
		}
		return false;
	};

	if (await isContainerAlreadyAvailable(containerInfos, redisContainerName, adjustRedisPorts)) {
		return;
	}

	await assertImageAvailability('bitnami/redis:latest');

	logger.debug('Creating Redis container...');
	redisContainer = await docker.createContainer({
		Image: 'bitnami/redis:latest',
		name: redisContainerName,
		ExposedPorts: { '6379/tcp': {} },
		HostConfig: {
			PortBindings: {
				'6379/tcp': [
					{
						HostPort: `${RedisEnv.port}`
					}
				]
			}
		},
		Env: [`REDIS_PASSWORD=${RedisEnv.password}`, `ALLOW_EMPTY_PASSWORD=false`]
	});

	logger.debug(`Starting Redis container ${redisContainer!.id} ...`);
	await redisContainer!.start();
}

before(async function(): Promise<void> {
	this.timeout(3000000);

	const dotEnv = dotEnvConfig();
	if (dotEnv.error) {
		throw dotEnv.error;
	}

	LoggerInstance.console.setConfig({ level: process.env.LOG_LEVEL || 'debug' });
	LoggerInstance.formatting.applyOrderFor(FormattingManager.OutputFormat.PRINTF, true);
	logger = LoggerInstance.for('MOCHA');

	const containerInfos = await docker.listContainers({
		all: true
	});

	await bootRedisContainer(containerInfos);

	await bootMySqlContainer(containerInfos);

	MySqlClientInstance.init({
		pool: MySqlEnv
	});

	await RedisClientInstance.init({
		client: RedisEnv
	});
});

after(async function(): Promise<void> {
	this.timeout(20000);

	await MySqlClientInstance.shutdown();
	await RedisClientInstance.shutdown();

	if (mySqlContainer) {
		logger.debug(`Stopping created MySql container ${mySqlContainer.id} ...`);
		await mySqlContainer.stop();
		if (typeof process.env.DELETE_MY_SQL_CONTAINER_AFTER_TESTS === 'undefined' || process.env.DELETE_MY_SQL_CONTAINER_AFTER_TESTS === 'true') {
			logger.debug('Removing created MySql container...');
			await mySqlContainer.remove();
		}
	}

	if (redisContainer) {
		logger.debug(`Stopping created Redis container ${redisContainer.id} ...`);
		await redisContainer.stop();
		if (typeof process.env.DELETE_REDIS_CONTAINER_AFTER_TESTS === 'undefined' || process.env.DELETE_REDIS_CONTAINER_AFTER_TESTS === 'true') {
			logger.debug('Removing created Redis container...');
			await redisContainer.remove();
		}
	}
});

export { MySqlEnv };
