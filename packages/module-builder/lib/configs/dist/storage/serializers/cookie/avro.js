"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AVRO_SERIALIZER = void 0;
const avsc_1 = require("avsc");
const lodash_clonedeep_1 = __importDefault(require("lodash.clonedeep"));
const avro_schema_1 = require("../common/avro-schema");
/**
 * @private
 */
const SCHEMA = lodash_clonedeep_1.default(avro_schema_1.AVRO_SCHEMA);
SCHEMA.fields.push({ name: 'accessedAt', type: 'long' });
/**
 * @private
 */
const AVRO_TYPE = avsc_1.Type.forSchema(SCHEMA, { omitRecordMethods: true });
/**
 * @private
 */
const AVRO_SERIALIZER = Object.freeze({
    serialize(session) {
        return AVRO_TYPE.toBuffer(session);
    },
    deserialize(buffer) {
        return AVRO_TYPE.fromBuffer(buffer);
    }
});
exports.AVRO_SERIALIZER = AVRO_SERIALIZER;
//# sourceMappingURL=avro.js.map