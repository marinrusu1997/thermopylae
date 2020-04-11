import { chrono, number } from '@marin/lib.utils';
import { Connection, createConnection, MySqlClientInstance, MysqlError, RedisClientInstance } from '@marin/lib.data-access';
import LoggerInstance, { FormattingManager, WinstonLogger } from '@marin/lib.logger';
import { after, before } from 'mocha';
import Dockerode, { Container, ContainerInfo, Port } from 'dockerode';
import { spawn, exec } from 'child_process';
import { onExit, streamEnd, streamWrite } from '@rauschma/stringio';
import { config as dotEnvConfig } from 'dotenv';

// First of all environment variables needs to be loaded
const dotEnv = dotEnvConfig();
if (dotEnv.error) {
	throw dotEnv.error;
}

interface Env {
	host: string;
	port: number;
	password: string;
}

interface MySqlEnv extends Env {
	user: string;
	database: string;
	schemaScriptLocation: string;
}

interface DockerContainers {
	mysql: { name: string; instance: Container | null };
	redis: { name: string; instance: Container | null };
}

type ServicePortExtractor = (port: Port) => boolean;

const DOCKER_IMAGES = {
	mysql: process.env.MYSQL_DOCKER_IMAGE_NAME,
	redis: process.env.REDIS_DOCKER_IMAGE_NAME
};

const RECONNECT_PARAMS = {
	mysql: {
		maxAttempts: process.env.MYSQL_RECONNECT_MAX_ATTEMPTS,
		initialTimeout: process.env.MYSQL_RECONNECT_INITIAL_TIMEOUT,
		absoluteTimeout: process.env.MYSQL_RECONNECT_ABSOLUTE_TIMEOUT
	},
	redis: {
		maxAttempts: process.env.REDIS_RECONNECT_MAX_ATTEMPTS,
		initialTimeout: process.env.REDIS_RECONNECT_INITIAL_TIMEOUT
	}
};

const MYSQL_DEFAULT_PORT = Number(process.env.MYSQL_DEFAULT_PORT);

const REDIS_DEFAULT_PORT = Number(process.env.REDIS_DEFAULT_PORT);

const MySqlEnv: MySqlEnv = {
	host: process.env.MYSQL_ENV_HOSTNAME!,
	port: number.generateRandom(Number(process.env.MYSQL_ENV_LOWER_RANGE_PORT), Number(process.env.MYSQL_ENV_UPPER_RANGE_PORT)),
	user: process.env.MYSQL_ENV_USERNAME!,
	password: process.env.MYSQL_ENV_PASSWORD!,
	database: process.env.MYSQL_ENV_DATABASE!,
	schemaScriptLocation: process.env.MYSQL_ENV_SCHEMA_SCRIPT_LOCATION!
};

const RedisEnv: Env = {
	host: process.env.REDIS_ENV_HOSTNAME!,
	port: number.generateRandom(Number(process.env.REDIS_ENV_LOWER_RANGE_PORT), Number(process.env.REDIS_ENV_UPPER_RANGE_PORT)),
	password: process.env.REDIS_ENV_PASSWORD!
};

const DockerodeInstance: Dockerode = new Dockerode({
	socketPath: process.env.DOCKER_SOCKET_PATH
});

const DockerContainers: DockerContainers = {
	mysql: {
		name: process.env.MYSQL_DOCKER_CONTAINER_NAME!,
		instance: null
	},
	redis: {
		name: process.env.REDIS_DOCKER_CONTAINER_NAME!,
		instance: null
	}
};

let logger: WinstonLogger;

function getLogger(): WinstonLogger {
	return logger;
}

async function assertImageAvailability(imageName: string): Promise<void> {
	const images = await DockerodeInstance.listImages();
	if (images.findIndex((image) => image.RepoTags.includes(imageName)) === -1) {
		logger.debug(`Pulling image ${imageName}...`);
		const image = await DockerodeInstance.pull(imageName, {});
		logger.debug(`Image created with id ${image.id}. Waiting 200 ms...`);
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
			logger.debug(`Found container ${containerName} created in previous run in ${containerInfos[i].State} state.`);
			// eslint-disable-next-line no-await-in-loop
			const container = await DockerodeInstance.getContainer(containerInfos[i].Id);

			if (containerInfos[i].State !== 'running') {
				logger.debug(`Starting container ${containerName}...`);
				// eslint-disable-next-line no-await-in-loop
				await container.start();
			}

			for (let j = containerInfos[i].Ports.length - 1; j >= 0; j--) {
				if (extractServicePort(containerInfos[i].Ports[j])) {
					break;
				}
			}

			return container;
		}
	}
	return null;
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
			host: MySqlEnv.host,
			port: MySqlEnv.port,
			user: MySqlEnv.user,
			password: MySqlEnv.password,
			database: MySqlEnv.database
		});
		mySqlSetupConnection.connect(connectHandler);
	}

	function reconnectToMySqlServer(): void {
		let reconnectingAfter;

		if (exponentialReconnect) {
			reconnectTimeout *= 2;
			reconnectingAfter = reconnectTimeout;
		} else {
			reconnectingAfter = Number(RECONNECT_PARAMS.mysql.absoluteTimeout);
		}

		logger.warning(`Reconnecting to MySQL in ${reconnectingAfter} ms. Remaining attempts ${remainingAttempts}.`);
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
			const mysql = spawn(`mysql`, ['-h', MySqlEnv.host, `-P${MySqlEnv.port}`, `-u${MySqlEnv.user}`, `-p${MySqlEnv.password}`], {
				stdio: ['pipe', process.stdout, process.stderr]
			});

			logger.debug('Changing MySql auth type to native password...');
			await streamWrite(mysql.stdin, `ALTER USER 'root' IDENTIFIED WITH mysql_native_password BY '${MySqlEnv.password}';\n`);
			await streamEnd(mysql.stdin);

			await onExit(mysql);
		}

		async function createMySqlStorageSchema(): Promise<void> {
			return new Promise((resolveStorageSchemaCreation, rejectStorageSchemaCreation) => {
				const cmd = `mysql -h ${MySqlEnv.host} -P${MySqlEnv.port} -u${MySqlEnv.user} -p${MySqlEnv.password} ${MySqlEnv.database} < ${MySqlEnv.schemaScriptLocation}`;
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

			return reconnectToMySqlServer();
		}

		return done();
	}

	connectToMySqlServer();

	return promise;
}

