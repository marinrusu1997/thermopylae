// First of all environment variables needs to be loaded !!!
import './env-vars-loader';

import { chrono, number } from '@marin/lib.utils';
import { Connection, createConnection, MySqlClientInstance, MysqlError, RedisClientInstance } from '@marin/lib.data-access';
import { after, afterEach, before, beforeEach } from 'mocha';
import Dockerode, { Container, ContainerInfo, Port } from 'dockerode';
import { spawn, exec } from 'child_process';
import { onExit, streamEnd, streamWrite } from '@rauschma/stringio';
import { Logger } from './logger';
import { ResourcesManagerInstance } from './resources-manager';

interface ConnectionDetails {
	host: string;
	port: number;
	password: string;
}

interface MySqlConnectionDetails extends ConnectionDetails {
	user: string;
	database: string;
}

interface DockerContainers {
	mysql: { name: string; instance: Container | null };
	redis: { name: string; instance: Container | null };
}

type ServicePortExtractor = (port: Port) => boolean;

const DROP_MYSQL_SCHEMA_ON_START = process.env.MYSQL_ENV_DROP_SCHEMA_ON_START === 'true' || false;

const RESOURCE_MANAGEMENT_TIMEOUT_MS = Number(process.env.ENV_RESOURCE_MANAGEMENT_TIMEOUT_MS) || 10_000;

const MYSQL_PORT = Number(process.env.MYSQL_PORT) || 3306;

const REDIS_PORT = Number(process.env.REDIS_PORT) || 6379;

const MYSQL_SCHEMA_SCRIPT_LOCATION = process.env.MYSQL_ENV_SCHEMA_SCRIPT_LOCATION || 'test/fixtures/setup.sql';

const DOCKER_IMAGES = {
	mysql: process.env.MYSQL_DOCKER_IMAGE_NAME || 'mysql:latest',
	redis: process.env.REDIS_DOCKER_IMAGE_NAME || 'bitnami/redis:latest'
};

const RECONNECT_PARAMS = {
	mysql: {
		maxAttempts: process.env.MYSQL_RECONNECT_MAX_ATTEMPTS || 15,
		initialTimeout: process.env.MYSQL_RECONNECT_INITIAL_TIMEOUT || 200,
		absoluteTimeout: process.env.MYSQL_RECONNECT_ABSOLUTE_TIMEOUT || 20_000
	},
	redis: {
		maxAttempts: process.env.REDIS_RECONNECT_MAX_ATTEMPTS || 5,
		initialTimeout: process.env.REDIS_RECONNECT_INITIAL_TIMEOUT || 200
	}
};

const MySqlConnectionDetails: MySqlConnectionDetails = {
	host: process.env.MYSQL_ENV_HOSTNAME!,
	port: number.generateRandom(Number(process.env.MYSQL_ENV_LOWER_RANGE_PORT), Number(process.env.MYSQL_ENV_UPPER_RANGE_PORT)),
	user: process.env.MYSQL_ENV_USERNAME!,
	password: process.env.MYSQL_ENV_PASSWORD!,
	database: process.env.MYSQL_ENV_DATABASE!
};

const RedisConnectionDetails: ConnectionDetails = {
	host: process.env.REDIS_ENV_HOSTNAME!,
	port: number.generateRandom(Number(process.env.REDIS_ENV_LOWER_RANGE_PORT), Number(process.env.REDIS_ENV_UPPER_RANGE_PORT)),
	password: process.env.REDIS_ENV_PASSWORD!
};

const DockerodeInstance: Dockerode = new Dockerode({
	socketPath: process.env.DOCKER_SOCKET_PATH || '/var/run/docker.sock'
});

const DockerContainers: DockerContainers = {
	mysql: {
		name: process.env.MYSQL_DOCKER_CONTAINER_NAME || 'sql_test_data_repositories',
		instance: null
	},
	redis: {
		name: process.env.REDIS_DOCKER_CONTAINER_NAME || 'redis_test_data_repositories',
		instance: null
	}
};

async function assertImageAvailability(imageName: string): Promise<void> {
	const images = await DockerodeInstance.listImages();
	if (images.findIndex((image) => image.RepoTags.includes(imageName)) === -1) {
		Logger.debug(`Pulling image ${imageName}...`);
		const image = await DockerodeInstance.pull(imageName, {});
		Logger.debug(`Image created with id ${image.id}. Waiting 200 ms...`);
		await chrono.sleep(200);
	}
}

