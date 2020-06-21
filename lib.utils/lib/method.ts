import { AsyncFunction, SyncFunction } from '@thermopylae/core.declarations';
import { Exception } from '@thermopylae/lib.exception';

type ErrorHandler = (error: Error | Exception) => void;

class MethodInvoker {
	private readonly func: SyncFunction | AsyncFunction;

	private readonly args: Array<any>;

	private thisArgument: Record<string, unknown> | null;

	private errorHandler?: ErrorHandler;

	constructor(func: SyncFunction | AsyncFunction, ...args: Array<any>) {
		this.func = func;
		this.args = args;
		this.thisArgument = null;
	}

	thisArg(thisArgument: Record<string, unknown>): MethodInvoker {
		this.thisArgument = thisArgument;
		return this;
	}

	errHandler(errorHandler: ErrorHandler): MethodInvoker {
		this.errorHandler = errorHandler;
		return this;
	}

	safeInvokeSync(): any | undefined {
		let res: any | undefined;
		try {
			res = this.func.apply(this.thisArgument, this.args);
		} catch (error) {
			/* istanbul ignore else */
			if (this.errorHandler) {
				this.errorHandler(error);
			}
		}
		return res;
	}

	async safeInvokeAsync(): Promise<any | undefined> {
		let res: any | undefined;
		try {
			res = await this.func.apply(this.thisArgument, this.args);
		} catch (error) {
			/* istanbul ignore else */
			if (this.errorHandler) {
				this.errorHandler(error);
			}
		}
		return res;
	}
}

export { MethodInvoker };
