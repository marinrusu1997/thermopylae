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
	PRETTY_PRINT = 'PRETTY_PRINT',
	LOGSTASH = 'LOGSTASH',
	SIMPLE = 'SIMPLE'
}

const enum DefaultFormatters {
	TIMESTAMP = 'timestamp',
	ALIGN = 'align',
	ERRORS = 'errors',
	SPLAT = 'splat',
	COLORIZE = 'colorize',
	LABEL_STYLE = 'label_style',
	LABEL_FILTER = 'label_filter',
	LABEL_LOG_LEVEL_FILTER = 'label_log_level_filter',
	LEVEL_STYLE = 'level_style',
	PRINTF = 'printf',
	JSON = 'json',
	PRETTY_PRINT = 'prettyPrint',
	LOGSTASH = 'logstash',
	SIMPLE = 'simple'
}

/**
 * Options used when configuring default recipe for a given {@link OutputFormat}.
 */
interface DefaultRecipeOptions {
	/**
	 * Whether output needs to be colored.
	 */
	readonly colorize?: boolean;
	/**
	 * Logs that contain these labels will be ignored and not printed.
	 */
	readonly ignoredLabels?: ReadonlySet<string>;
	/**
	 * Specify log level for label. <br/>
	 * When label has no specified level, it will default to transport log level.
	 */
	readonly levelForLabel?: Readonly<Record<string, keyof SyslogConfigSetLevels>>;
	/**
	 * Formatters that don't need to be included in the pipeline.
	 */
	readonly skippedFormatters?: ReadonlySet<DefaultFormatters>;
}

type Formatter = DefaultFormatters | string;

type FormattedLabels = Record<string, string>;
type FormattedLevels = Record<keyof SyslogConfigSetLevels, keyof SyslogConfigSetLevels | string>;

/**
 * Class responsible for formatters managing. <br>
 * It is required that formatting is configured before getting a logger instance.
 */
class FormattingManager {
	private static readonly LOG_LEVEL_TO_NUMBER: Readonly<Record<keyof SyslogConfigSetLevels, number>> = {
		emerg: 7,
		alert: 6,
		crit: 5,
		error: 4,
		warning: 3,
		notice: 2,
		info: 1,
		debug: 0
	};

	private readonly formatters: Map<Formatter, Format>;

	private readonly formattedLabels: FormattedLabels;

	private readonly formattedLevels: FormattedLevels;

	private readonly ignoredLabels: Set<string>;

	private readonly levelForLabel: Record<string, keyof SyslogConfigSetLevels>;

	private clusterNodeId: string | number | null;

	private recipe!: Nullable<Array<Formatter>>;

	/**
	 * Defines default formatters and sets the recipe for {@link OutputFormat.PRINTF}.
	 */
	public constructor() {
		this.formatters = new Map();
		this.defineFormatters();

		this.formattedLabels = {};
		this.formattedLevels = {};
		this.ignoredLabels = new Set<string>();
		this.levelForLabel = {};
		this.clusterNodeId = null;

		this.setDefaultRecipe(OutputFormat.PRINTF);
	}

