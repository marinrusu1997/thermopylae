"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JSON_SERIALIZER = void 0;
/**
 * @private
 */
const JSON_SERIALIZER = Object.freeze({
    serialize(session) {
        return Buffer.from(JSON.stringify(session));
    },
    deserialize(buffer) {
        return JSON.parse(buffer);
    }
});
exports.JSON_SERIALIZER = JSON_SERIALIZER;
//# sourceMappingURL=json.js.map