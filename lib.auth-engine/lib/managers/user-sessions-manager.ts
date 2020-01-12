// eslint-disable-next-line import/no-extraneous-dependencies
import { IIssuedJWTPayload, Jwt } from '@marin/lib.jwt';
import { enums, chrono } from '@marin/lib.utils';
import { AccessPointEntity, ActiveUserSessionEntity } from '../models/entities';
import { ActiveUserSession } from '../models/sessions';
import { createException, ErrorCodes } from '../error';
import { ScheduleActiveUserSessionDeletion } from '../models/schedulers';
import { BasicLocation } from '../types';
import { AccessPoint } from '../models';

class UserSessionsManager {
	private readonly scheduleActiveUserSessionDeletion: ScheduleActiveUserSessionDeletion;
	private readonly jwt: Jwt;
	private readonly jwtRolesTtl?: Map<string, number>;
	private readonly activeUserSessionEntity: ActiveUserSessionEntity;
	private readonly accessPointEntity: AccessPointEntity;

	constructor(
		scheduleActiveUserSessionDeletion: ScheduleActiveUserSessionDeletion,
		jwt: Jwt,
		activeUserSessionEntity: ActiveUserSessionEntity,
		accessPointEntity: AccessPointEntity,
		jwtRolesTtl?: Map<string, number>
	) {
		this.scheduleActiveUserSessionDeletion = scheduleActiveUserSessionDeletion;
		this.jwt = jwt;
		this.jwtRolesTtl = jwtRolesTtl;
		this.activeUserSessionEntity = activeUserSessionEntity;
		this.accessPointEntity = accessPointEntity;
	}

	public async create(ip: string, device: string, location: BasicLocation, accountId: string, accountRole?: string): Promise<string> {
		const iat = chrono.nowInSeconds();
		const ttl = this.jwtRolesTtl && accountRole ? this.jwtRolesTtl.get(accountRole) : this.jwt.blacklist().allTtl; // seconds
		if (!ttl) {
			throw createException(ErrorCodes.INVALID_CONFIG, `TTL for role ${accountRole} not present, and jwt blacklist not configured with @all ttl`);
		}
		const jwt = this.jwt.sign(
			{
				sub: accountId,
				aud: accountRole,
				type: enums.AUTH_TOKEN_TYPE.BASIC
			},
			{
				expiresIn: ttl
			}
		);

		await Promise.all([
			this.accessPointEntity.create({ timestamp: iat, accountId, ip, device, location }),
			this.activeUserSessionEntity.create({ timestamp: iat, accountId })
		]);

		this.scheduleActiveUserSessionDeletion(accountId, iat, chrono.dateFromSeconds(iat + ttl));

		return jwt;
	}

	public read(accountId: string): Promise<Array<ActiveUserSession & AccessPoint>> {
		return this.activeUserSessionEntity.readAll(accountId);
	}

	public delete(payload: IIssuedJWTPayload): Promise<void> {
		const ttl = this.jwtRolesTtl && payload.aud ? this.jwtRolesTtl.get(payload.aud) : undefined;
		return this.jwt
			.blacklist()
			.revoke(payload, ttl)
			.then(() => this.activeUserSessionEntity.delete(payload.sub, payload.iat));
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
