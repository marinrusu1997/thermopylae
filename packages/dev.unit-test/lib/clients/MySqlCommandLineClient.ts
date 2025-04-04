import { onExit, streamEnd, streamWrite } from '@rauschma/stringio';
import { lookpath } from 'lookpath';
import { exec, spawn } from 'node:child_process';
import os from 'node:os';
import { logger } from '../logger.js';

enum Command {
	MYSQL = 'mysql',
	MYSQLSH = 'mysqlsh'
}

interface ConnectionDetails {
	host: string;
	port: number;
	password: string;
}

interface MySqlConnectionDetails extends ConnectionDetails {
	user: string;
	database: string;
}

class MySqlCommandLineClient {
	private commandInternal: Command | null;

	private baseArgsInternal: string[] | null;

	private connectionDetails: MySqlConnectionDetails;

	public constructor(connectionDetails: MySqlConnectionDetails) {
		this.commandInternal = null;
		this.baseArgsInternal = null;
		this.connectionDetails = connectionDetails;
	}

	private async init(): Promise<void> {
		if (this.initialized) {
			return;
		}

		this.commandInternal = await MySqlCommandLineClient.resolveMySqlCommand();
		if (this.commandInternal === Command.MYSQLSH) {
			this.baseArgsInternal = ['--sql'];
		} else {
			this.baseArgsInternal = [];
		}

		this.baseArgs.push(
			'-h',
			this.connectionDetails.host,
			`-P${this.connectionDetails.port}`,
			`-u${this.connectionDetails.user}`,
			`-p${this.connectionDetails.password}`
		);
	}

	public async changeAuthToNativePassword(): Promise<void> {
		await this.init();

		logger.info(`Changing MySql auth type to native password. Executing: ${this.command} ${this.baseArgs.join(' ')}`);

		const mysql = spawn(this.command, this.baseArgs, {
			stdio: ['pipe', process.stdout, process.stderr]
		});

		await streamWrite(
			mysql.stdin,
			`ALTER USER '${this.connectionDetails.user}' IDENTIFIED WITH mysql_native_password BY '${this.connectionDetails.password}';\n`
		);
		await streamEnd(mysql.stdin);

		await onExit(mysql);
	}

	public async createStorageSchema(schemaScriptLocation: string): Promise<void> {
		await this.init();

		return new Promise((resolve, reject) => {
			const args = [...this.baseArgs];

			if (this.command === Command.MYSQL) {
				args.push(this.connectionDetails.database, '<', schemaScriptLocation);
			} else if (this.command === Command.MYSQLSH) {
				args.push(`--database=${this.connectionDetails.database}`, `--file=${schemaScriptLocation}`);
			} else {
				throw new Error(`Unknown command ${this.command}`);
			}

			const executedCmd = `${this.command} ${args.join(' ')}`;

			logger.info(`Creating MySql storage schema. Executing: ${executedCmd}`);

			// oxlint-disable-next-line prefer-await-to-callbacks
			exec(executedCmd, (error, stdout, stderr) => {
				if (error) {
					reject(error);
				} else {
					logger.debug(`Create MySql storage schema stdout:\n${stdout}`);
					logger.debug(`Create MySql storage schema stderr:\n${stderr}`);
					resolve();
				}
			});
		});
	}

	public async recreateDatabase(): Promise<void> {
		await this.init();

		const mysql = spawn(this.command, this.baseArgs, {
			stdio: ['pipe', process.stdout, process.stderr]
		});

		logger.debug('Dropping database...');
		await streamWrite(mysql.stdin, `DROP DATABASE ${this.connectionDetails.database};${os.EOL}`);

		logger.debug('Recreating database...');
		await streamWrite(mysql.stdin, `CREATE DATABASE ${this.connectionDetails.database};${os.EOL}`);

		await streamEnd(mysql.stdin);
		await onExit(mysql);
	}

	public async truncateTables(): Promise<void> {
		await this.init();

		const tables = await this.getTables();
		const cmd = this.createExecuteQueryCommand(`'${tables.map((table) => `DELETE FROM ${table};`).join(' ')}'`);

		logger.debug(`Executing: ${cmd}`);
		await MySqlCommandLineClient.executeCommand(cmd);
	}

	private async getTables(): Promise<string[]> {
		const cmd = this.createExecuteQueryCommand("'SHOW TABLES;'");
		const output = await MySqlCommandLineClient.getCommandOutput(cmd);

		const tables = output.split(os.EOL);
		if (this.command === Command.MYSQLSH) {
			tables.splice(0, 1);
		}

		return tables.filter((table) => table.length > 0);
	}

	private createExecuteQueryCommand(query: string): string {
		const cmdParts = [this.command, ...this.baseArgs];
		if (this.command === Command.MYSQL) {
			cmdParts.push('-Nse', query, this.connectionDetails.database);
		} else if (this.command === Command.MYSQLSH) {
			cmdParts.push(`--execute=${query}`, `--database=${this.connectionDetails.database}`);
		} else {
			throw new Error(`Unknown command ${this.command}`);
		}

		return cmdParts.join(' ');
	}

	private get initialized(): boolean {
		return this.commandInternal != null && this.baseArgsInternal != null;
	}

	private get command(): Command {
		if (this.commandInternal == null) {
			throw new Error('Not Initialized');
		}
		return this.commandInternal;
	}

	private get baseArgs(): string[] {
		if (this.baseArgsInternal == null) {
			throw new Error('Not Initialized');
		}
		return this.baseArgsInternal;
	}

	private static async resolveMySqlCommand(): Promise<Command | never> {
		const candidates = [Command.MYSQL, Command.MYSQLSH];
		for (const candidate of candidates) {
			// oxlint-disable-next-line no-await-in-loop
			if (typeof (await lookpath(candidate)) === 'string') {
				return candidate;
			}
		}
		return Command.MYSQL;
	}

	private static getCommandOutput(cmd: string): Promise<string> {
		return new Promise<string>((resolve, reject) => {
			// oxlint-disable-next-line prefer-await-to-callbacks
			exec(cmd, (err, stdout, stderr) => {
				if (err) {
					logger.error(`Command ${cmd} failed. Stderr: ${stderr}`);
					reject(err);
					return;
				}
				resolve(stdout);
			});
		});
	}

	private static executeCommand(cmd: string): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			// oxlint-disable-next-line prefer-await-to-callbacks
			exec(cmd, (err, _stdout, stderr) => {
				if (err) {
					logger.error(`Command ${cmd} failed. Stderr: ${stderr}`);
					reject(err);
				} else {
					resolve();
				}
			});
		});
	}
}

export { MySqlCommandLineClient };
export type { MySqlConnectionDetails };