async function retrievePreviouslyCreatedContainer(
	containerInfos: Array<ContainerInfo>,
	containerName: string,
	extractServicePort: ServicePortExtractor
): Promise<Container | null> {
	for (let i = containerInfos.length - 1; i >= 0; i--) {
		if (containerInfos[i].Names.includes(`/${containerName}`)) {
			Logger.debug(`Found container ${containerName} created in previous run in ${containerInfos[i].State} state.`);
			// eslint-disable-next-line no-await-in-loop
			const container = await DockerodeInstance.getContainer(containerInfos[i].Id);

			if (containerInfos[i].State !== 'running') {
				Logger.debug(`Starting container ${containerName}...`);
				// eslint-disable-next-line no-await-in-loop
				await container.start();
			}

			let containerListeningInterface;
			for (let j = containerInfos[i].Ports.length - 1; j >= 0; j--) {
				containerListeningInterface = containerInfos[i].Ports[j];

				if (extractServicePort(containerListeningInterface)) {
					Logger.debug(
						`Service from container ${containerName} is listening on ${containerListeningInterface.IP}:${containerListeningInterface.PublicPort}`
					);
					break;
				}
			}

			return container;
		}
	}
	return null;
}

async function recreateMySqlDatabase(): Promise<void> {
	const mysql = spawn(
		`mysql`,
		['-h', MySqlConnectionDetails.host, `-P${MySqlConnectionDetails.port}`, `-u${MySqlConnectionDetails.user}`, `-p${MySqlConnectionDetails.password}`],
		{
			stdio: ['pipe', process.stdout, process.stderr]
		}
	);

	Logger.debug('Dropping database...');
	await streamWrite(mysql.stdin, `DROP DATABASE ${MySqlConnectionDetails.database};\n`);

	Logger.debug('Recreating database...');
	await streamWrite(mysql.stdin, `CREATE DATABASE ${MySqlConnectionDetails.database};\n`);

	await streamEnd(mysql.stdin);
	await onExit(mysql);
}

async function createMySqlStorageSchema(): Promise<void> {
	return new Promise((resolveStorageSchemaCreation, rejectStorageSchemaCreation) => {
		const cmd = `mysql -h ${MySqlConnectionDetails.host} -P${MySqlConnectionDetails.port} -u${MySqlConnectionDetails.user} -p${MySqlConnectionDetails.password} ${MySqlConnectionDetails.database} < ${MYSQL_SCHEMA_SCRIPT_LOCATION}`;
		Logger.debug(`Creating MySql storage schema. Executing: ${cmd}`);

		exec(cmd, (error, stdout, stderr) => {
			if (error) {
				rejectStorageSchemaCreation(error);
			} else {
				Logger.debug(`Create MySql storage schema stdout:\n${stdout}`);
				Logger.debug(`Create MySql storage schema stderr:\n${stderr}`);
				resolveStorageSchemaCreation();
			}
		});
	});
}

