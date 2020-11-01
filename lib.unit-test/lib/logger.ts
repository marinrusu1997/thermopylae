import { LoggerInstance, OutputFormat } from '@thermopylae/lib.logger';
import { Library } from '@thermopylae/core.declarations';

/**
 * Logger needs to be configured once by entity who knows environment code runs on.
 * For unit tests, logger is used in test environment, therefore this library is responsible for it's configuration.
 * Since this library is used only for test purposes, it won't clash with application loader,
 * responsible for libraries configuration on production environment.
 */

LoggerInstance.formatting.setDefaultRecipe(OutputFormat.PRINTF, true);
LoggerInstance.console.createTransport({ level: process.env.LOG_LEVEL || 'info' });

const UnitTestLogger = LoggerInstance.for(Library.UNIT_TEST);

export { UnitTestLogger };
