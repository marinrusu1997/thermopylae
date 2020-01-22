import Exception from '@marin/lib.error';

type ErrorHandler = (error: Error | Exception) => void;

class MethodInvoker {
	private readonly func: Function;

	private readonly args: Array<any>;

	private thisArgument: object | null;

	private errorHandler?: ErrorHandler;

	constructor(func: Function, ...args: Array<any>) {
		this.func = func;
		this.args = args;
		this.thisArgument = null;
	}

	thisArg(thisArgument: object): MethodInvoker {
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
