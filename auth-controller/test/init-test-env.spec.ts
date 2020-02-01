import { before } from 'mocha';
import Logger, { FormattingManager } from '@marin/lib.logger';

before(() => {
	Logger.console.setConfig({ level: 'warning' });
	Logger.formatting.applyOrderFor(FormattingManager.OutputFormat.PRINTF, true);
});
