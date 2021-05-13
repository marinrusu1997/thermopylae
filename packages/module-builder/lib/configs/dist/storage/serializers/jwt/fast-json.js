"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FAST_JSON_SERIALIZER = void 0;
const fast_json_stringify_1 = __importDefault(require("fast-json-stringify"));
const fast_json_schema_1 = require("../common/fast-json-schema");
/**
 * @private
 */
const FAST_JSON = fast_json_stringify_1.default(fast_json_schema_1.FAST_JSON_SCHEMA, {
    ajv: {
        allErrors: true,
        verbose: true,
        strictNumbers: true
    },
    rounding: 'round'
});
/**
 * @private
 */
const FAST_JSON_SERIALIZER = Object.freeze({
    serialize(session) {
        return Buffer.from(FAST_JSON(session));
    },
    deserialize(buffer) {
        return JSON.parse(buffer);
    }
});
exports.FAST_JSON_SERIALIZER = FAST_JSON_SERIALIZER;
//# sourceMappingURL=fast-json.js.map