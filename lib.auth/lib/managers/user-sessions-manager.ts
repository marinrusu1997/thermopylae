// eslint-disable-next-line import/no-extraneous-dependencies
import { IIssuedJWTPayload, Jwt } from '@marin/lib.jwt/lib';
import { enums, chrono } from '@marin/lib.utils';
import geo from 'geoip-lite';
import { AccessPointEntity, ActiveUserSessionEntity } from '../models/entities';
import { Account } from '../models';
import { ActiveUserSession } from '../models/sessions';
import { createException, ErrorCodes } from '../error';
import { ScheduleActiveUserSessionDeletion } from '../models/schedulers';

class UserSessionsManager {
	private readonly scheduleDeletion: ScheduleActiveUserSessionDeletion;
	private readonly jwt: Jwt;
	private readonly jwtRolesTtl?: Map<string, number>;
	private readonly activeUserSessionEntity: ActiveUserSessionEntity;
	private readonly accessPointEntity: AccessPointEntity;

	constructor(
		scheduleDeletion: ScheduleActiveUserSessionDeletion,
		jwt: Jwt,
		jwtRolesTtl: Map<string, number>,
		activeUserSessionEntity: ActiveUserSessionEntity,
		accessPointEntity: AccessPointEntity
	) {
		this.scheduleDeletion = scheduleDeletion;
		this.jwt = jwt;
		this.jwtRolesTtl = jwtRolesTtl;
		this.activeUserSessionEntity = activeUserSessionEntity;
		this.accessPointEntity = accessPointEntity;
	}

	public async create(account: Account, ip: string, device: string): Promise<string> {
		const iat = chrono.nowInSeconds();
		const ttl = this.jwtRolesTtl && account.role ? this.jwtRolesTtl.get(account.role) : this.jwt.blacklist().allTtl(); // seconds
		if (!ttl) {
			throw createException(ErrorCodes.INVALID_CONFIG, `TTL for role ${account.role} not present, and jwt blacklist not configured with @all ttl`);
		}
		const jwt = this.jwt.sign(
			{
				sub: account.id!,
				aud: account.role,
				type: enums.AUTH_TOKEN_TYPE.BASIC
			},
			{
				expiresIn: ttl
			}
		);

		const location = geo.lookup(ip);
		await Promise.all([
			this.accessPointEntity.create({ id: iat, accountId: account.id!, ip, device, location: JSON.stringify(location) }),
			this.activeUserSessionEntity.create({ id: iat, accountId: account.id! })
		]);

		this.scheduleDeletion(iat, chrono.dateFromSeconds(iat + ttl));

		return jwt;
	}

	public read(accountId: string): Promise<Array<ActiveUserSession>> {
		return this.activeUserSessionEntity.readAll(accountId);
	}

	public delete(payload: IIssuedJWTPayload): Promise<void> {
		const ttl = this.jwtRolesTtl && payload.aud ? this.jwtRolesTtl.get(payload.aud) : undefined;
		return this.jwt
			.blacklist()
			.revoke(payload, ttl)
			.then(() => this.activeUserSessionEntity.delete(payload.iat));
	}

	public deleteAll(account: Account): Promise<number> {
		const ttl = this.jwtRolesTtl && account.role ? this.jwtRolesTtl.get(account.role) : undefined;
		return this.jwt
			.blacklist()
			.purge(String(account.id), account.role, ttl)
			.then(() => this.activeUserSessionEntity.deleteAll(account.id!));
	}
}

export { UserSessionsManager };
