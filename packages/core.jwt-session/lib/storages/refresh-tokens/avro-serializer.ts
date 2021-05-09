import { Type } from 'avsc';
import type { UserSessionMetaData } from '@thermopylae/lib.jwt-session';
import type { HTTPRequestLocation } from '@thermopylae/core.declarations';
import type { JwtSessionDevice, UserSessionMetaDataSerializer } from '../../typings';

/**
 * @private
 */
const AVRO_SCHEMA = Type.forSchema(
	{
		type: 'record',
		name: 'user_session_meta_data',
		fields: [
			{ name: 'ip', type: 'string' },
			{
				name: 'device',
				type: [
					'null',
					{
						type: 'record',
						name: 'device',
						fields: [
							{ name: 'name', type: 'string' },
							{ name: 'type', type: 'string' },
							{
								name: 'client',
								type: [
									'null',
									{
										type: 'record',
										name: 'client',
										fields: [
											{ name: 'name', type: 'string' },
											{ name: 'type', type: 'string' },
											{ name: 'version', type: 'string' }
										]
									}
								]
							},
							{
								name: 'os',
								type: [
									'null',
									{
										type: 'record',
										name: 'os',
										fields: [
											{ name: 'name', type: 'string' },
											{ name: 'version', type: 'string' },
											{ name: 'platform', type: 'string' }
										]
									}
								]
							}
						]
					}
				]
			},
			{
				name: 'location',
				type: [
					'null',
					{
						type: 'record',
						name: 'location',
						fields: [
							{ name: 'countryCode', type: ['null', 'string'] },
							{ name: 'regionCode', type: ['null', 'string'] },
							{ name: 'city', type: ['null', 'string'] },
							{ name: 'latitude', type: ['null', 'float'] },
							{ name: 'longitude', type: ['null', 'float'] },
							{ name: 'timezone', type: ['null', 'string'] }
						]
					}
				]
			},
			{ name: 'createdAt', type: 'long' }
		]
	},
	{ omitRecordMethods: true }
);

/**
 * @private
 */
const AVRO_SERIALIZER: Readonly<UserSessionMetaDataSerializer> = Object.freeze({
	serialize(session: UserSessionMetaData<JwtSessionDevice, HTTPRequestLocation>): Buffer {
		return AVRO_SCHEMA.toBuffer(session);
	},
	deserialize(buffer: Buffer): UserSessionMetaData<JwtSessionDevice, HTTPRequestLocation> {
		return AVRO_SCHEMA.fromBuffer(buffer);
	}
});

export { AVRO_SERIALIZER };
