import { describe, it } from 'mocha';
import { chai } from './chai';
import { MethodInvoker } from '@marin/lib.utils';

const { expect } = chai;

class Cl {
	async print (arg) {
		return console.log(arg);
	}
}

describe('sum', () => {
	it('compare tokens', async () => {
		const cl = new Cl();
		await new MethodInvoker(cl.print, "arg")
			.onErrMsg('fail').logger(console).safeInvokeAsync();
	});
});
