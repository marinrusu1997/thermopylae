import { ErrorCodes, Nullable } from '@thermopylae/core.declarations';
import { Format } from 'logform';
import { format } from 'winston';
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

	private recipe!: Nullable<Array<Formatter>>;

	/**
	 * Defines default formatters and sets the recipe for {@link OutputFormat.PRINTF}.
	 */
	public constructor() {
		this.formatters = new Map();
		FormattingManager.defineFormatters(this.formatters);
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
	 *
	 * @private
	 *
	 * @param formatters  Internal formatters map.
	 */
	private static defineFormatters(formatters: Map<Formatter, Format>): void {
		const { align, errors, splat, colorize, printf, json, prettyPrint } = format;
		formatters.set(
			DefaultFormatters.TIMESTAMP,
			format.timestamp({
				format: 'YYYY-MM-DD HH:mm:ss:SSS'
			})
		);
		formatters.set(DefaultFormatters.ALIGN, align());
		formatters.set(DefaultFormatters.ERRORS, errors({ stack: true }));
		formatters.set(DefaultFormatters.SPLAT, splat());
		formatters.set(
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
		formatters.set(
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
		formatters.set(DefaultFormatters.JSON, json({ space: 4 }));
		formatters.set(DefaultFormatters.PRETTY_PRINT, prettyPrint({ depth: 3 }));
	}
}

export { FormattingManager, OutputFormat, DefaultFormatters };
