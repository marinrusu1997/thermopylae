"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AVRO_SCHEMA = void 0;
/**
 * @private
 */
const AVRO_SCHEMA = {
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
        { name: 'createdAt', type: 'long' },
        { name: 'expiresAt', type: 'long' }
    ]
};
exports.AVRO_SCHEMA = AVRO_SCHEMA;
//# sourceMappingURL=avro-schema.js.map