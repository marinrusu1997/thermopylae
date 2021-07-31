import { ClientModule, CoreModule, DevModule, Nullable } from '@thermopylae/core.declarations';
import { Format } from 'logform';
import { format } from 'winston';
// eslint-disable-next-line import/extensions
import type { SyslogConfigSetLevels } from 'winston/lib/winston/config';
import chalk from 'chalk';
import { createException, ErrorCodes } from './error';

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
 * Options used when configuring default formatting order for a given {@link OutputFormat}.
 */
interface DefaultFormattingOrderOptions {
	/**
	 * Whether output needs to be colored. <br/>
	 * Passing `true` will colorize only {@link ClientModule}, {@link CoreModule} and {@link DevModule} labels.
	 * If you need additional labels to be colorized, pass an object having label as key and color as value.
	 */
	readonly colorize?: boolean | Record<string, string>;
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
	readonly skippedFormatters?: ReadonlySet<DefaultFormatters.TIMESTAMP | DefaultFormatters.ERRORS | DefaultFormatters.ALIGN | string>;
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

	private formattingOrder!: Nullable<Array<Formatter>>;

	/**
	 * Defines default formatters.
	 */
	public constructor() {
		this.formatters = new Map();
		this.defineFormatters();

		this.formattedLabels = {};
		this.formattedLevels = {};
		this.ignoredLabels = new Set<string>();
		this.levelForLabel = {};
		this.clusterNodeId = null;
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
	 * Formatting order is discarded and needs to be reconfigured.
	 *
	 * @param   name        Name of the formatter.
	 * @param   formatter   Formatter instance, must be winston compliant.
	 */
	public setFormatter(name: Formatter, formatter: Format): void {
		this.formatters.set(name, formatter);
		this.formattingOrder = null;
	}

	/**
	 * Removes existing formatter from known formatters list. <br>
	 * Formatting order is discarded, reconfiguration is needed later.
	 *
	 * @param   name  Formatter name.
	 */
	public removeFormatter(name: Formatter): void {
		this.formatters.delete(name);
		this.formattingOrder = null;
	}

	/**
	 * Specifies a custom formatting order which instructs in which order formatters needs to be combined.
	 *
	 * @param order	List of formatter names.
	 */
	public setCustomFormattingOrder(order: Array<Formatter>): void {
		if (this.formattingOrder != null) {
			throw createException(ErrorCodes.FORMATTING_ORDER_EXISTS, 'Formatting order has been configured already.');
		}
		this.formattingOrder = order;
	}

	/**
	 * Configures a formatting order from a predefined set of formatters. <br>
	 * If a order exists, it will be rewritten.
	 *
	 * @param   outputFormat    Logs output format for which order needs to be constructed.
	 * @param   options    		Default formatting options.
	 */
	public setDefaultFormattingOrder(outputFormat: OutputFormat, options: DefaultFormattingOrderOptions = {}): void {
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

			if (typeof options.colorize === 'object') {
				// eslint-disable-next-line guard-for-in
				for (const label in options.colorize) {
					FormattingManager.defineFormattedLabel(this.formattedLabels, label, options.colorize[label]);
				}
			}

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
				throw createException(ErrorCodes.UNKNOWN_OUTPUT_FORMAT, `Unknown output format: ${outputFormat}.`);
		}

		this.formattingOrder = order;
	}

	/**
	 * Returns a formatter object for winston, which combines all known formatters. <br>
	 * Formatters order will follow the order specified by either {@link FormattingManager.setCustomFormattingOrder}, or {@link FormattingManager.setDefaultFormattingOrder}. <br>
	 * Label formatter will be set based on module name. <br>
	 *
	 * @param   module   	Name of the module formatting will be applied for.
	 */
	public formatterFor(module: string): Format {
		const { combine, label } = format;

		if (this.formattingOrder == null) {
			throw createException(ErrorCodes.FORMATTING_ORDER_NOT_CONFIGURED, 'Formatting order is not configured.');
		}

		const stagedFormatters = [label({ label: module })];

		let formatter;
		for (let i = 0; i < this.formattingOrder.length; i += 1) {
			formatter = this.formatters.get(this.formattingOrder[i]);
			if (!formatter) {
				throw createException(ErrorCodes.FORMATTER_NOT_REGISTERED, `Formatter '${this.formattingOrder[i]}' from the order is not registered.`);
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
				info['label'] = this.formattedLabels[info['label']];
				return info;
			})()
		);
		this.formatters.set(
			DefaultFormatters.LABEL_FILTER,
			format((info) => {
				return this.ignoredLabels.has(info['label']) ? false : info;
			})()
		);
		this.formatters.set(
			DefaultFormatters.LABEL_LOG_LEVEL_FILTER,
			format((info) =>
				FormattingManager.LOG_LEVEL_TO_NUMBER[info.level] < FormattingManager.LOG_LEVEL_TO_NUMBER[this.levelForLabel[info['label']]] ? false : info
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
		levels['debug'] = 'debug';
		levels['info'] = 'info';
		levels['notice'] = 'info';
		levels['warning'] = chalk.underline('warning');
		levels['error'] = chalk.bold('error');
		levels['crit'] = chalk.underline(chalk.bold('crit'));
		levels['alert'] = chalk.underline(chalk.bold('alert'));
		levels['emerg'] = chalk.underline(chalk.bold('emerg'));
	}

	private static defineFormattedLabels(formattedLabels: FormattedLabels): void {
		formattedLabels[CoreModule.AUTHENTICATION] = chalk.italic(chalk.bgKeyword('lime')(CoreModule.AUTHENTICATION));
		formattedLabels[CoreModule.USER_SESSION_COMMONS] = chalk.italic(chalk.bgKeyword('purple')(CoreModule.USER_SESSION_COMMONS));
		formattedLabels[CoreModule.JWT_USER_SESSION] = chalk.italic(chalk.bgKeyword('teal')(CoreModule.JWT_USER_SESSION));
		formattedLabels[CoreModule.COOKIE_USER_SESSION] = chalk.italic(chalk.bgKeyword('orange')(CoreModule.COOKIE_USER_SESSION));

		formattedLabels[ClientModule.MYSQL] = chalk.italic(chalk.bgKeyword('maroon')(ClientModule.MYSQL));
		formattedLabels[ClientModule.REDIS] = chalk.italic(chalk.bgKeyword('gray')(ClientModule.REDIS));

		formattedLabels[DevModule.UNIT_TESTING] = chalk.italic(chalk.bgKeyword('green')(DevModule.UNIT_TESTING));
	}

	private static defineFormattedLabel(formattedLabels: FormattedLabels, label: string, color: string): void {
		formattedLabels[label] = chalk.italic(chalk.bgKeyword(color)(label));
	}
}

export { FormattingManager, OutputFormat, DefaultFormatters };