	/**
	 * Set id of the node from cluster. <br/>
	 * This id will be included in each logged message.
	 *
	 * > **WARNING!**
	 * > This is supported only for {@link OutputFormat.PRINTF}.
	 *
	 * @param id	Cluster node id.
	 */
	public setClusterNodeId(id: string | number): void {
		this.clusterNodeId = id;
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
	 * @param   options    		Default recipe options.
	 */
	public setDefaultRecipe(outputFormat: OutputFormat, options: DefaultRecipeOptions = {}): void {
		const order = [];

		if (options.ignoredLabels) {
			for (const label of options.ignoredLabels) {
				this.ignoredLabels.add(label);
			}

			order.push(DefaultFormatters.LABEL_FILTER);
		}

		if (options.levelForLabel) {
			for (const [label, level] of Object.entries(options.levelForLabel)) {
				this.levelForLabel[label] = level;
			}

			order.push(DefaultFormatters.LABEL_LOG_LEVEL_FILTER);
		}

		if (options.skippedFormatters) {
			if (!options.skippedFormatters.has(DefaultFormatters.TIMESTAMP)) {
				order.push(DefaultFormatters.TIMESTAMP);
			}
			if (!options.skippedFormatters.has(DefaultFormatters.ERRORS) && outputFormat !== OutputFormat.PRINTF) {
				order.push(DefaultFormatters.ERRORS);
			}
			if (!options.skippedFormatters.has(DefaultFormatters.ALIGN)) {
				order.push(DefaultFormatters.ALIGN);
			}
		} else {
			order.push(DefaultFormatters.TIMESTAMP);
			if (outputFormat !== OutputFormat.PRINTF) {
				order.push(DefaultFormatters.ERRORS);
			}
			order.push(DefaultFormatters.ALIGN);
		}

		if (options.colorize) {
			FormattingManager.defineFormattedLabels(this.formattedLabels);
			FormattingManager.defineFormattedLevels(this.formattedLevels);

			order.push(DefaultFormatters.LABEL_STYLE);
			order.push(DefaultFormatters.LEVEL_STYLE);
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
			case OutputFormat.LOGSTASH:
				order.push(DefaultFormatters.LOGSTASH);
				break;
			case OutputFormat.SIMPLE:
				order.push(DefaultFormatters.SIMPLE);
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
		const { align, errors, splat, colorize, printf, json, prettyPrint, logstash, simple } = format;
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
		this.formatters.set(
			DefaultFormatters.LABEL_STYLE,
			format((info) => {
				info.label = this.formattedLabels[info.label];
				return info;
			})()
		);
		this.formatters.set(
			DefaultFormatters.LABEL_FILTER,
			format((info) => {
				return this.ignoredLabels.has(info.label) ? false : info;
			})()
		);
		this.formatters.set(
			DefaultFormatters.LABEL_LOG_LEVEL_FILTER,
			format((info) =>
				FormattingManager.LOG_LEVEL_TO_NUMBER[info.level] < FormattingManager.LOG_LEVEL_TO_NUMBER[this.levelForLabel[info.label]] ? false : info
			)()
		);
		this.formatters.set(
			DefaultFormatters.LEVEL_STYLE,
			format((info) => {
				info.level = this.formattedLevels[info.level] as string;
				return info;
			})()
		);
		this.formatters.set(
			DefaultFormatters.PRINTF,
			printf((info) => {
				const { emitter, code, origin, data, level, stack, label, timestamp } = info;
				if (emitter && code) {
					info.message = `${info.message}; Emitter: ${emitter}; Code: ${code}; Data: ${JSON.stringify(data)}`;
				}

				return `${timestamp || ''}${this.clusterNodeId ? ` (${this.clusterNodeId})` : ''} [${label}] ${level}:${info.message || ''}${
					stack ? `\n${stack}` : ''
				}${origin instanceof Error ? `\nOrigin: ${origin.stack}` : ''}`;
			})
		);
		this.formatters.set(DefaultFormatters.JSON, json({ space: 4 }));
		this.formatters.set(DefaultFormatters.PRETTY_PRINT, prettyPrint({ depth: 3 }));
		this.formatters.set(DefaultFormatters.LOGSTASH, logstash());
		this.formatters.set(DefaultFormatters.SIMPLE, simple());
	}

	private static defineFormattedLevels(levels: FormattedLevels): void {
		levels.debug = 'debug';
		levels.info = 'info';
		levels.notice = 'info';
		levels.warning = chalk.underline('warning');
		levels.error = chalk.bold('error');
		levels.crit = chalk.underline(chalk.bold('crit'));
		levels.alert = chalk.underline(chalk.bold('alert'));
		levels.emerg = chalk.underline(chalk.bold('emerg'));
	}

	private static defineFormattedLabels(formattedLabels: FormattedLabels): void {
		formattedLabels[Library.ASYNC] = chalk.italic(chalk.bgKeyword('silver')(Library.ASYNC));
		formattedLabels[Library.AUTHENTICATION] = chalk.italic(chalk.bgKeyword('gray')(Library.AUTHENTICATION));
		formattedLabels[Library.CACHE] = chalk.italic(chalk.bgKeyword('white')(Library.CACHE));
		formattedLabels[Library.USER_SESSION] = chalk.italic(chalk.bgKeyword('maroon')(Library.USER_SESSION));
		formattedLabels[Library.INDEXED_STORE] = chalk.italic(chalk.bgKeyword('red')(Library.INDEXED_STORE));
		formattedLabels[Library.COLLECTION] = chalk.italic(chalk.bgKeyword('purple')(Library.COLLECTION));
		formattedLabels[Library.HEAP] = chalk.italic(chalk.bgKeyword('fuchsia')(Library.HEAP));
		formattedLabels[Library.GEO_IP] = chalk.italic(chalk.bgKeyword('lime')(Library.GEO_IP));
		formattedLabels[Library.JWT_USER_SESSION] = chalk.italic(chalk.bgKeyword('green')(Library.JWT_USER_SESSION));
		formattedLabels[Library.POOL] = chalk.italic(chalk.bgKeyword('olive')(Library.POOL));
		formattedLabels[Library.SMS_CLIENT] = chalk.italic(chalk.bgKeyword('navy')(Library.SMS_CLIENT));
		formattedLabels[Library.UNIT_TEST] = chalk.italic(chalk.bgKeyword('blue')(Library.UNIT_TEST));
		formattedLabels[Library.UTILS] = chalk.italic(chalk.bgKeyword('orange')(Library.UTILS));

		formattedLabels[CoreModule.JWT_USER_SESSION] = chalk.italic(chalk.bgKeyword('teal')(CoreModule.JWT_USER_SESSION));
		formattedLabels[CoreModule.COOKIE_USER_SESSION] = chalk.italic(chalk.bgKeyword('aqua')(CoreModule.COOKIE_USER_SESSION));

		formattedLabels[Client.MYSQL] = chalk.italic(chalk.bgKeyword('silver')(Client.MYSQL));
		formattedLabels[Client.SMS] = chalk.italic(chalk.bgKeyword('maroon')(Client.SMS));
		formattedLabels[Client.REDIS] = chalk.italic(chalk.bgKeyword('gray')(Client.REDIS));
		formattedLabels[Client.EMAIL] = chalk.italic(chalk.bgKeyword('purple')(Client.EMAIL));
	}
}

export { FormattingManager, OutputFormat, DefaultFormatters };
