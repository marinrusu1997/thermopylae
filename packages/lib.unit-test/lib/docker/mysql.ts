import type { Port } from 'dockerode';
import { number } from '@thermopylae/lib.utils';
import { exec, spawn } from 'child_process';
import { Connection, createConnection, MysqlError } from 'mysql';
import { onExit, streamEnd, streamWrite } from '@rauschma/stringio';
import { Container } from 'dockerode';
import { ConnectionDetails, getDockerodeInstance, pullMissingImage, retrievePreviouslyCreatedContainer } from './index';
import { logger } from '../logger';

interface MySqlConnectionDetails extends ConnectionDetails {
	user: string;
	database: string;
}

interface BootOptions {
	schemaScriptLocation: string;
}

const PRIVATE_PORT = 3306;
const CONTAINER_NAME = 'mysql_test';
const IMAGE_NAME = 'mysql:latest';

const CONNECTION_DETAILS: MySqlConnectionDetails = {
	host: '127.0.0.1',
	port: number.randomInt(3000, 4000),
	user: 'root',
	password: 'thermopylae',
	database: 'thermopylae'
};

const RECONNECT_PARAMS = {
	maxAttempts: 15,
	initialTimeout: 200,
	absoluteTimeout: 20_000
};
Object.freeze(RECONNECT_PARAMS);

function extractMySqlServerPort(containerPort: Port): boolean {
	if (containerPort.PrivatePort === PRIVATE_PORT && typeof containerPort.PublicPort === 'number') {
		CONNECTION_DETAILS.port = containerPort.PublicPort;
		return true;
	}
	return false;
}

async function bootMySqlContainer(options: BootOptions): Promise<[Container, MySqlConnectionDetails]> {
	const containerInfos = await getDockerodeInstance().listContainers({
		all: true
	});

	let container = await retrievePreviouslyCreatedContainer(containerInfos, CONTAINER_NAME, extractMySqlServerPort);
	if (container != null) {
		logger.debug(`Awaiting mysql service availability on ${CONNECTION_DETAILS.host}:${CONNECTION_DETAILS.port}`);
		await waitMySqlServerToBoot(options.schemaScriptLocation, true);
	} else {
		await pullMissingImage(IMAGE_NAME);

		logger.debug('Creating MySQL container.');

		container = await getDockerodeInstance().createContainer({
			Image: IMAGE_NAME,
			name: CONTAINER_NAME,
			ExposedPorts: { [`${PRIVATE_PORT}/tcp`]: {} },
			HostConfig: {
				PortBindings: {
					[`${PRIVATE_PORT}/tcp`]: [
						{
							HostPort: `${CONNECTION_DETAILS.port}`
						}
					]
				}
			},
			Env: [`MYSQL_ROOT_PASSWORD=${CONNECTION_DETAILS.password}`, `MYSQL_DATABASE=${CONNECTION_DETAILS.database}`]
		});

		logger.debug(`Starting MySQL container ${container.id}`);
		await container.start();

		logger.debug(`Awaiting mysql service availability on ${CONNECTION_DETAILS.host}:${CONNECTION_DETAILS.port}`);
		await waitMySqlServerToBoot(options.schemaScriptLocation, false);
	}

	Object.freeze(CONNECTION_DETAILS);
	return [container, CONNECTION_DETAILS];
}

