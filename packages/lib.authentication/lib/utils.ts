import type { UnixTimestamp } from '@thermopylae/core.declarations';

function getCurrentTimestamp(): UnixTimestamp {
	return Math.floor(new Date().getTime() / 1000);
}

export { getCurrentTimestamp };
