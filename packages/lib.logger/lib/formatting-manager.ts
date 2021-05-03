import { Client, CoreModule, ErrorCodes, Library, Nullable } from '@thermopylae/core.declarations';
import { Format } from 'logform';
import { format } from 'winston';
// eslint-disable-next-line import/extensions
import type { SyslogConfigSetLevels } from 'winston/lib/winston/config';
import chalk from 'chalk';
import { createException } from './error';

const enum OutputFormat {
	PRINTF = 'PRINTF',
	JSON = 'JSON',
	PRETTY_PRINT = 'PRETTY_PRINT'
}

const enum DefaultFormatters {
	TIMESTAMP = 'timestamp',
	ALIGN = 'align',
	ERRORS = 'errors',
	SPLAT = 'splat',
	COLORIZE = 'colorize',
	LABEL = 'LABEL',
	LEVEL = 'LEVEL',
	PRINTF = 'printf',
	JSON = 'json',
	PRETTY_PRINT = 'prettyPrint'
}

type Formatter = DefaultFormatters | string;

/**
 * Class responsible for formatters managing. <br>
 * It is required that formatting is configured before getting a logger instance.
 */
class FormattingManager {
	private readonly formatters: Map<Formatter, Format>;

	private readonly formattedLabels: Record<string, string>;

	private readonly formattedLevels: Record<keyof SyslogConfigSetLevels, keyof SyslogConfigSetLevels | string>;

	private recipe!: Nullable<Array<Formatter>>;

	/**
	 * Defines default formatters and sets the recipe for {@link OutputFormat.PRINTF}.
	 */
	public constructor() {
		this.formatters = new Map();
		this.defineFormatters();

		this.formattedLabels = {};
		this.formattedLevels = {};

		this.setDefaultRecipe(OutputFormat.PRINTF);
	}

	/**
	 * Set a formatter into known formatters list. <br>
	 * If formatter exists already, it will be overwritten. <br>
	 * Order recipe is discarded and needs to be reconfigured.
	 *
	 * @param   name        Name of the formatter.
	 * @param   formatter   Formatter instance, must be winston compliant.
	 */
	public set(name: Formatter, formatter: Format): void {
		this.formatters.set(name, formatter);
		this.recipe = null;
	}

	/**
	 * Removes existing formatter from known formatters list. <br>
	 * Order recipe is discarded, reconfiguration is needed later.
	 *
	 * @param   name  Formatter name.
	 */
	public remove(name: Formatter): void {
		this.formatters.delete(name);
		this.recipe = null;
	}

	/**
	 * Specifies a custom recipe which instructs in which order formatters needs to be combined.
	 *
	 * @param recipe	List of formatter names.
	 */
	public order(recipe: Array<Formatter>): void {
		if (this.recipe != null) {
			throw createException(ErrorCodes.EXISTS, 'Order recipe has been configured already.');
		}
		this.recipe = recipe;
	}

	/**
	 * Configures a recipe from a predefined set of formatters. <br>
	 * If a recipe exists, it will be rewritten.
	 *
	 * @param   outputFormat    Logs output format for which recipe needs to be constructed.
	 * @param   colorize    	Whether output needs to be colored.
	 */
	public setDefaultRecipe(outputFormat: OutputFormat, colorize?: boolean): void {
		const order = [DefaultFormatters.TIMESTAMP, DefaultFormatters.ERRORS, DefaultFormatters.SPLAT, DefaultFormatters.ALIGN];

		if (colorize) {
			FormattingManager.defineFormattedLabels(this.formattedLabels);
			FormattingManager.defineFormattedLevels(this.formattedLevels);

			order.push(DefaultFormatters.LABEL);
			order.push(DefaultFormatters.LEVEL);
			order.push(DefaultFormatters.COLORIZE);
		}

		switch (outputFormat) {
			case OutputFormat.PRINTF:
				order.push(DefaultFormatters.PRINTF);
				break;
			case OutputFormat.JSON:
				order.push(DefaultFormatters.JSON);
				break;
			case OutputFormat.PRETTY_PRINT:
				order.push(DefaultFormatters.PRETTY_PRINT);
				break;
			default:
				throw createException(ErrorCodes.UNKNOWN, `Unknown output format: ${outputFormat}.`);
		}

		this.recipe = order;
	}

	/**
	 * Returns a formatter object for winston, which combines all known formatters. <br>
	 * Formatters order will follow the order specified by order recipe. <br>
	 * Label formatter will be set based on module name. <br>
	 *
	 * @param   module   	Name of the module formatting will be applied for.
	 */
	public formatterFor(module: string): Format {
		const { combine, label } = format;

		if (this.recipe == null) {
			throw createException(ErrorCodes.REQUIRED, 'Order recipe is not configured.');
		}

		const stagedFormatters = [label({ label: module })];

		let formatter;
		for (let i = 0; i < this.recipe.length; i += 1) {
			formatter = this.formatters.get(this.recipe[i]);
			if (!formatter) {
				throw createException(ErrorCodes.NOT_FOUND, `Formatter '${this.recipe[i]}' from the recipe is not registered.`);
			}
			stagedFormatters.push(formatter);
		}

		return combine(...stagedFormatters);
	}