async function waitMySqlServerToBoot(schemaScriptLocation: string, exponentialReconnect: boolean): Promise<void> {
	let resolveMySqlServerBootWaiting: (value?: any) => void;
	let rejectMySqlServerBootWaiting: (reason?: any) => void;
	const promise = new Promise<void>((_resolve, _reject) => {
		resolveMySqlServerBootWaiting = _resolve;
		rejectMySqlServerBootWaiting = _reject;
	});

	let mySqlSetupConnection: Connection;
	let remainingAttempts = RECONNECT_PARAMS.maxAttempts;
	let reconnectTimeout = RECONNECT_PARAMS.initialTimeout; // ms

	function connectToMySqlServer(): void {
		mySqlSetupConnection = createConnection(CONNECTION_DETAILS);
		mySqlSetupConnection.connect(connectHandler);
	}

	function connectAgainToMySqlServer(): void {
		let reconnectingAfter;

		if (exponentialReconnect) {
			reconnectTimeout *= 2;
			reconnectingAfter = reconnectTimeout;
		} else {
			reconnectingAfter = RECONNECT_PARAMS.absoluteTimeout;
		}

		logger.warning(
			`Reconnecting to MySQL ${CONNECTION_DETAILS.host}:${CONNECTION_DETAILS.port} in ${reconnectingAfter} ms. Remaining attempts ${remainingAttempts}.`
		);
		setTimeout(connectToMySqlServer, reconnectingAfter);
	}

	function endMySqlServerBootWaiting(err?: Error): void {
		return err ? rejectMySqlServerBootWaiting(err) : resolveMySqlServerBootWaiting();
	}

	function done(connectErr?: Error): void {
		if (connectErr) {
			return rejectMySqlServerBootWaiting(connectErr);
		}

		logger.info(`MySQL is ready for connections. Closing setup connection with id ${mySqlSetupConnection.threadId}`);
		return mySqlSetupConnection.end(endMySqlServerBootWaiting);
	}

	function setUpMySqlContainer(): void {
		async function changeMySqlAuthToNativePassword(): Promise<void> {
			const mysql = spawn(
				`mysql`,
				['-h', CONNECTION_DETAILS.host, `-P${CONNECTION_DETAILS.port}`, `-u${CONNECTION_DETAILS.user}`, `-p${CONNECTION_DETAILS.password}`],
				{
					stdio: ['pipe', process.stdout, process.stderr]
				}
			);

			logger.debug('Changing MySql auth type to native password...');
			await streamWrite(
				mysql.stdin,
				`ALTER USER '${CONNECTION_DETAILS.user}' IDENTIFIED WITH mysql_native_password BY '${CONNECTION_DETAILS.password}';\n`
			);
			await streamEnd(mysql.stdin);

			await onExit(mysql);
		}

		changeMySqlAuthToNativePassword()
			.then(() => createMySqlStorageSchema(schemaScriptLocation))
			.then(resolveMySqlServerBootWaiting)
			.catch(rejectMySqlServerBootWaiting);
	}

	function connectHandler(connectErr?: MysqlError): any {
		if (connectErr) {
			if (connectErr.code === 'ER_NOT_SUPPORTED_AUTH_MODE') {
				return setUpMySqlContainer();
			}

			// eslint-disable-next-line no-plusplus
			if (--remainingAttempts <= 0) {
				return done(connectErr);
			}

			return connectAgainToMySqlServer();
		}

		return done();
	}

	connectToMySqlServer();

	return promise;
}

async function createMySqlStorageSchema(schemaScriptLocation: string): Promise<void> {
	return new Promise((resolveStorageSchemaCreation, rejectStorageSchemaCreation) => {
		const cmd = `mysql -h ${CONNECTION_DETAILS.host} -P${CONNECTION_DETAILS.port} -u${CONNECTION_DETAILS.user} -p${CONNECTION_DETAILS.password} ${CONNECTION_DETAILS.database} < ${schemaScriptLocation}`;
		logger.debug(`Creating MySql storage schema. Executing: ${cmd}`);

		exec(cmd, (error, stdout, stderr) => {
			if (error) {
				rejectStorageSchemaCreation(error);
			} else {
				logger.debug(`Create MySql storage schema stdout:\n${stdout}`);
				logger.debug(`Create MySql storage schema stderr:\n${stderr}`);
				resolveStorageSchemaCreation();
			}
		});
	});
}

async function recreateMySqlDatabase(): Promise<void> {
	const mysql = spawn(
		`mysql`,
		['-h', CONNECTION_DETAILS.host, `-P${CONNECTION_DETAILS.port}`, `-u${CONNECTION_DETAILS.user}`, `-p${CONNECTION_DETAILS.password}`],
		{
			stdio: ['pipe', process.stdout, process.stderr]
		}
	);

	logger.debug('Dropping database...');
	await streamWrite(mysql.stdin, `DROP DATABASE ${CONNECTION_DETAILS.database};\n`);

	logger.debug('Recreating database...');
	await streamWrite(mysql.stdin, `CREATE DATABASE ${CONNECTION_DETAILS.database};\n`);

	await streamEnd(mysql.stdin);
	await onExit(mysql);
}

async function truncateMySqlTables(): Promise<void> {
	const cmd = `
					mysql -h ${CONNECTION_DETAILS.host} -P${CONNECTION_DETAILS.port} -u${CONNECTION_DETAILS.user} -p${CONNECTION_DETAILS.password} -Nse 'SHOW TABLES;' ${CONNECTION_DETAILS.database} | 
					while read table; do mysql -h ${CONNECTION_DETAILS.host} -P${CONNECTION_DETAILS.port} -u${CONNECTION_DETAILS.user} -p${CONNECTION_DETAILS.password} -e "DELETE FROM $table;" ${CONNECTION_DETAILS.database}; done
				`;
	logger.debug(`Truncating tables. Executing: ${cmd}`);

	return new Promise((resolve, reject) => {
		exec(cmd, (error, stdout, stderr) => {
			if (error) {
				return reject(error);
			}

			logger.debug(`Truncate all tables stdout:\n${stdout}`);
			logger.debug(`Truncate all tables stderr:\n${stderr}`);

			return resolve();
		});
	});
}

export { bootMySqlContainer, createMySqlStorageSchema, recreateMySqlDatabase, truncateMySqlTables, MySqlConnectionDetails };
