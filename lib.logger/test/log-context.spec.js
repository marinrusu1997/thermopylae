import { describe, it } from 'mocha';
import { LOG_CTX_COMPONENTS } from '@marin/lib.utils';
import { chai } from './chai';
import { LogContext } from '../lib/log-context';

const { expect } = chai;

describe('lib utils spec', () => {
	it('converts context object into a string', () => {
		const context = {
			[LOG_CTX_COMPONENTS.ACTION]: 'ACTION',
			[LOG_CTX_COMPONENTS.RESOURCE]: 'RESOURCE',
			[LOG_CTX_COMPONENTS.VARIABLES]: { var1: 'val1', var2: { var21: 'val21' }, var3: 1, var4: null },
			[LOG_CTX_COMPONENTS.STATUS]: 'FAILED'
		};
		const logCtx = LogContext.from(LogContext.from(context).toString());
		expect(logCtx.action()).to.be.equal(context[LOG_CTX_COMPONENTS.ACTION]);
		expect(logCtx.resource()).to.be.equal(context[LOG_CTX_COMPONENTS.RESOURCE]);
		expect(logCtx.variables()).to.be.deep.equal(context[LOG_CTX_COMPONENTS.VARIABLES]);
		expect(logCtx.variables()).to.be.deep.equal(context[LOG_CTX_COMPONENTS.VARIABLES]);
		expect(logCtx.status()).to.be.equal(context[LOG_CTX_COMPONENTS.STATUS]);
	});
});
