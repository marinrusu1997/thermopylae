import { describe, it, before } from 'mocha';
import chai from 'chai';
import { JsonWebTokenError } from 'jsonwebtoken';
import { chai as AsyncChai } from '../chai';
import { sleep } from '../utils';
import { Jwt } from '../../lib/auth/jwt';
import { MemoryStorage } from '../../lib/blacklisting/storage/memory';

describe('Jwt spec', () => {
	const { expect } = chai;
	const asyncExpect = AsyncChai.expect;
	const keys = {
		priv:
			'-----BEGIN RSA PRIVATE KEY-----\n' +
			'MIICWgIBAAKBgFzbKiyCwdeIoLSwOyPfota0OYBbk3eTWV59/QJXaU+xm+OVWkxI\n' +
			'TXjM/iCsg7ZHqfjIj9yLl0PJDSIPNwCJNzV2ZvwHLKtFj6dsnuTKjnG0oUkeis8Y\n' +
			'cUkW0yOLuCQRTl/xOs0ZEWUqJcjIJUisaWXJSGZqrP6YEL25UiEvODqfAgMBAAEC\n' +
			'gYAjvF0gwDnlvzlKEMDR75F12+p9UcERNe4hBY/HxOhMuWfrUGFuFi1qnkn3PS17\n' +
			'i10I1/c1w6s1dTzOrNhYJnbOb8yDWovahsKx4xISkUR96uEJFWDZ2CqVAkh76R9U\n' +
			'OnDew11i6z/JHjjF72GQpsoOohBEz+AL33wBsXNWds0oAQJBAJ2/uMg+/e9dIZm8\n' +
			'8kFbWYiMGxICFviTD53fY3Sh81QcAi4GX2rpt01cm1dfA5f6cnEuKOSj2XGmQOaa\n' +
			'wVqX7J8CQQCWsJvx5iKPvBZmn+AcR96MMTwIAgSftiQRWPFM/X4Aj3gMXRDNczXz\n' +
			'qi2fJOgqENOYGTI3FNHtB6LezfLRzvIBAkB5ajlFFwbIFzxnYgBrwW22JXAoeidI\n' +
			'B5i7gFbCTGxGzo/28Ly8Q0rsZlzB8MWJUiCHcGnVIS+Zw8asN2ye19QtAkAaDIOY\n' +
			'qGC3GhuBOAfku6PD9krbU4X7GeBYQ1jLJ1Ldw+9Lq9bYvR7JdVSXmyirBOee9lQQ\n' +
			'4396iwRjoZRlInIBAkBLdEeZbabwFm2ZePjdy+x6o5rdaIz+oIwkWQTGnfXLdZwe\n' +
			'odzeWc/0vaCI2ITmSw/o/1ZSeYX8plr3XIQR85PF\n' +
			'-----END RSA PRIVATE KEY-----',
		pub:
			'-----BEGIN PUBLIC KEY-----\n' +
			'MIGeMA0GCSqGSIb3DQEBAQUAA4GMADCBiAKBgFzbKiyCwdeIoLSwOyPfota0OYBb\n' +
			'k3eTWV59/QJXaU+xm+OVWkxITXjM/iCsg7ZHqfjIj9yLl0PJDSIPNwCJNzV2ZvwH\n' +
			'LKtFj6dsnuTKjnG0oUkeis8YcUkW0yOLuCQRTl/xOs0ZEWUqJcjIJUisaWXJSGZq\n' +
			'rP6YEL25UiEvODqfAgMBAAE=\n' +
			'-----END PUBLIC KEY-----'
	};

	describe('constructor function spec', () => {
		it('throws when secret has invalid format', () => {
			expect(() => new Jwt({})).to.throw('Invalid secret type');
			expect(() => new Jwt({ secret: null })).to.throw('Invalid secret type');
			expect(() => new Jwt({ secret: [] })).to.throw('Invalid secret type');
			expect(() => new Jwt({ secret: new MemoryStorage() })).to.throw('Invalid secret type');
			expect(() => new Jwt({ secret: {} })).to.throw('Invalid secret type');
			expect(() => new Jwt({ secret: { priv: [] } })).to.throw('Invalid secret type');
			expect(() => new Jwt({ secret: { priv: new MemoryStorage() } })).to.throw('Invalid secret type');
			expect(() => new Jwt({ secret: { priv: '' } })).to.throw('Invalid secret type');
			expect(() => new Jwt({ secret: { priv: '', pub: [] } })).to.throw('Invalid secret type');
			expect(() => new Jwt({ secret: { priv: '', pub: new MemoryStorage() } })).to.throw('Invalid secret type');
		});

		it('inits instance with buffer secret', async () => {
			const instance = new Jwt({
				secret: Buffer.from('scrt', 'base64'),
				blacklisting: false
			});
			const token = instance.sign(
				{},
				{
					expiresIn: 60
				}
			);
			await asyncExpect(
				instance.validate(token, {
					expiresIn: 60
				})
			).to.eventually.be.fulfilled.and.to.have.property('exp');
		});

		it('inits instance with string secret', async () => {
			const instance = new Jwt({
				secret: 'scrt',
				blacklisting: false
			});
			const token = instance.sign(
				{},
				{
					expiresIn: 60
				}
			);
			await asyncExpect(
				instance.validate(token, {
					expiresIn: 60
				})
			).to.eventually.be.fulfilled.and.to.have.property('exp');
		});
	});

	describe('sign function spec', () => {
		it('generates identical tokens issued at same timestamp', () => {
			const instance = new Jwt({ secret: 'secret', blacklisting: false });
			const token1 = instance.sign(
				{
					sub: '1',
					aud: 'admin'
				},
				{
					expiresIn: 60
				}
			);
			const token2 = instance.sign(
				{
					sub: '1',
					aud: 'admin'
				},
				{
					expiresIn: 60 // seconds
				}
			);
			expect(token1).to.deep.equal(token2);
		});

		it('generates different tokens, when they are issued at different timestamps', async () => {
			const instance = new Jwt({ secret: 'srct', blacklisting: false });
			const token1 = instance.sign(
				{
					sub: '1',
					aud: 'admin'
				},
				{
					expiresIn: 60
				}
			);
			await sleep(1000);
			const token2 = instance.sign(
				{
					sub: '1',
					aud: 'admin'
				},
				{
					expiresIn: 60
				}
			);
			expect(token1).to.not.be.equal(token2);
		});
	});

	describe('validate function spec', () => {
		it('validates valid jwt', async () => {
			const instance = new Jwt({ secret: 'scrt', blacklisting: false });
			const token = instance.sign(
				{
					sub: '1'
				},
				{
					expiresIn: 60
				}
			);
			const jwt = await instance.validate(token, {
				expiresIn: 60
			});
			expect(jwt.sub).to.equal('1');
		});

		it('throws if token is incorrect', async () => {
			await asyncExpect(new Jwt({ secret: 'srct', blacklisting: false }).validate('asdasd')).to.eventually.be
				.rejected;
		});

		it('throws if token is expired', async () => {
			const instance = new Jwt({ secret: 'sec', blacklisting: false });
			const token = instance.sign(
				{
					sub: '1'
				},
				{
					expiresIn: 1 // second
				}
			);
			await sleep(2000);
			await expect(instance.validate(token)).to.eventually.be.rejected;
		});

		it('validates non-expired token, when no expiredIn clause specified in verify opts', async () => {
			const instance = new Jwt({
				secret: 'secret',
				signVerifyOpts: {
					sign: { expiresIn: 1 },
					verify: {}
				}
			});
			const token = instance.sign({ sub: '1' });
			await asyncExpect(instance.validate(token)).to.eventually.be.fulfilled.and.have.property('sub', '1');
		});

		it('invalidates expired token, when no expiredIn clause specified in verify opts', async () => {
			const instance = new Jwt({
				secret: 'secret',
				signVerifyOpts: {
					sign: { expiresIn: 1 },
					verify: {}
				}
			});
			const token = instance.sign({ sub: '1' });
			await sleep(2000);
			await asyncExpect(instance.validate(token)).to.eventually.be.rejected;
		});
	});

	describe('blacklist function spec', () => {
		it('throws when trying to get blacklist if no blacklisting set', () => {
			expect(() => new Jwt({ secret: 'secret', blacklisting: false }).blacklist()).to.throw(
				'No blacklisting support configured'
			);
		});
	});

	describe('secret combinations spec', () => {
		it('signs/verify with string secret for HMAC algorithms', async () => {
			const instance = new Jwt({ secret: 'my-scrt' });
			const payload = {
				sub: 'sub',
				aud: 'aud'
			};
			const token = instance.sign(payload);
			await asyncExpect(
				instance.validate(token, { audience: 'aud' })
			).to.eventually.be.fulfilled.and.to.have.property('sub', 'sub');
		});

		it('signs/verify with Buffer base64 encoded secret for HMAC algoritms', async () => {
			const instance = new Jwt({
				secret: Buffer.from('my-scrt', 'base64')
			});
			const payload = {
				sub: 'sub',
				aud: 'aud'
			};
			const token = instance.sign(payload);
			await asyncExpect(
				instance.validate(token, { audience: 'aud' })
			).to.eventually.be.fulfilled.and.to.have.property('sub', 'sub');
		});

		it('signs/verify with PEM encoded private/public keys for RSA/ECDSA algorithms', async () => {
			const instance = new Jwt({
				secret: keys,
				signVerifyOpts: {
					sign: { algorithm: 'RS512' },
					verify: { algorithms: ['RS512'] }
				}
			});
			const payload = {
				sub: 'sub',
				aud: 'aud'
			};
			const token = instance.sign(payload);
			await asyncExpect(
				instance.validate(token, { audience: 'aud' })
			).to.eventually.be.fulfilled.and.to.have.property('sub', 'sub');
		});
	});

	describe('sign verify opts combinations spec', () => {
		it(
			'uses jsonwebtoken defaults, when no sign/verify options provided ' +
				'as defaults in constructor or as custom to operations args',
			async () => {
				const instance = new Jwt({ secret: 'srct' });
				const payload = {
					sub: 'sub'
				};
				const token = instance.sign(payload);
				await asyncExpect(instance.validate(token)).to.eventually.be.fulfilled.and.to.have.property(
					'sub',
					'sub'
				);
			}
		);

		it('uses sign/verify defaults of Jwt instance, when no custom options provided for operations', async () => {
			const instance = new Jwt({
				secret: 'srct',
				signVerifyOpts: {
					sign: {
						issuer: 'issuer'
					},
					verify: {
						issuer: 'issue'
					}
				}
			});
			const payload = {
				sub: 'sub'
			};
			const token = instance.sign(payload);
			await asyncExpect(instance.validate(token)).to.eventually.be.rejected;
		});

		it('uses sign/verify custom opts when invoking operations, instead of defaults', async () => {
			const instance = new Jwt({
				secret: 'srct',
				signVerifyOpts: {
					sign: {
						issuer: 'issuer'
					},
					verify: {
						issuer: 'issue'
					}
				}
			});
			const payload = {
				sub: 'sub'
			};
			const token = instance.sign(payload);
			await asyncExpect(
				instance.validate(token, { issuer: 'issuer' })
			).to.eventually.be.fulfilled.and.to.have.property('iss', 'issuer');
		});

		it('throws when using priv/pub key pairs and no options provided at all', async () => {
			const instance = new Jwt({
				secret: keys
			});
			const payload = {
				sub: 'sub'
			};
			expect(() => instance.sign(payload)).to.throw(
				JsonWebTokenError,
				'Options are needed when using RSA/ECDSA key pair'
			);
			await asyncExpect(instance.validate('asd')).to.eventually.be.rejectedWith(
				JsonWebTokenError,
				'Options are needed when using RSA/ECDSA key pair'
			);
		});
	});

	describe('common flows spec', () => {
		let jwtAuth;
		let blacklist;
		let userAudience;
		let adminAudience;
		let validity;

		before(async () => {
			jwtAuth = new Jwt({ secret: 'my-secret', blacklisting: true });
			blacklist = jwtAuth.blacklist();
			userAudience = 'user';
			adminAudience = 'admin';
			validity = 10;

			await blacklist.init(new MemoryStorage());
			await blacklist.defineAudiences([
				{
					name: userAudience,
					ttl: validity
				},
				{
					name: adminAudience,
					ttl: validity
				}
			]);
		});

		it('simulate logout sequence from single session', async () => {
			/** issue and send jwt  */
			const token = jwtAuth.sign(
				{
					sub: '1',
					aud: userAudience
				},
				{
					expiresIn: validity
				}
			);
			/** user making request to logout, validate Jwt and add it to blacklist */
			const payload = await jwtAuth.validate(token, {
				audience: userAudience
			});
			/* add to blacklist */
			await blacklist.revoke({
				sub: payload.sub,
				aud: payload.aud,
				iat: payload.iat,
				exp: payload.exp
			});
			/** simulate another request after 1 sec */
			await sleep(1000);
			await expect(jwtAuth.validate(token, { audience: userAudience })).to.eventually.be.rejected;
		});

		it('simulate logout from all devices inited by client', async () => {
			/** Issue 3 tokens at different timestamps */
			const token1 = jwtAuth.sign(
				{
					aud: userAudience,
					sub: '1'
				},
				{
					expiresIn: validity
				}
			);
			await sleep(1000);
			const token2 = jwtAuth.sign(
				{
					aud: userAudience,
					sub: '1'
				},
				{
					expiresIn: validity
				}
			);
			await sleep(1000);
			const token3 = jwtAuth.sign(
				{
					aud: userAudience,
					sub: '1'
				},
				{
					expiresIn: validity
				}
			);
			/** Log in with second token and invalidate all tokens */
			// wait 1 second
			await sleep(1000);
			const payload = await jwtAuth.validate(token2, {
				audience: userAudience
			});
			await blacklist.purge(payload.sub, userAudience, validity);
			/** Issue new token for his device */
			await sleep(1000);
			const token4 = jwtAuth.sign(
				{
					aud: userAudience,
					sub: '1'
				},
				{
					expiresIn: validity
				}
			);
			/** Authentication with revoked tokens must fail */
			await expect(jwtAuth.validate(token1, { audience: userAudience })).to.eventually.be.rejected;
			await expect(jwtAuth.validate(token2, { audience: userAudience })).to.eventually.be.rejected;
			await expect(jwtAuth.validate(token3, { audience: userAudience })).to.eventually.be.rejected;
			/** Login with fourth token must succeed */
			await expect(
				jwtAuth.validate(token4, { audience: userAudience })
			).to.eventually.be.fulfilled.and.to.have.property('sub', '1');
		});
	});
});
