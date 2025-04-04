import type { HTTPRequestLocation } from '@thermopylae/core.declarations';
import type { UserSessionDevice } from '@thermopylae/core.user-session.commons';
import { AVRO_SERIALIZER } from '@thermopylae/core.user-session.commons/dist/storage/serializers/jwt/avro.js';
import { FAST_JSON_SERIALIZER } from '@thermopylae/core.user-session.commons/dist/storage/serializers/jwt/fast-json.js';
import { JSON_SERIALIZER } from '@thermopylae/core.user-session.commons/dist/storage/serializers/jwt/json.js';
import { logger } from '@thermopylae/dev.unit-test';
import { buildPromiseHolder } from '@thermopylae/lib.async';
import type { UserSessionMetaData } from '@thermopylae/lib.user-session.commons';
import benchmark from 'benchmark';
import type { Event } from 'benchmark';
import { describe, expect, it } from 'vitest';

const { Suite } = benchmark;

const samples: Array<UserSessionMetaData<UserSessionDevice, HTTPRequestLocation>> = [
	{
		ip: '127.0.0.1',
		device: null,
		location: null,
		createdAt: Math.floor(Date.now() / 1000),
		expiresAt: Math.floor(Date.now() / 1000) + 5
	},
	{
		ip: '127.125.128.6',
		device: {
			name: 'device',
			type: 'smartphone',
			os: null,
			client: null
		},
		location: null,
		createdAt: Math.floor(Date.now() / 1000),
		expiresAt: Math.floor(Date.now() / 1000) + 5
	},
	{
		ip: '255.125.128.6',
		device: {
			name: 'device',
			type: 'console',
			os: {
				name: 'Ubuntu',
				version: '20',
				platform: 'x64'
			},
			client: null
		},
		location: null,
		createdAt: Math.floor(Date.now() / 1000),
		expiresAt: Math.floor(Date.now() / 1000) + 5
	},
	{
		ip: '255.8.128.6',
		device: {
			name: 'second-device',
			type: 'car',
			os: null,
			client: {
				name: 'Chrome',
				type: 'browser',
				version: '88.6'
			}
		},
		location: null,
		createdAt: Math.floor(Date.now() / 1000),
		expiresAt: Math.floor(Date.now() / 1000) + 5
	},
	{
		ip: '255.8.128.6',
		device: {
			name: 'third-device',
			type: 'camera',
			os: {
				name: 'Windows',
				version: '10',
				platform: 'ARM'
			},
			client: {
				name: 'node-fetch',
				type: 'library',
				version: '2'
			}
		},
		location: null,
		createdAt: Math.floor(Date.now() / 1000),
		expiresAt: Math.floor(Date.now() / 1000) + 5
	},
	{
		ip: '255.8.96.98',
		device: null,
		location: {
			countryCode: 'RO',
			regionCode: 'B',
			city: 'Bucharest',
			latitude: 15,
			longitude: 15,
			timezone: 'Athene +2'
		},
		createdAt: Math.floor(Date.now() / 1000),
		expiresAt: Math.floor(Date.now() / 1000) + 5
	},
	{
		ip: '255.8.96.98',
		device: null,
		location: {
			countryCode: null,
			regionCode: 'B',
			city: 'Bucharest',
			latitude: 15,
			longitude: 15,
			timezone: 'Athene +2'
		},
		createdAt: Math.floor(Date.now() / 1000),
		expiresAt: Math.floor(Date.now() / 1000) + 5
	},
	{
		ip: '255.8.96.98',
		device: null,
		location: {
			countryCode: 'MD',
			regionCode: null,
			city: 'Bucharest',
			latitude: 15,
			longitude: 15,
			timezone: 'Athene +2'
		},
		createdAt: Math.floor(Date.now() / 1000),
		expiresAt: Math.floor(Date.now() / 1000) + 5
	},
	{
		ip: '255.8.96.98',
		device: null,
		location: {
			countryCode: 'RO',
			regionCode: 'B',
			city: null,
			latitude: 15,
			longitude: 15,
			timezone: 'Athene +2'
		},
		createdAt: Math.floor(Date.now() / 1000),
		expiresAt: Math.floor(Date.now() / 1000) + 5
	},
	{
		ip: '255.8.96.98',
		device: null,
		location: {
			countryCode: 'RO',
			regionCode: 'B',
			city: 'Bucharest',
			latitude: null,
			longitude: 15,
			timezone: 'Athene +2'
		},
		createdAt: Math.floor(Date.now() / 1000),
		expiresAt: Math.floor(Date.now() / 1000) + 5
	},
	{
		ip: '255.8.96.98',
		device: null,
		location: {
			countryCode: 'RO',
			regionCode: 'B',
			city: 'Bucharest',
			latitude: 15,
			longitude: null,
			timezone: 'Athene +2'
		},
		createdAt: Math.floor(Date.now() / 1000),
		expiresAt: Math.floor(Date.now() / 1000) + 5
	},
	{
		ip: '255.8.96.98',
		device: null,
		location: {
			countryCode: 'RO',
			regionCode: 'B',
			city: 'Bucharest',
			latitude: 15,
			longitude: 15,
			timezone: null
		},
		createdAt: Math.floor(Date.now() / 1000),
		expiresAt: Math.floor(Date.now() / 1000) + 5
	},
	{
		ip: '255.8.96.98',
		device: {
			name: 'third-device',
			type: 'camera',
			os: {
				name: 'Windows',
				version: '10',
				platform: 'ARM'
			},
			client: {
				name: 'node-fetch',
				type: 'library',
				version: '2'
			}
		},
		location: {
			countryCode: 'RO',
			regionCode: 'B',
			city: 'Bucharest',
			latitude: 15,
			longitude: 15,
			timezone: 'Athene +2'
		},
		createdAt: Math.floor(Date.now() / 1000),
		expiresAt: Math.floor(Date.now() / 1000) + 5
	}
];
const ROUNDS = 10;

describe.skip(`user session meta data serializers spec`, () => {
	it('benchmark', { timeout: 30_000 }, async () => {
		const deferred = buildPromiseHolder<void>();

		const suite = new Suite('Serialization Benchmark');
		suite
			.add('fast-json', () => {
				for (let i = 0; i < ROUNDS; i++) {
					for (const sample of samples) {
						expect(FAST_JSON_SERIALIZER.deserialize(FAST_JSON_SERIALIZER.serialize(sample))).to.be.deep.eq(sample);
					}
				}
			})
			.add('json', () => {
				for (let i = 0; i < ROUNDS; i++) {
					for (const sample of samples) {
						expect(JSON_SERIALIZER.deserialize(JSON_SERIALIZER.serialize(sample))).to.be.deep.eq(sample);
					}
				}
			})
			.add('avro', () => {
				for (let i = 0; i < ROUNDS; i++) {
					for (const sample of samples) {
						expect(AVRO_SERIALIZER.deserialize(AVRO_SERIALIZER.serialize(sample))).to.be.deep.eq(sample);
					}
				}
			})
			.on('cycle', function onCycle(event: Event) {
				logger.error(String(event.target));
			})
			.on('complete', function onComplete(this: benchmark.Suite) {
				logger.error(`Fastest is ${this.filter('fastest').map('name')}`);
				deferred.resolve();
			})
			.on('error', deferred.reject)
			.run();

		await deferred.promise;
	});
});