async function bootMySqlContainer(containerInfos: Array<ContainerInfo>): Promise<void> {
	const extractMySqlServerPort: ServicePortExtractor = (containerPort) => {
		if (containerPort.PrivatePort === MYSQL_DEFAULT_PORT && typeof containerPort.PublicPort === 'number') {
			MySqlEnv.port = containerPort.PublicPort;
			return true;
		}
		return false;
	};

	DockerContainers.mysql.instance = await retrievePreviouslyCreatedContainer(containerInfos, DockerContainers.mysql.name, extractMySqlServerPort);
	if (DockerContainers.mysql.instance) {
		return waitMySqlServerToBoot(true);
	}

	await assertImageAvailability(DOCKER_IMAGES.mysql!);

	logger.debug('Creating MySql container...');
	DockerContainers.mysql.instance = await DockerodeInstance.createContainer({
		Image: DOCKER_IMAGES.mysql,
		name: DockerContainers.mysql.name,
		ExposedPorts: { [`${MYSQL_DEFAULT_PORT}/tcp`]: {} },
		HostConfig: {
			PortBindings: {
				[`${MYSQL_DEFAULT_PORT}/tcp`]: [
					{
						HostPort: `${MySqlEnv.port}`
					}
				]
			}
		},
		Env: [`MYSQL_ROOT_PASSWORD=${MySqlEnv.password}`, `MYSQL_DATABASE=${MySqlEnv.database}`]
	});

	logger.debug(`Starting MySql container ${DockerContainers.mysql.instance!.id} ...`);
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
				client: RedisEnv
			});
		} catch (e) {
			lastConnectError = e;

			logger.warning(`Reconnecting to Redis in ${reconnectTimeout} ms. Remaining attempts ${remainingAttempts}.`);
			// eslint-disable-next-line no-await-in-loop
			await chrono.sleep(reconnectTimeout);

			reconnectTimeout *= 2;
		}
	}

	throw lastConnectError;
}

async function bootRedisContainer(containerInfos: Array<ContainerInfo>): Promise<void> {
	const extractRedisServerPort: ServicePortExtractor = (containerPort) => {
		if (containerPort.PrivatePort === REDIS_DEFAULT_PORT && typeof containerPort.PublicPort === 'number') {
			RedisEnv.port = containerPort.PublicPort;
			return true;
		}
		return false;
	};

	DockerContainers.redis.instance = await retrievePreviouslyCreatedContainer(containerInfos, DockerContainers.redis.name, extractRedisServerPort);
	if (DockerContainers.redis.instance) {
		return;
	}

	await assertImageAvailability(DOCKER_IMAGES.redis!);

	logger.debug('Creating Redis container...');
	DockerContainers.redis.instance = await DockerodeInstance.createContainer({
		Image: DOCKER_IMAGES.redis,
		name: DockerContainers.redis.name,
		ExposedPorts: { [`${REDIS_DEFAULT_PORT}/tcp`]: {} },
		HostConfig: {
			PortBindings: {
				[`${REDIS_DEFAULT_PORT}/tcp`]: [
					{
						HostPort: `${RedisEnv.port}`
					}
				]
			}
		},
		Env: [`REDIS_PASSWORD=${RedisEnv.password}`, `ALLOW_EMPTY_PASSWORD=false`]
	});

	logger.debug(`Starting Redis container ${DockerContainers.redis.instance!.id} ...`);
	await DockerContainers.redis.instance!.start();
}

before(async function testEnvInitializer(): Promise<void> {
	this.timeout(Number(process.env.ENV_INITIALIZATION_TIMEOUT_MS));

	LoggerInstance.console.setConfig({ level: process.env.ENV_LOG_LEVEL || 'debug' });
	LoggerInstance.formatting.applyOrderFor(FormattingManager.OutputFormat.PRINTF, true);
	logger = LoggerInstance.for(process.env.ENV_LOGGER_NAME!);

	const containerInfos = await DockerodeInstance.listContainers({
		all: true
	});

	await bootRedisContainer(containerInfos);

	await bootMySqlContainer(containerInfos);

	MySqlClientInstance.init({
		pool: MySqlEnv
	});

	await connectToRedis();
});

after(async function testEnvCleaner(): Promise<void> {
	this.timeout(Number(process.env.ENV_SHUTDOWN_TIMEOUT_MS));

	await MySqlClientInstance.shutdown();
	await RedisClientInstance.shutdown();

	if (typeof process.env.DELETE_CONTAINERS_AFTER_TESTS === 'undefined' || process.env.DELETE_CONTAINERS_AFTER_TESTS === 'true') {
		logger.info(`Removing containers: MySql -> ${DockerContainers.mysql.instance!.id} ; Redis -> ${DockerContainers.redis.instance!.id}`);

		await DockerContainers.mysql.instance!.stop();
		await DockerContainers.mysql.instance!.remove();

		await DockerContainers.redis.instance!.stop();
		await DockerContainers.redis.instance!.remove();
	}
});

export { MySqlEnv, getLogger, DockerContainers, waitMySqlServerToBoot };
