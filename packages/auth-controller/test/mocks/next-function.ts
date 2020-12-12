import { NextFunction } from 'express';

interface ExpressNextFunction {
	next: NextFunction;
	calls: number;
	args: Array<Array<any>>;
}

function expressNextFunctionFactory(): ExpressNextFunction {
	const expressNextFunction = {
		calls: 0,
		args: [],
		next(...args: any[]) {
			// @ts-ignore
			this.calls += 1;
			// @ts-ignore
			this.args.push(args);
		}
	};
	expressNextFunction.next = expressNextFunction.next.bind(expressNextFunction);
	return expressNextFunction;
}

export { expressNextFunctionFactory, ExpressNextFunction };
