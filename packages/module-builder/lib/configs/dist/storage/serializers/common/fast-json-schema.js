"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FAST_JSON_SCHEMA = void 0;
/**
 * @private
 */
const FAST_JSON_SCHEMA = {
    title: 'User Session Meta Data Schema',
    type: 'object',
    properties: {
        ip: { type: 'string', nullable: false },
        device: {
            type: 'object',
            properties: {
                name: { type: 'string', nullable: false },
                type: { type: 'string', nullable: false },
                client: {
                    type: 'object',
                    properties: {
                        name: { type: 'string', nullable: false },
                        type: { type: 'string', nullable: false },
                        version: { type: 'string', nullable: false }
                    },
                    required: ['name', 'type', 'version'],
                    default: null,
                    nullable: true,
                    additionalProperties: true
                },
                os: {
                    type: 'object',
                    properties: {
                        name: { type: 'string', nullable: false },
                        version: { type: 'string', nullable: false },
                        platform: { type: 'string', nullable: false }
                    },
                    required: ['name', 'version', 'platform'],
                    default: null,
                    nullable: true,
                    additionalProperties: false
                }
            },
            required: ['name', 'type', 'client', 'os'],
            default: null,
            nullable: true,
            additionalProperties: false
        },
        location: {
            type: 'object',
            properties: {
                countryCode: { type: 'string', nullable: true },
                regionCode: { type: 'string', nullable: true },
                city: { type: 'string', nullable: true },
                latitude: { type: 'number', nullable: true },
                longitude: { type: 'number', nullable: true },
                timezone: { type: 'string', nullable: true }
            },
            required: ['countryCode', 'regionCode', 'city', 'latitude', 'longitude', 'timezone'],
            default: null,
            nullable: true,
            additionalProperties: false
        },
        createdAt: { type: 'integer', nullable: false },
        expiresAt: { type: 'integer', nullable: false }
    },
    required: ['ip', 'device', 'location', 'createdAt', 'expiresAt'],
    nullable: false,
    additionalProperties: false
};
exports.FAST_JSON_SCHEMA = FAST_JSON_SCHEMA;
//# sourceMappingURL=fast-json-schema.js.map