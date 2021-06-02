import uidSafe from 'uid-safe';
import type { AccountModel } from '../types/models';

class TokenManager<Account extends AccountModel> {
	private readonly length: number;

	public constructor(length: number) {
		this.length = length;
	}

	public async issueEncoded(account: Account): Promise<string> {
		const token = await uidSafe(this.length);
		return `${token}${account.id}`;
	}

	public decode(token: string): [string, string] {
		return [token.slice(0, this.length), token.slice(this.length)];
	}
}

export { TokenManager };
