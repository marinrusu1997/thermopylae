import { IIssuedJWTPayload, Jwt } from '@marin/lib.jwt';
import { AuthTokenType } from '@marin/lib.utils/dist/declarations';
import { chrono } from '@marin/lib.utils';
import { AuthenticationEntryPointEntity, ActiveUserSessionEntity } from '../types/entities';
import { createException, ErrorCodes } from '../error';
import { ScheduleActiveUserSessionDeletion } from '../types/schedulers';
import { BasicLocation } from '../types/basic-types';
import { ActiveUserSession, AuthenticationEntryPointModel } from '../types/models';

class UserSessionsManager {
	private readonly scheduleActiveUserSessionDeletion: ScheduleActiveUserSessionDeletion;

	private readonly jwt: Jwt;

	private readonly jwtRolesTtl?: Map<string, number>;

	private readonly activeUserSessionEntity: ActiveUserSessionEntity;

	private readonly accessPointEntity: AuthenticationEntryPointEntity;

	constructor(
		scheduleActiveUserSessionDeletion: ScheduleActiveUserSessionDeletion,
		jwt: Jwt,
		activeUserSessionEntity: ActiveUserSessionEntity,
		accessPointEntity: AuthenticationEntryPointEntity,
		jwtRolesTtl?: Map<string, number>
	) {
		this.scheduleActiveUserSessionDeletion = scheduleActiveUserSessionDeletion;
		this.jwt = jwt;
		this.jwtRolesTtl = jwtRolesTtl;
		this.activeUserSessionEntity = activeUserSessionEntity;
		this.accessPointEntity = accessPointEntity;
	}

	public async create(ip: string, device: string, location: BasicLocation, accountId: string, accountRole?: string): Promise<string> {
		const iat = chrono.dateToUNIX();
		const ttl = this.jwtRolesTtl && accountRole ? this.jwtRolesTtl.get(accountRole) : this.jwt.blacklist().allTtl; // seconds
		if (!ttl) {
			throw createException(ErrorCodes.INVALID_CONFIG, `TTL for role ${accountRole} not present, and jwt blacklist not configured with @all ttl`);
		}
		const jwt = this.jwt.sign(
			{
				sub: accountId,
				aud: accountRole,
				type: AuthTokenType.BASIC
			},
			{
				expiresIn: ttl
			}
		);

		await Promise.all([
			this.accessPointEntity.create({ authenticatedAtUNIX: iat, accountId, ip, device, location }),
			this.activeUserSessionEntity.create({ authenticatedAtUNIX: iat, accountId }),
			this.scheduleActiveUserSessionDeletion(accountId, iat, chrono.dateFromUNIX(iat + ttl))
		]);

		return jwt;
	}

	public read(accountId: string): Promise<Array<ActiveUserSession & AuthenticationEntryPointModel>> {
		return this.activeUserSessionEntity.readAll(accountId);
	}

	public async delete(payload: IIssuedJWTPayload): Promise<number> {
		const ttl = this.jwtRolesTtl && payload.aud ? this.jwtRolesTtl.get(payload.aud) : undefined;
		await this.jwt.blacklist().revoke(payload, ttl);
		await this.activeUserSessionEntity.delete(payload.sub, payload.iat);
		return 1; // 1 session deleted
	}

	public async deleteAllButCurrent(accountId: string, accountRole: string | undefined, tokenIssuedAtTime: number): Promise<number> {
		const ttl = this.jwtRolesTtl && accountRole ? this.jwtRolesTtl.get(accountRole) : this.jwt.blacklist().allTtl; // seconds
		if (!ttl) {
			throw createException(ErrorCodes.JWT_TTL_NOT_FOUND, `Jwt ttl for account ${accountId} not found`);
		}

		const activeSessions = await this.activeUserSessionEntity.readAllButOne(accountId, tokenIssuedAtTime);
		const revokeTokenPromises = [];
		for (let i = 0; i < activeSessions.length; i++) {
			revokeTokenPromises.push(
				this.jwt.blacklist().revoke(
					{
						sub: accountId,
						aud: accountRole,
						iat: activeSessions[i].authenticatedAtUNIX,
						exp: activeSessions[i].authenticatedAtUNIX + ttl
					},
					ttl
				)
			);
		}
		await Promise.all(revokeTokenPromises);

		return this.activeUserSessionEntity.deleteAllButOne(accountId, tokenIssuedAtTime);
	}

	public deleteAll(accountId: string, accountRole?: string): Promise<number> {
		const ttl = this.jwtRolesTtl && accountRole ? this.jwtRolesTtl.get(accountRole) : undefined;
		return this.jwt
			.blacklist()
			.purge(accountId, accountRole, ttl)
			.then(() => this.activeUserSessionEntity.deleteAll(accountId));
	}
}

export { UserSessionsManager };
