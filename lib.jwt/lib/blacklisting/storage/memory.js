import { Heap } from 'typescript-collections';
import { nowInSeconds } from '../../utils';

const storage = new WeakMap();
/**
 * Private class data
 *
 * @param {Object} _this This of the class
 * @return {{
 *     separator: string,
 *     blackMap: Map<string, {subjects: Map<string, IBlacklistModel>}>,
 *     tracked: Heap<{wtr: number, key: string}>
 * }}
 */
const internal = _this => {
	let data = storage.get(_this);
	if (!data) {
		data = {};
		storage.set(_this, data);
	}
	return data;
};

/**
 * Performs clean up of expired jwt for one subject
 *
 * @param {Object}  tokens Blacklisted tokens of the subject
 * @param {number}  tokens.wtr When to remove timestamp
 * @param {string}     tokens.key Key formed by concatenation of audience and subject
 */
function eraseExpiredJWTs(tokens) {
	const { separator, blackMap } = this;
	const { wtr, key } = tokens;
	const [audience, subject] = key.split(separator);
	const category = blackMap.get(audience);
	if (!category) {
		return;
	}
	const blacklist = category.subjects.get(subject);
	if (!blacklist) {
		return;
	}
	const watermark = wtr - category.ttl;
	if (blacklist.purge && blacklist.purge <= watermark) {
		blacklist.purge = undefined;
	}
	if (blacklist.revoke) {
		blacklist.revoke = blacklist.revoke.filter(iat => iat > watermark);
		if (blacklist.revoke.length) {
			return;
		}
	}
	if (!blacklist.purge) {
		category.subjects.delete(subject);
	}
}

/**
 * Starts GC after specified amount of time
 *
 * @param {number} delay Delay in seconds from current timestamp
 */
function startGC(delay) {
	setTimeout(
		function cleanup() {
			const { tracked } = this;
			let toRemove = tracked.peek();
			if (!toRemove) {
				return;
			}
			const { wtr } = toRemove;
			do {
				eraseExpiredJWTs.call(this, toRemove);
				tracked.removeRoot();
				toRemove = tracked.peek();
				if (toRemove && toRemove.wtr !== wtr) {
					toRemove = null;
				}
			} while (toRemove);
			toRemove = tracked.peek();
			if (toRemove) {
				startGC.call(this, toRemove.wtr - nowInSeconds());
			}
		}.bind(this),
		delay * 1000
	);
}

/**
 * Internal operation for revoking and purging
 *
 * @param {string} audience Audience of the token
 * @param {string} subject User of the token
 * @param {number} timestamp A timestamp defining when token was issued or when all tokens should considered as purged
 * @param {string} optype Type of the operation (`revoke` | `purge`)
 * @return {void}
 * @throws {Error}
 */
function operation(audience, subject, timestamp, optype) {
	const { separator, blackMap, tracked } = this;

	const category = blackMap.get(audience);
	if (!category) {
		throw new Error(`Audience ${audience} not defined`);
	}

	if (
		!tracked.add({
			wtr: nowInSeconds() + category.ttl,
			key: `${audience}${separator}${subject}`
		})
	) {
		throw new Error('Failed to add token to internal free list');
	}

	let tokens = category.subjects.get(subject);

	if (optype === 'revoke') {
		if (!tokens) {
			tokens = {
				revoke: [timestamp]
			};
			category.subjects.set(subject, tokens);
		} else {
			tokens.revoke.push(timestamp);
		}
	} else if (optype === 'purge') {
		if (!tokens) {
			tokens = {
				purge: timestamp
			};
			category.subjects.set(subject, tokens);
		} else {
			tokens.purge = timestamp;
		}
	} else {
		throw new Error(`Operation ${optype} not found`);
	}

	if (tracked.size() === 1) {
		startGC.call(this, category.ttl);
	}
}

/** Memory Storage
 *
 * @implements {IAbstractStorage}
 * */
class MemoryStorage {
	constructor() {
		const privateThis = internal(this);
		privateThis.separator = ' ';
		privateThis.blackMap = new Map();
		privateThis.tracked = new Heap((first, second) => {
			if (first.wtr < second.wtr) {
				return -1;
			}
			if (first.wtr > second.wtr) {
				return 1;
			}
			return 0;
		});
	}

	async has(query) {
		const { blackMap } = internal(this);
		const blacklisted = blackMap.get(query.audience);
		if (!blacklisted) {
			throw new Error(`Audience ${query.audience} was not defined`);
		}
		const subject = blacklisted.subjects.get(query.subject);
		if (!subject) {
			return false;
		}
		return !!(
			(subject.purge && query.issued <= subject.purge) ||
			(subject.revoke && subject.revoke.indexOf(query.issued) !== -1)
		);
	}

	async defineAudience(audience, ttl) {
		const { separator, blackMap } = internal(this);
		if (audience.indexOf(separator) > -1) {
			throw new Error(`Audience cannot contain '${separator}' character`);
		}
		if (blackMap.has(audience)) {
			throw new Error(`Audience ${audience} was defined already`);
		}
		blackMap.set(audience, {
			subjects: new Map(),
			ttl
		});
	}

	async revoke(audience, subject, issuedAt) {
		operation.call(internal(this), audience, subject, issuedAt, 'revoke');
	}

	async purge(audience, subject) {
		operation.call(internal(this), audience, subject, nowInSeconds(), 'purge');
	}

	async clear(tokens) {
		const { blackMap, tracked } = internal(this);
		if (!tokens) {
			blackMap.clear();
			tracked.clear();
		} else {
			tokens.forEach((subjects, audience) => {
				const category = blackMap.get(audience);
				if (category) {
					subjects.forEach(subject => category.subjects.delete(subject));
					if (!category.subjects.size) {
						blackMap.delete(audience);
					}
				}
			});
		}
	}
}

export default MemoryStorage;
export { MemoryStorage };
