import type { JwtSessionManagerOptions, JwtPayload, JwtSignOptions } from '@thermopylae/lib.jwt-session';
import { JwtSessionManager } from '@thermopylae/lib.jwt-session';
import { HttpRequest, HttpResponse } from '@thermopylae/core.declarations';

interface JwtUserSessionMiddlewareOptions {
	jwt: JwtSessionManagerOptions;
}

class JwtUserSessionMiddleware {
	private readonly jwtSessionManager: JwtSessionManager;

	public constructor(options: JwtUserSessionMiddlewareOptions) {
		this.jwtSessionManager = new JwtSessionManager(options.jwt);
	}

	public get sessionManager(): JwtSessionManager {
		return this.jwtSessionManager;
	}

	public async create(jwtPayload: JwtPayload, signOptions: JwtSignOptions, req: HttpRequest, res: HttpResponse): Promise<void> {
		const sessionTokens = await this.jwtSessionManager.create(jwtPayload, signOptions, {});
	}
}

export { HttpJwtUserSession };
