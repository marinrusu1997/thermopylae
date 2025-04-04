import type { BaseContext } from '@thermopylae/lib.authentication';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

function stringifyOperationContext(context: BaseContext): string {
	return `Context: ip ${context.ip}, device ${JSON.stringify(context.device)}, location ${JSON.stringify(context.location)}.`;
}

function __dirname(metaUrl: string) {
	return dirname(fileURLToPath(metaUrl));
}

export { stringifyOperationContext, __dirname };
