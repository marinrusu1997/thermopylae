import type { AsyncFunction, SyncFunction, Undefinable } from '@thermopylae/core.declarations';
import { Exception } from '@thermopylae/lib.exception';

type ErrorHandler = (error: Error | Exception) => void;

class MethodInvoker<I, O> {
	private readonly func: SyncFunction<I, O> | AsyncFunction<I, O>;

	private readonly args: Array<I>;

	private thisArgument: Record<string, unknown> | null;

	private errorHandler?: ErrorHandler;

	constructor(func: SyncFunction | AsyncFunction, ...args: Array<I>) {
		this.func = func;
		this.args = args;
		this.thisArgument = null;
	}

	thisArg(thisArgument: Record<string, unknown>): MethodInvoker<I, O> {
		this.thisArgument = thisArgument;
		return this;
	}

	errHandler(errorHandler: ErrorHandler): MethodInvoker<I, O> {
		this.errorHandler = errorHandler;
		return this;
	}

	safeInvokeSync(): Undefinable<O> {
		let res: Undefinable<O>;
		try {
			res = (this.func as SyncFunction<I, O>).apply(this.thisArgument, this.args);
		} catch (error) {
			/* istanbul ignore else */
			if (this.errorHandler) {
				this.errorHandler(error as Error);
			}
		}
		return res;
	}

	async safeInvokeAsync(): Promise<Undefinable<O>> {
		let res: Undefinable<O>;
		try {
			res = await (this.func as AsyncFunction<I, O>).apply(this.thisArgument, this.args);
		} catch (error) {
			/* istanbul ignore else */
			if (this.errorHandler) {
				this.errorHandler(error as Error);
			}
		}
		return res;
	}
}

export { MethodInvoker };
export type { ErrorHandler };
