import uidSafe from 'uid-safe';

/**
 * @private
 */
class TokenManager {
	private readonly length: number;

	private readonly actualTokenLength: number;

	public constructor(length: number) {
		this.length = length;
		this.actualTokenLength = uidSafe.sync(length).length;
	}

	public async issueEncodedWithAccountId(accountId: string): Promise<string> {
		const token = await uidSafe(this.length);
		return `${token}${accountId}`;
	}

	public decode(token: string): [string, string] {
		return [token.slice(0, this.actualTokenLength), token.slice(this.actualTokenLength)];
	}

	public extractAccountId(token: string): string {
		return token.slice(this.actualTokenLength);
	}
}

export { TokenManager };
