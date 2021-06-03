import uidSafe from 'uid-safe';

class TokenManager {
	private readonly length: number;

	public constructor(length: number) {
		this.length = length;
	}

	public async issueEncoded(accountId: string): Promise<string> {
		const token = await uidSafe(this.length);
		return `${token}${accountId}`;
	}

	public decode(token: string): [string, string] {
		return [token.slice(0, this.length), token.slice(this.length)];
	}
}

export { TokenManager };