async function waitMySqlServerToBoot(exponentialReconnect?: boolean): Promise<void> {
	let resolveMySqlServerBootWaiting: (value?: any) => void;
	let rejectMySqlServerBootWaiting: (reason?: any) => void;
	const promise = new Promise<void>((_resolve, _reject) => {
		resolveMySqlServerBootWaiting = _resolve;
		rejectMySqlServerBootWaiting = _reject;
	});

	let mySqlSetupConnection: Connection;
	let remainingAttempts = Number(RECONNECT_PARAMS.mysql.maxAttempts);
	let reconnectTimeout = Number(RECONNECT_PARAMS.mysql.initialTimeout); // ms

	function connectToMySqlServer(): void {
		mySqlSetupConnection = createConnection({
			host: MySqlConnectionDetails.host,
			port: MySqlConnectionDetails.port,
			user: MySqlConnectionDetails.user,
			password: MySqlConnectionDetails.password,
			database: MySqlConnectionDetails.database
		});
		mySqlSetupConnection.connect(connectHandler);
	}

	function connectAgainToMySqlServer(): void {
		let reconnectingAfter;

		if (exponentialReconnect) {
			reconnectTimeout *= 2;
			reconnectingAfter = reconnectTimeout;
		} else {
			reconnectingAfter = Number(RECONNECT_PARAMS.mysql.absoluteTimeout);
		}

		Logger.warning(
			`Reconnecting to MySQL ${MySqlConnectionDetails.host}:${MySqlConnectionDetails.port} in ${reconnectingAfter} ms. Remaining attempts ${remainingAttempts}.`
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

		Logger.info(`MySQL is ready for connections. Closing setup connection with id ${mySqlSetupConnection.threadId}`);
		return mySqlSetupConnection.end(endMySqlServerBootWaiting);
	}

	function setUpMySqlContainer(): void {
		async function changeMySqlAuthToNativePassword(): Promise<void> {
			const mysql = spawn(
				`mysql`,
				[
					'-h',
					MySqlConnectionDetails.host,
					`-P${MySqlConnectionDetails.port}`,
					`-u${MySqlConnectionDetails.user}`,
					`-p${MySqlConnectionDetails.password}`
				],
				{
					stdio: ['pipe', process.stdout, process.stderr]
				}
			);

			Logger.debug('Changing MySql auth type to native password...');
			await streamWrite(mysql.stdin, `ALTER USER 'root' IDENTIFIED WITH mysql_native_password BY '${MySqlConnectionDetails.password}';\n`);
			await streamEnd(mysql.stdin);

			await onExit(mysql);
		}

		changeMySqlAuthToNativePassword().then(createMySqlStorageSchema).then(resolveMySqlServerBootWaiting).catch(rejectMySqlServerBootWaiting);
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

async function bootMySqlContainer(containerInfos: Array<ContainerInfo>): Promise<void> {
	const extractMySqlServerPort: ServicePortExtractor = (containerPort) => {
		if (containerPort.PrivatePort === MYSQL_PORT && typeof containerPort.PublicPort === 'number') {
			MySqlConnectionDetails.port = containerPort.PublicPort;
			return true;
		}
		return false;
	};

	DockerContainers.mysql.instance = await retrievePreviouslyCreatedContainer(containerInfos, DockerContainers.mysql.name, extractMySqlServerPort);
	if (DockerContainers.mysql.instance) {
		return waitMySqlServerToBoot(true);
	}

	await assertImageAvailability(DOCKER_IMAGES.mysql!);

	Logger.debug('Creating MySql container...');
	DockerContainers.mysql.instance = await DockerodeInstance.createContainer({
		Image: DOCKER_IMAGES.mysql,
		name: DockerContainers.mysql.name,
		ExposedPorts: { [`${MYSQL_PORT}/tcp`]: {} },
		HostConfig: {
			PortBindings: {
				[`${MYSQL_PORT}/tcp`]: [
					{
						HostPort: `${MySqlConnectionDetails.port}`
					}
				]
			}
		},
		Env: [`MYSQL_ROOT_PASSWORD=${MySqlConnectionDetails.password}`, `MYSQL_DATABASE=${MySqlConnectionDetails.database}`]
	});

	Logger.debug(`Starting MySql container ${DockerContainers.mysql.instance!.id} ...`);
	await DockerContainers.mysql.instance!.start();

	return waitMySqlServerToBoot();
}

async function connectToRedis(): Promise<void> {
	let remainingAttempts = Number(RECONNECT_PARAMS.redis.maxAttempts);
	let reconnectTimeout = Number(RECONNECT_PARAMS.redis.initialTimeout); // ms

	let lastConnectError;
	// eslint-disable-next-line no-plusplus
	while (--remainingAttempts) {
		try {
			// eslint-disable-next-line no-await-in-loop
			return await RedisClientInstance.init({
				client: RedisConnectionDetails
			});
		} catch (e) {
			lastConnectError = e;

			Logger.warning(`Reconnecting to Redis in ${reconnectTimeout} ms. Remaining attempts ${remainingAttempts}.`);
			// eslint-disable-next-line no-await-in-loop
			await chrono.sleep(reconnectTimeout);

			reconnectTimeout *= 2;
		}
	}

	throw lastConnectError;
}

async function bootRedisContainer(containerInfos: Array<ContainerInfo>): Promise<void> {
	const extractRedisServerPort: ServicePortExtractor = (containerPort) => {
		if (containerPort.PrivatePort === REDIS_PORT && typeof containerPort.PublicPort === 'number') {
			RedisConnectionDetails.port = containerPort.PublicPort;
			return true;
		}
		return false;
	};

	DockerContainers.redis.instance = await retrievePreviouslyCreatedContainer(containerInfos, DockerContainers.redis.name, extractRedisServerPort);
	if (DockerContainers.redis.instance) {
		return;
	}

	await assertImageAvailability(DOCKER_IMAGES.redis!);

	Logger.debug('Creating Redis container...');
	DockerContainers.redis.instance = await DockerodeInstance.createContainer({
		Image: DOCKER_IMAGES.redis,
		name: DockerContainers.redis.name,
		ExposedPorts: { [`${REDIS_PORT}/tcp`]: {} },
		HostConfig: {
			PortBindings: {
				[`${REDIS_PORT}/tcp`]: [
					{
						HostPort: `${RedisConnectionDetails.port}`
					}
				]
			}
		},
		Env: [`REDIS_PASSWORD=${RedisConnectionDetails.password}`, `ALLOW_EMPTY_PASSWORD=false`]
	});

	Logger.debug(`Starting Redis container ${DockerContainers.redis.instance!.id} ...`);
	await DockerContainers.redis.instance!.start();
}

async function truncateMySqlTables(): Promise<void> {
	const cmd = `
					mysql -h ${MySqlConnectionDetails.host} -P${MySqlConnectionDetails.port} -u${MySqlConnectionDetails.user} -p${MySqlConnectionDetails.password} -Nse 'SHOW TABLES;' ${MySqlConnectionDetails.database} | 
					while read table; do mysql -h ${MySqlConnectionDetails.host} -P${MySqlConnectionDetails.port} -u${MySqlConnectionDetails.user} -p${MySqlConnectionDetails.password} -e "DELETE FROM $table;" ${MySqlConnectionDetails.database}; done
				`;
	Logger.debug(`Truncating tables. Executing: ${cmd}`);

	return new Promise((resolve, reject) => {
		exec(cmd, (error, stdout, stderr) => {
			if (error) {
				return reject(error);
			}

			Logger.debug(`Truncate all tables stdout:\n${stdout}`);
			Logger.debug(`Truncate all tables stderr:\n${stderr}`);

			return resolve();
		});
	});
}

async function brokeConnectionWithMySqlServer(): Promise<void> {
	await DockerContainers.mysql.instance!.stop();
}

async function reconnectToMySqlServer(): Promise<void> {
	await DockerContainers.mysql.instance!.start();

	await waitMySqlServerToBoot(true);

	MySqlClientInstance.init({
		pool: MySqlConnectionDetails
	});
}

before(async function testEnvInitializer(): Promise<void> {
	this.timeout(Number(process.env.ENV_INITIALIZATION_TIMEOUT_MS));

	const containerInfos = await DockerodeInstance.listContainers({
		all: true
	});

	await bootRedisContainer(containerInfos);

	await bootMySqlContainer(containerInfos);

	MySqlClientInstance.init({
		pool: MySqlConnectionDetails
	});

	await connectToRedis();

	if (DROP_MYSQL_SCHEMA_ON_START) {
		await recreateMySqlDatabase();
		await createMySqlStorageSchema();
	} else {
		await truncateMySqlTables();
	}
});

after(async function testEnvCleaner(): Promise<void> {
	this.timeout(Number(process.env.ENV_SHUTDOWN_TIMEOUT_MS));

	await MySqlClientInstance.shutdown();
	await RedisClientInstance.shutdown();

	if (typeof process.env.DELETE_CONTAINERS_AFTER_TESTS === 'undefined' || process.env.DELETE_CONTAINERS_AFTER_TESTS === 'true') {
		Logger.info(`Removing containers: MySql -> ${DockerContainers.mysql.instance!.id} ; Redis -> ${DockerContainers.redis.instance!.id}`);

		await DockerContainers.mysql.instance!.stop();
		await DockerContainers.mysql.instance!.remove();

		await DockerContainers.redis.instance!.stop();
		await DockerContainers.redis.instance!.remove();
	}
});

beforeEach(function () {
	this.timeout(RESOURCE_MANAGEMENT_TIMEOUT_MS);

	return ResourcesManagerInstance.createRequiredResources();
});

afterEach(function () {
	this.timeout(RESOURCE_MANAGEMENT_TIMEOUT_MS);

	return ResourcesManagerInstance.cleanRequiredResources();
});

export { MySqlConnectionDetails, brokeConnectionWithMySqlServer, reconnectToMySqlServer };
