import { before } from 'mocha';
import Logger, { FormattingManager } from '../../lib.logger.bk';

before(() => {
	Logger.console.setConfig({ level: 'warning' });
	Logger.formatting.applyOrderFor(FormattingManager.OutputFormat.PRINTF, true);
});