	/**
	 * Adds predefined formatters to formatters map.
	 */
	private defineFormatters(): void {
		const { align, errors, splat, colorize, printf, json, prettyPrint } = format;
		this.formatters.set(
			DefaultFormatters.TIMESTAMP,
			format.timestamp({
				format: 'YYYY-MM-DD HH:mm:ss:SSS'
			})
		);
		this.formatters.set(DefaultFormatters.ALIGN, align());
		this.formatters.set(DefaultFormatters.ERRORS, errors({ stack: true }));
		this.formatters.set(DefaultFormatters.SPLAT, splat());
		this.formatters.set(
			DefaultFormatters.COLORIZE,
			colorize({
				level: true,
				colors: {
					emerg: 'magenta',
					alert: 'magenta',
					crit: 'magenta',
					error: 'red',
					warning: 'yellow',
					notice: 'cyan',
					info: 'green',
					debug: 'blue'
				}
			})
		);
		this.formatters.set(DefaultFormatters.LABEL, {
			transform: (info) => {
				if (info.label && this.formattedLabels[info.label]) {
					info.label = this.formattedLabels[info.label];
				}
				return info;
			}
		});
		this.formatters.set(DefaultFormatters.LEVEL, {
			transform: (info) => {
				info.level = this.formattedLevels[info.level] as string;
				return info;
			}
		});
		this.formatters.set(
			DefaultFormatters.PRINTF,
			printf((info) => {
				const { emitter, code, origin, data, level, stack, label, timestamp } = info;
				if (emitter && code) {
					info.message = `${info.message}; Emitter: ${emitter}; Code: ${code}; Data: ${JSON.stringify(data)}`;
				}

				return `${timestamp} (${process.pid}) [${label}] ${level}:${info.message || ''}${stack ? `\n${stack}` : ''}${
					origin instanceof Error ? `\nOrigin: ${origin.stack}` : ''
				}`;
			})
		);
		this.formatters.set(DefaultFormatters.JSON, json({ space: 4 }));
		this.formatters.set(DefaultFormatters.PRETTY_PRINT, prettyPrint({ depth: 3 }));
	}

	private static defineFormattedLevels(levels: Record<keyof SyslogConfigSetLevels, keyof SyslogConfigSetLevels | string>): void {
		levels.debug = 'debug';
		levels.info = 'info';
		levels.notice = 'info';
		levels.warning = chalk.underline('warning');
		levels.error = chalk.bold('error');
		levels.crit = chalk.underline(chalk.bold('crit'));
		levels.alert = chalk.underline(chalk.bold('alert'));
		levels.emerg = chalk.underline(chalk.bold('emerg'));
	}

	private static defineFormattedLabels(formattedLabels: Record<string, string>): void {
		formattedLabels[Library.ASYNC] = chalk.italic(chalk.bgKeyword('silver')(Library.ASYNC));
		formattedLabels[Library.AUTHENTICATION] = chalk.italic(chalk.bgKeyword('gray')(Library.AUTHENTICATION));
		formattedLabels[Library.CACHE] = chalk.italic(chalk.bgKeyword('white')(Library.CACHE));
		formattedLabels[Library.COOKIE_SESSION] = chalk.italic(chalk.bgKeyword('maroon')(Library.COOKIE_SESSION));
		formattedLabels[Library.INDEXED_STORE] = chalk.italic(chalk.bgKeyword('red')(Library.INDEXED_STORE));
		formattedLabels[Library.COLLECTION] = chalk.italic(chalk.bgKeyword('purple')(Library.COLLECTION));
		formattedLabels[Library.HEAP] = chalk.italic(chalk.bgKeyword('fuchsia')(Library.HEAP));
		formattedLabels[Library.GEO_IP] = chalk.italic(chalk.bgKeyword('lime')(Library.GEO_IP));
		formattedLabels[Library.JWT_SESSION] = chalk.italic(chalk.bgKeyword('green')(Library.JWT_SESSION));
		formattedLabels[Library.POOL] = chalk.italic(chalk.bgKeyword('olive')(Library.POOL));
		formattedLabels[Library.SMS_CLIENT] = chalk.italic(chalk.bgKeyword('navy')(Library.SMS_CLIENT));
		formattedLabels[Library.UNIT_TEST] = chalk.italic(chalk.bgKeyword('blue')(Library.UNIT_TEST));
		formattedLabels[Library.UTILS] = chalk.italic(chalk.bgKeyword('orange')(Library.UTILS));

		formattedLabels[CoreModule.JWT_SESSION] = chalk.italic(chalk.bgKeyword('teal')(CoreModule.JWT_SESSION));
		formattedLabels[CoreModule.COOKIE_SESSION] = chalk.italic(chalk.bgKeyword('aqua')(CoreModule.COOKIE_SESSION));

		formattedLabels[Client.MYSQL] = chalk.italic(chalk.bgKeyword('silver')(Client.MYSQL));
		formattedLabels[Client.SMS] = chalk.italic(chalk.bgKeyword('maroon')(Client.SMS));
		formattedLabels[Client.REDIS] = chalk.italic(chalk.bgKeyword('gray')(Client.REDIS));
		formattedLabels[Client.EMAIL] = chalk.italic(chalk.bgKeyword('purple')(Client.EMAIL));
	}
}

export { FormattingManager, OutputFormat, DefaultFormatters };
