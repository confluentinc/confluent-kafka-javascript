"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JsonDeserializer = exports.JsonSerializer = void 0;
var serde_1 = require("./serde");
var schemaregistry_client_1 = require("../schemaregistry-client");
var _2019_1 = require("ajv/dist/2019");
var _2020_1 = require("ajv/dist/2020");
var draft6MetaSchema = require("ajv/dist/refs/json-schema-draft-06.json");
var draft7MetaSchema = require("ajv/dist/refs/json-schema-draft-07.json");
var draft_2020_12_1 = require("@criteria/json-schema/draft-2020-12");
var draft_07_1 = require("@criteria/json-schema/draft-07");
var json_schema_validation_1 = require("@criteria/json-schema-validation");
var lru_cache_1 = require("lru-cache");
var json_util_1 = require("./json-util");
var stringify = require('json-stringify-deterministic');
/**
 * JsonSerializer is a serializer for JSON messages.
 */
var JsonSerializer = /** @class */ (function (_super) {
    __extends(JsonSerializer, _super);
    /**
     * Creates a new JsonSerializer.
     * @param client - the schema registry client
     * @param serdeType - the serializer type
     * @param conf - the serializer configuration
     * @param ruleRegistry - the rule registry
     */
    function JsonSerializer(client, serdeType, conf, ruleRegistry) {
        var _a, _b, _c;
        var _this = _super.call(this, client, serdeType, conf, ruleRegistry) || this;
        _this.schemaToTypeCache = new lru_cache_1.LRUCache({ max: (_a = _this.config().cacheCapacity) !== null && _a !== void 0 ? _a : 1000 });
        _this.schemaToValidateCache = new lru_cache_1.LRUCache({ max: (_b = _this.config().cacheCapacity) !== null && _b !== void 0 ? _b : 1000 });
        _this.fieldTransformer = function (ctx, fieldTransform, msg) { return __awaiter(_this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.fieldTransform(ctx, fieldTransform, msg)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        }); };
        for (var _i = 0, _d = _this.ruleRegistry.getExecutors(); _i < _d.length; _i++) {
            var rule = _d[_i];
            rule.configure(client.config(), new Map(Object.entries((_c = conf.ruleConfig) !== null && _c !== void 0 ? _c : {})));
        }
        return _this;
    }
    /**
     * Serializes a message.
     * @param topic - the topic
     * @param msg - the message
     */
    JsonSerializer.prototype.serialize = function (topic, msg) {
        return __awaiter(this, void 0, void 0, function () {
            var schema, jsonSchema, _a, id, info, subject, msgBytes, validate;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (this.client == null) {
                            throw new Error('client is not initialized');
                        }
                        if (msg == null) {
                            throw new Error('message is empty');
                        }
                        schema = undefined;
                        // Don't derive the schema if it is being looked up in the following ways
                        if (this.config().useSchemaId == null &&
                            !this.config().useLatestVersion &&
                            this.config().useLatestWithMetadata == null) {
                            jsonSchema = JsonSerializer.messageToSchema(msg);
                            schema = {
                                schemaType: 'JSON',
                                schema: JSON.stringify(jsonSchema),
                            };
                        }
                        return [4 /*yield*/, this.getId(topic, msg, schema)];
                    case 1:
                        _a = _b.sent(), id = _a[0], info = _a[1];
                        subject = this.subjectName(topic, info);
                        return [4 /*yield*/, this.executeRules(subject, topic, schemaregistry_client_1.RuleMode.WRITE, null, info, msg, null)];
                    case 2:
                        msg = _b.sent();
                        msgBytes = Buffer.from(JSON.stringify(msg));
                        if (!this.conf.validate) return [3 /*break*/, 4];
                        return [4 /*yield*/, this.toValidateFunction(info)];
                    case 3:
                        validate = _b.sent();
                        if (validate != null && !validate(msg)) {
                            throw new serde_1.SerializationError('Invalid message');
                        }
                        _b.label = 4;
                    case 4: return [2 /*return*/, this.writeBytes(id, msgBytes)];
                }
            });
        });
    };
    JsonSerializer.prototype.fieldTransform = function (ctx, fieldTransform, msg) {
        return __awaiter(this, void 0, void 0, function () {
            var schema;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.toType(ctx.target)];
                    case 1:
                        schema = _a.sent();
                        if (typeof schema === 'boolean') {
                            return [2 /*return*/, msg];
                        }
                        return [4 /*yield*/, transform(ctx, schema, '$', msg, fieldTransform)];
                    case 2: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    JsonSerializer.prototype.toType = function (info) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                return [2 /*return*/, toType(this.client, this.conf, this, info, function (client, info) { return __awaiter(_this, void 0, void 0, function () {
                        var deps;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    deps = new Map();
                                    return [4 /*yield*/, this.resolveReferences(client, info, deps)];
                                case 1:
                                    _a.sent();
                                    return [2 /*return*/, deps];
                            }
                        });
                    }); })];
            });
        });
    };
    JsonSerializer.prototype.toValidateFunction = function (info) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, toValidateFunction(this.client, this.conf, this, info, function (client, info) { return __awaiter(_this, void 0, void 0, function () {
                            var deps;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        deps = new Map();
                                        return [4 /*yield*/, this.resolveReferences(client, info, deps)];
                                    case 1:
                                        _a.sent();
                                        return [2 /*return*/, deps];
                                }
                            });
                        }); })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    JsonSerializer.messageToSchema = function (msg) {
        return (0, json_util_1.generateSchema)(msg);
    };
    return JsonSerializer;
}(serde_1.Serializer));
exports.JsonSerializer = JsonSerializer;
/**
 * JsonDeserializer is a deserializer for JSON messages.
 */
