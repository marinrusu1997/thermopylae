import { BaseContext } from '@thermopylae/lib.authentication';

function stringifyOperationContext(context: BaseContext): string {
	return `Context: ip ${context.ip}, device ${JSON.stringify(context.device)}, location ${JSON.stringify(context.location)}.`;
}

export { stringifyOperationContext };
