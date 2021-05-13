"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AVRO_SERIALIZER = void 0;
const avsc_1 = require("avsc");
const avro_schema_1 = require("../common/avro-schema");
/**
 * @private
 */
const AVRO_TYPE = avsc_1.Type.forSchema(avro_schema_1.AVRO_SCHEMA, { omitRecordMethods: true });
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