var JsonDeserializer = /** @class */ (function (_super) {
    __extends(JsonDeserializer, _super);
    /**
     * Creates a new JsonDeserializer.
     * @param client - the schema registry client
     * @param serdeType - the deserializer type
     * @param conf - the deserializer configuration
     * @param ruleRegistry - the rule registry
     */
    function JsonDeserializer(client, serdeType, conf, ruleRegistry) {
        var _a, _b, _c;
        var _this = _super.call(this, client, serdeType, conf, ruleRegistry) || this;
        _this.schemaToTypeCache = new lru_cache_1.LRUCache({ max: (_a = _this.config().cacheCapacity) !== null && _a !== void 0 ? _a : 1000 });
        _this.schemaToValidateCache = new lru_cache_1.LRUCache({ max: (_b = _this.config().cacheCapacity) !== null && _b !== void 0 ? _b : 1000 });
        _this.fieldTransformer = function (ctx, fieldTransform, msg) { return __awaiter(_this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.fieldTransform(ctx, fieldTransform, msg)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        }); };
        for (var _i = 0, _d = _this.ruleRegistry.getExecutors(); _i < _d.length; _i++) {
            var rule = _d[_i];
            rule.configure(client.config(), new Map(Object.entries((_c = conf.ruleConfig) !== null && _c !== void 0 ? _c : {})));
        }
        return _this;
    }
    /**
     * Deserializes a message.
     * @param topic - the topic
     * @param payload - the message payload
     */
    JsonDeserializer.prototype.deserialize = function (topic, payload) {
        return __awaiter(this, void 0, void 0, function () {
            var info, validate, subject, readerMeta, migrations, msgBytes, msg, target;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!Buffer.isBuffer(payload)) {
                            throw new Error('Invalid buffer');
                        }
                        if (payload.length === 0) {
                            return [2 /*return*/, null];
                        }
                        return [4 /*yield*/, this.getSchema(topic, payload)];
                    case 1:
                        info = _a.sent();
                        if (!this.conf.validate) return [3 /*break*/, 3];
                        return [4 /*yield*/, this.toValidateFunction(info)];
                    case 2:
                        validate = _a.sent();
                        if (validate != null && !validate(JSON.parse(payload.subarray(5).toString()))) {
                            throw new serde_1.SerializationError('Invalid message');
                        }
                        _a.label = 3;
                    case 3:
                        subject = this.subjectName(topic, info);
                        return [4 /*yield*/, this.getReaderSchema(subject)];
                    case 4:
                        readerMeta = _a.sent();
                        migrations = [];
                        if (!(readerMeta != null)) return [3 /*break*/, 6];
                        return [4 /*yield*/, this.getMigrations(subject, info, readerMeta)];
                    case 5:
                        migrations = _a.sent();
                        _a.label = 6;
                    case 6:
                        msgBytes = payload.subarray(5);
                        msg = JSON.parse(msgBytes.toString());
                        if (!(migrations.length > 0)) return [3 /*break*/, 8];
                        return [4 /*yield*/, this.executeMigrations(migrations, subject, topic, msg)];
                    case 7:
                        msg = _a.sent();
                        _a.label = 8;
                    case 8:
                        if (readerMeta != null) {
                            target = readerMeta;
                        }
                        else {
                            target = info;
                        }
                        msg = this.executeRules(subject, topic, schemaregistry_client_1.RuleMode.READ, null, target, msg, null);
                        return [2 /*return*/, msg];
                }
            });
        });
    };
    JsonDeserializer.prototype.fieldTransform = function (ctx, fieldTransform, msg) {
        return __awaiter(this, void 0, void 0, function () {
            var schema;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.toType(ctx.target)];
                    case 1:
                        schema = _a.sent();
                        return [4 /*yield*/, transform(ctx, schema, '$', msg, fieldTransform)];
                    case 2: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    JsonDeserializer.prototype.toType = function (info) {
        var _this = this;
        return toType(this.client, this.conf, this, info, function (client, info) { return __awaiter(_this, void 0, void 0, function () {
            var deps;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        deps = new Map();
                        return [4 /*yield*/, this.resolveReferences(client, info, deps)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/, deps];
                }
            });
        }); });
    };
    JsonDeserializer.prototype.toValidateFunction = function (info) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, toValidateFunction(this.client, this.conf, this, info, function (client, info) { return __awaiter(_this, void 0, void 0, function () {
                            var deps;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        deps = new Map();
                                        return [4 /*yield*/, this.resolveReferences(client, info, deps)];
                                    case 1:
                                        _a.sent();
                                        return [2 /*return*/, deps];
                                }
                            });
                        }); })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    return JsonDeserializer;
}(serde_1.Deserializer));
exports.JsonDeserializer = JsonDeserializer;
function toValidateFunction(client, conf, serde, info, refResolver) {
    return __awaiter(this, void 0, void 0, function () {
        var fn, deps, json, spec, ajv2020_1, ajv_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    fn = serde.schemaToValidateCache.get(stringify(info.schema));
                    if (fn != null) {
                        return [2 /*return*/, fn];
                    }
                    return [4 /*yield*/, refResolver(client, info)];
                case 1:
                    deps = _a.sent();
                    json = JSON.parse(info.schema);
                    spec = json.$schema;
                    if (spec === 'http://json-schema.org/draft/2020-12/schema'
                        || spec === 'https://json-schema.org/draft/2020-12/schema') {
                        ajv2020_1 = new _2020_1.default(conf);
                        ajv2020_1.addKeyword("confluent:tags");
                        deps.forEach(function (schema, name) {
                            ajv2020_1.addSchema(JSON.parse(schema), name);
                        });
                        fn = ajv2020_1.compile(json);
                    }
                    else {
                        ajv_1 = new _2019_1.default(conf);
                        ajv_1.addKeyword("confluent:tags");
                        ajv_1.addMetaSchema(draft6MetaSchema);
                        ajv_1.addMetaSchema(draft7MetaSchema);
                        deps.forEach(function (schema, name) {
                            ajv_1.addSchema(JSON.parse(schema), name);
                        });
                        fn = ajv_1.compile(json);
                    }
                    serde.schemaToValidateCache.set(stringify(info.schema), fn);
                    return [2 /*return*/, fn];
            }
        });
    });
}
function toType(client, conf, serde, info, refResolver) {
    return __awaiter(this, void 0, void 0, function () {
        var type, deps, retrieve, json, spec, schema;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    type = serde.schemaToTypeCache.get(stringify(info.schema));
                    if (type != null) {
                        return [2 /*return*/, type];
                    }
                    return [4 /*yield*/, refResolver(client, info)];
                case 1:
                    deps = _a.sent();
                    retrieve = function (uri) {
                        var data = deps.get(uri);
                        if (data == null) {
                            throw new serde_1.SerializationError("Schema not found: ".concat(uri));
                        }
                        return JSON.parse(data);
                    };
                    json = JSON.parse(info.schema);
                    spec = json.$schema;
                    if (!(spec === 'http://json-schema.org/draft/2020-12/schema'
                        || spec === 'https://json-schema.org/draft/2020-12/schema')) return [3 /*break*/, 3];
                    return [4 /*yield*/, (0, draft_2020_12_1.dereferenceJSONSchema)(json, { retrieve: retrieve })];
                case 2:
                    schema = _a.sent();
                    return [3 /*break*/, 5];
                case 3: return [4 /*yield*/, (0, draft_07_1.dereferenceJSONSchema)(json, { retrieve: retrieve })];
                case 4:
                    schema = _a.sent();
                    _a.label = 5;
                case 5:
                    serde.schemaToTypeCache.set(stringify(info.schema), schema);
                    return [2 /*return*/, schema];
            }
        });
    });
}
function transform(ctx, schema, path, msg, fieldTransform) {
    return __awaiter(this, void 0, void 0, function () {
        var fieldCtx, subschema, subschema, subschema, i, _a, _b, type, _c, _i, _d, _e, propName, propSchema, ruleTags;
        return __generator(this, function (_f) {
            switch (_f.label) {
                case 0:
                    if (msg == null || schema == null || typeof schema === 'boolean') {
                        return [2 /*return*/, msg];
                    }
                    fieldCtx = ctx.currentField();
                    if (fieldCtx != null) {
                        fieldCtx.type = getType(schema);
                    }
                    if (!(schema.allOf != null && schema.allOf.length > 0)) return [3 /*break*/, 2];
                    subschema = validateSubschemas(schema.allOf, msg);
                    if (!(subschema != null)) return [3 /*break*/, 2];
                    return [4 /*yield*/, transform(ctx, subschema, path, msg, fieldTransform)];
                case 1: return [2 /*return*/, _f.sent()];
                case 2:
                    if (!(schema.anyOf != null && schema.anyOf.length > 0)) return [3 /*break*/, 4];
                    subschema = validateSubschemas(schema.anyOf, msg);
                    if (!(subschema != null)) return [3 /*break*/, 4];
                    return [4 /*yield*/, transform(ctx, subschema, path, msg, fieldTransform)];
                case 3: return [2 /*return*/, _f.sent()];
                case 4:
                    if (!(schema.oneOf != null && schema.oneOf.length > 0)) return [3 /*break*/, 6];
                    subschema = validateSubschemas(schema.oneOf, msg);
                    if (!(subschema != null)) return [3 /*break*/, 6];
                    return [4 /*yield*/, transform(ctx, subschema, path, msg, fieldTransform)];
                case 5: return [2 /*return*/, _f.sent()];
                case 6:
                    if (!(schema.items != null)) return [3 /*break*/, 11];
                    if (!Array.isArray(msg)) return [3 /*break*/, 11];
                    i = 0;
                    _f.label = 7;
                case 7:
                    if (!(i < msg.length)) return [3 /*break*/, 10];
                    _a = msg;
                    _b = i;
                    return [4 /*yield*/, transform(ctx, schema.items, path, msg[i], fieldTransform)];
                case 8:
                    _a[_b] = _f.sent();
                    _f.label = 9;
                case 9:
                    i++;
                    return [3 /*break*/, 7];
                case 10: return [2 /*return*/, msg];
                case 11:
                    if (!(schema.$ref != null)) return [3 /*break*/, 13];
                    return [4 /*yield*/, transform(ctx, schema.$ref, path, msg, fieldTransform)];
                case 12: return [2 /*return*/, _f.sent()];
                case 13:
                    type = getType(schema);
                    _c = type;
                    switch (_c) {
                        case serde_1.FieldType.RECORD: return [3 /*break*/, 14];
                        case serde_1.FieldType.ENUM: return [3 /*break*/, 19];
                        case serde_1.FieldType.STRING: return [3 /*break*/, 19];
                        case serde_1.FieldType.INT: return [3 /*break*/, 19];
                        case serde_1.FieldType.DOUBLE: return [3 /*break*/, 19];
                        case serde_1.FieldType.BOOLEAN: return [3 /*break*/, 19];
                    }
                    return [3 /*break*/, 21];
                case 14:
                    if (!(schema.properties != null)) return [3 /*break*/, 18];
                    _i = 0, _d = Object.entries(schema.properties);
                    _f.label = 15;
                case 15:
                    if (!(_i < _d.length)) return [3 /*break*/, 18];
                    _e = _d[_i], propName = _e[0], propSchema = _e[1];
                    return [4 /*yield*/, transformField(ctx, path, propName, msg, propSchema, fieldTransform)];
                case 16:
                    _f.sent();
                    _f.label = 17;
                case 17:
                    _i++;
                    return [3 /*break*/, 15];
                case 18: return [2 /*return*/, msg];
                case 19:
                    if (!(fieldCtx != null)) return [3 /*break*/, 21];
                    ruleTags = ctx.rule.tags;
                    if (!(ruleTags == null || ruleTags.length === 0 || !disjoint(new Set(ruleTags), fieldCtx.tags))) return [3 /*break*/, 21];
                    return [4 /*yield*/, fieldTransform.transform(ctx, fieldCtx, msg)];
                case 20: return [2 /*return*/, _f.sent()];
                case 21: return [2 /*return*/, msg];
            }
        });
    });
}
function transformField(ctx, path, propName, msg, propSchema, fieldTransform) {
    return __awaiter(this, void 0, void 0, function () {
        var fullName, value, newVal;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    fullName = path + '.' + propName;
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, , 3, 4]);
                    ctx.enterField(msg, fullName, propName, getType(propSchema), getInlineTags(propSchema));
                    value = msg[propName];
                    return [4 /*yield*/, transform(ctx, propSchema, fullName, value, fieldTransform)];
                case 2:
                    newVal = _a.sent();
                    if (ctx.rule.kind === 'CONDITION') {
                        if (newVal === false) {
                            throw new serde_1.RuleConditionError(ctx.rule);
                        }
                    }
                    else {
                        msg[propName] = newVal;
                    }
                    return [3 /*break*/, 4];
                case 3:
                    ctx.leaveField();
                    return [7 /*endfinally*/];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function validateSubschemas(subschemas, msg) {
    for (var _i = 0, subschemas_1 = subschemas; _i < subschemas_1.length; _i++) {
        var subschema = subschemas_1[_i];
        try {
            (0, json_schema_validation_1.validateJSON)(msg, subschema);
            return subschema;
        }
        catch (error) {
            // ignore
        }
    }
    return null;
}
function getType(schema) {
    if (typeof schema === 'boolean') {
        return serde_1.FieldType.NULL;
    }
    if (schema.type == null) {
        return serde_1.FieldType.NULL;
    }
    if (Array.isArray(schema.type)) {
        return serde_1.FieldType.COMBINED;
    }
    if (schema.const != null || schema.enum != null) {
        return serde_1.FieldType.ENUM;
    }
    switch (schema.type) {
        case 'object':
            if (schema.properties == null || Object.keys(schema.properties).length === 0) {
                return serde_1.FieldType.MAP;
            }
            return serde_1.FieldType.RECORD;
        case 'array':
            return serde_1.FieldType.ARRAY;
        case 'string':
            return serde_1.FieldType.STRING;
        case 'integer':
            return serde_1.FieldType.INT;
        case 'number':
            return serde_1.FieldType.DOUBLE;
        case 'boolean':
            return serde_1.FieldType.BOOLEAN;
        case 'null':
            return serde_1.FieldType.NULL;
        default:
            return serde_1.FieldType.NULL;
    }
}
function getInlineTags(schema) {
    var tagsKey = 'confluent:tags';
    return new Set(schema[tagsKey]);
}
function disjoint(tags1, tags2) {
    for (var _i = 0, tags1_1 = tags1; _i < tags1_1.length; _i++) {
        var tag = tags1_1[_i];
        if (tags2.has(tag)) {
            return false;
        }
    }
    return true;
}
