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
exports.RuleConditionError = exports.RuleError = exports.NoneAction = exports.ErrorAction = exports.FieldType = exports.FieldContext = exports.FieldRuleExecutor = exports.RuleContext = exports.TopicNameStrategy = exports.Deserializer = exports.Serializer = exports.Serde = exports.SerializationError = exports.MAGIC_BYTE = exports.SerdeType = void 0;
var wildcard_matcher_1 = require("./wildcard-matcher");
var schemaregistry_client_1 = require("../schemaregistry-client");
var rule_registry_1 = require("./rule-registry");
var SerdeType;
(function (SerdeType) {
    SerdeType["KEY"] = "KEY";
    SerdeType["VALUE"] = "VALUE";
})(SerdeType || (exports.SerdeType = SerdeType = {}));
exports.MAGIC_BYTE = Buffer.alloc(1);
/**
 * SerializationError represents a serialization error
 */
var SerializationError = /** @class */ (function (_super) {
    __extends(SerializationError, _super);
    function SerializationError(message) {
        return _super.call(this, message) || this;
    }
    return SerializationError;
}(Error));
exports.SerializationError = SerializationError;
/**
 * Serde represents a serializer/deserializer
 */
var Serde = /** @class */ (function () {
    function Serde(client, serdeType, conf, ruleRegistry) {
        this.fieldTransformer = null;
        this.client = client;
        this.serdeType = serdeType;
        this.conf = conf;
        this.ruleRegistry = ruleRegistry !== null && ruleRegistry !== void 0 ? ruleRegistry : rule_registry_1.RuleRegistry.getGlobalInstance();
    }
    Serde.prototype.close = function () {
        return;
    };
    Serde.prototype.subjectName = function (topic, info) {
        var _a;
        var strategy = (_a = this.conf.subjectNameStrategy) !== null && _a !== void 0 ? _a : exports.TopicNameStrategy;
        return strategy(topic, this.serdeType, info);
    };
    Serde.prototype.resolveReferences = function (client, schema, deps, format) {
        return __awaiter(this, void 0, void 0, function () {
            var references, _i, references_1, ref, metadata;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        references = schema.references;
                        if (references == null) {
                            return [2 /*return*/];
                        }
                        _i = 0, references_1 = references;
                        _a.label = 1;
                    case 1:
                        if (!(_i < references_1.length)) return [3 /*break*/, 5];
                        ref = references_1[_i];
                        return [4 /*yield*/, client.getSchemaMetadata(ref.subject, ref.version, true, format)];
                    case 2:
                        metadata = _a.sent();
                        deps.set(ref.name, metadata.schema);
                        return [4 /*yield*/, this.resolveReferences(client, metadata, deps)];
                    case 3:
                        _a.sent();
                        _a.label = 4;
                    case 4:
                        _i++;
                        return [3 /*break*/, 1];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    Serde.prototype.executeRules = function (subject, topic, ruleMode, source, target, msg, inlineTags) {
        return __awaiter(this, void 0, void 0, function () {
            var rules, i, rule, mode, ctx, ruleExecutor, result, error_1;
            var _a, _b, _c, _d;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        if (msg == null || target == null) {
                            return [2 /*return*/, msg];
                        }
                        switch (ruleMode) {
                            case schemaregistry_client_1.RuleMode.UPGRADE:
                                rules = (_a = target.ruleSet) === null || _a === void 0 ? void 0 : _a.migrationRules;
                                break;
                            case schemaregistry_client_1.RuleMode.DOWNGRADE:
                                rules = (_c = (_b = source === null || source === void 0 ? void 0 : source.ruleSet) === null || _b === void 0 ? void 0 : _b.migrationRules) === null || _c === void 0 ? void 0 : _c.map(function (x) { return x; }).reverse();
                                break;
                            default:
                                rules = (_d = target.ruleSet) === null || _d === void 0 ? void 0 : _d.domainRules;
                                if (ruleMode === schemaregistry_client_1.RuleMode.READ) {
                                    // Execute read rules in reverse order for symmetry
                                    rules = rules === null || rules === void 0 ? void 0 : rules.map(function (x) { return x; }).reverse();
                                }
                                break;
                        }
                        if (rules == null) {
                            return [2 /*return*/, msg];
                        }
                        i = 0;
                        _e.label = 1;
                    case 1:
                        if (!(i < rules.length)) return [3 /*break*/, 9];
                        rule = rules[i];
                        if (rule.disabled) {
                            return [3 /*break*/, 8];
                        }
                        mode = rule.mode;
                        switch (mode) {
                            case schemaregistry_client_1.RuleMode.WRITEREAD:
                                if (ruleMode !== schemaregistry_client_1.RuleMode.WRITE && ruleMode !== schemaregistry_client_1.RuleMode.READ) {
                                    return [3 /*break*/, 8];
                                }
                                break;
                            case schemaregistry_client_1.RuleMode.UPDOWN:
                                if (ruleMode !== schemaregistry_client_1.RuleMode.UPGRADE && ruleMode !== schemaregistry_client_1.RuleMode.DOWNGRADE) {
                                    return [3 /*break*/, 8];
                                }
                                break;
                            default:
                                if (mode !== ruleMode) {
                                    return [3 /*break*/, 8];
                                }
                                break;
                        }
                        ctx = new RuleContext(source, target, subject, topic, this.serdeType === SerdeType.KEY, ruleMode, rule, i, rules, inlineTags, this.fieldTransformer);
                        ruleExecutor = this.ruleRegistry.getExecutor(rule.type);
                        if (!(ruleExecutor == null)) return [3 /*break*/, 3];
                        return [4 /*yield*/, this.runAction(ctx, ruleMode, rule, rule.onFailure, msg, new Error("could not find rule executor of type ".concat(rule.type)), 'ERROR')];
                    case 2:
                        _e.sent();
                        return [2 /*return*/, msg];
                    case 3:
                        _e.trys.push([3, 6, , 8]);
                        return [4 /*yield*/, ruleExecutor.transform(ctx, msg)];
                    case 4:
                        result = _e.sent();
                        switch (rule.kind) {
                            case 'CONDITION':
                                if (result === false) {
                                    throw new RuleConditionError(rule);
                                }
                                break;
                            case 'TRANSFORM':
                                msg = result;
                                break;
                        }
                        return [4 /*yield*/, this.runAction(ctx, ruleMode, rule, msg != null ? rule.onSuccess : rule.onFailure, msg, null, msg != null ? 'NONE' : 'ERROR')];
                    case 5:
                        _e.sent();
                        return [3 /*break*/, 8];
                    case 6:
                        error_1 = _e.sent();
                        if (error_1 instanceof SerializationError) {
                            throw error_1;
                        }
                        return [4 /*yield*/, this.runAction(ctx, ruleMode, rule, rule.onFailure, msg, error_1, 'ERROR')];
                    case 7:
                        _e.sent();
                        return [3 /*break*/, 8];
                    case 8:
                        i++;
                        return [3 /*break*/, 1];
                    case 9: return [2 /*return*/, msg];
                }
            });
        });
    };
    Serde.prototype.runAction = function (ctx, ruleMode, rule, action, msg, err, defaultAction) {
        return __awaiter(this, void 0, void 0, function () {
            var actionName, ruleAction, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        actionName = this.getRuleActionName(rule, ruleMode, action);
                        if (actionName == null) {
                            actionName = defaultAction;
                        }
                        ruleAction = this.getRuleAction(ctx, actionName);
                        if (ruleAction == null) {
                            throw new RuleError("Could not find rule action of type ".concat(actionName));
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, ruleAction.run(ctx, msg, err)];
                    case 2:
                        _a.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        error_2 = _a.sent();
                        if (error_2 instanceof SerializationError) {
                            throw error_2;
                        }
                        console.warn("could not run post-rule action %s: %s", actionName, error_2);
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    Serde.prototype.getRuleActionName = function (rule, ruleMode, actionName) {
        if (actionName == null || actionName === '') {
            return null;
        }
        if ((rule.mode === schemaregistry_client_1.RuleMode.WRITEREAD || rule.mode === schemaregistry_client_1.RuleMode.UPDOWN) && actionName.includes(',')) {
            var parts = actionName.split(',');
            switch (ruleMode) {
                case schemaregistry_client_1.RuleMode.WRITE:
                case schemaregistry_client_1.RuleMode.UPGRADE:
                    return parts[0];
                case schemaregistry_client_1.RuleMode.READ:
                case schemaregistry_client_1.RuleMode.DOWNGRADE:
                    return parts[1];
            }
        }
        return actionName;
    };
    Serde.prototype.getRuleAction = function (ctx, actionName) {
        if (actionName === 'ERROR') {
            return new ErrorAction();
        }
        else if (actionName === 'NONE') {
            return new NoneAction();
        }
        return this.ruleRegistry.getAction(actionName);
    };
    return Serde;
}());
exports.Serde = Serde;
/**
 * Serializer represents a serializer
 */
var Serializer = /** @class */ (function (_super) {
    __extends(Serializer, _super);
    function Serializer(client, serdeType, conf, ruleRegistry) {
        return _super.call(this, client, serdeType, conf, ruleRegistry) || this;
    }
    Serializer.prototype.config = function () {
        return this.conf;
    };
    // GetID returns a schema ID for the given schema
    Serializer.prototype.getId = function (topic, msg, info, format) {
        return __awaiter(this, void 0, void 0, function () {
            var autoRegister, useSchemaId, useLatestWithMetadata, useLatest, normalizeSchema, id, subject, metadata, metadata;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        autoRegister = this.config().autoRegisterSchemas;
                        useSchemaId = this.config().useSchemaId;
                        useLatestWithMetadata = this.conf.useLatestWithMetadata;
                        useLatest = this.config().useLatestVersion;
                        normalizeSchema = this.config().normalizeSchemas;
                        id = -1;
                        subject = this.subjectName(topic, info);
                        if (!autoRegister) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.client.register(subject, info, Boolean(normalizeSchema))];
                    case 1:
                        id = _a.sent();
                        return [3 /*break*/, 10];
                    case 2:
                        if (!(useSchemaId != null && useSchemaId >= 0)) return [3 /*break*/, 4];
                        return [4 /*yield*/, this.client.getBySubjectAndId(subject, useSchemaId, format)];
                    case 3:
                        info = _a.sent();
                        id = useSchemaId;
                        return [3 /*break*/, 10];
                    case 4:
                        if (!(useLatestWithMetadata != null && Object.keys(useLatestWithMetadata).length !== 0)) return [3 /*break*/, 6];
                        return [4 /*yield*/, this.client.getLatestWithMetadata(subject, useLatestWithMetadata, true, format)];
                    case 5:
                        metadata = _a.sent();
                        info = metadata;
                        id = metadata.id;
                        return [3 /*break*/, 10];
                    case 6:
                        if (!useLatest) return [3 /*break*/, 8];
                        return [4 /*yield*/, this.client.getLatestSchemaMetadata(subject, format)];
                    case 7:
                        metadata = _a.sent();
                        info = metadata;
                        id = metadata.id;
                        return [3 /*break*/, 10];
                    case 8: return [4 /*yield*/, this.client.getId(subject, info, Boolean(normalizeSchema))];
                    case 9:
                        id = _a.sent();
                        _a.label = 10;
                    case 10: return [2 /*return*/, [id, info]];
                }
            });
        });
    };
    Serializer.prototype.writeBytes = function (id, msgBytes) {
        var idBuffer = Buffer.alloc(4);
        idBuffer.writeInt32BE(id, 0);
        return Buffer.concat([exports.MAGIC_BYTE, idBuffer, msgBytes]);
    };
    return Serializer;
}(Serde));
exports.Serializer = Serializer;
/**
 * Deserializer represents a deserializer
 */
var Deserializer = /** @class */ (function (_super) {
    __extends(Deserializer, _super);
    function Deserializer(client, serdeType, conf, ruleRegistry) {
        return _super.call(this, client, serdeType, conf, ruleRegistry) || this;
    }
    Deserializer.prototype.config = function () {
        return this.conf;
    };
    Deserializer.prototype.getSchema = function (topic, payload, format) {
        return __awaiter(this, void 0, void 0, function () {
            var magicByte, id, subject;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        magicByte = payload.subarray(0, 1);
                        if (!magicByte.equals(exports.MAGIC_BYTE)) {
                            throw new SerializationError("Message encoded with magic byte ".concat(JSON.stringify(magicByte), ", expected ").concat(JSON.stringify(exports.MAGIC_BYTE)));
                        }
                        id = payload.subarray(1, 5).readInt32BE(0);
                        subject = this.subjectName(topic);
                        return [4 /*yield*/, this.client.getBySubjectAndId(subject, id, format)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    Deserializer.prototype.getReaderSchema = function (subject, format) {
        return __awaiter(this, void 0, void 0, function () {
            var useLatestWithMetadata, useLatest;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        useLatestWithMetadata = this.config().useLatestWithMetadata;
                        useLatest = this.config().useLatestVersion;
                        if (!(useLatestWithMetadata != null && Object.keys(useLatestWithMetadata).length !== 0)) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.client.getLatestWithMetadata(subject, useLatestWithMetadata, true, format)];
                    case 1: return [2 /*return*/, _a.sent()];
                    case 2:
                        if (!useLatest) return [3 /*break*/, 4];
                        return [4 /*yield*/, this.client.getLatestSchemaMetadata(subject, format)];
                    case 3: return [2 /*return*/, _a.sent()];
                    case 4: return [2 /*return*/, null];
                }
            });
        });
    };
    Deserializer.prototype.hasRules = function (ruleSet, mode) {
        switch (mode) {
            case schemaregistry_client_1.RuleMode.UPGRADE:
            case schemaregistry_client_1.RuleMode.DOWNGRADE:
                return this.checkRules(ruleSet === null || ruleSet === void 0 ? void 0 : ruleSet.migrationRules, function (ruleMode) {
                    return ruleMode === mode || ruleMode === schemaregistry_client_1.RuleMode.UPDOWN;
                });
            case schemaregistry_client_1.RuleMode.UPDOWN:
                return this.checkRules(ruleSet === null || ruleSet === void 0 ? void 0 : ruleSet.migrationRules, function (ruleMode) {
                    return ruleMode === mode;
                });
            case schemaregistry_client_1.RuleMode.WRITE:
            case schemaregistry_client_1.RuleMode.READ:
                return this.checkRules(ruleSet === null || ruleSet === void 0 ? void 0 : ruleSet.domainRules, function (ruleMode) {
                    return ruleMode === mode || ruleMode === schemaregistry_client_1.RuleMode.WRITEREAD;
                });
            case schemaregistry_client_1.RuleMode.WRITEREAD:
                return this.checkRules(ruleSet === null || ruleSet === void 0 ? void 0 : ruleSet.domainRules, function (ruleMode) {
                    return ruleMode === mode;
                });
        }
    };
    Deserializer.prototype.checkRules = function (rules, filter) {
        if (rules == null) {
            return false;
        }
        for (var _i = 0, rules_1 = rules; _i < rules_1.length; _i++) {
            var rule = rules_1[_i];
            var ruleMode = rule.mode;
            if (ruleMode && filter(ruleMode)) {
                return true;
            }
        }
        return false;
    };
    Deserializer.prototype.getMigrations = function (subject, sourceInfo, target, format) {
        return __awaiter(this, void 0, void 0, function () {
            var version, source, migrationMode, migrations, first, last, previous, versions, i, version_1, m;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.client.getVersion(subject, sourceInfo, false)];
                    case 1:
                        version = _a.sent();
                        source = {
                            id: 0,
                            version: version,
                            schema: sourceInfo.schema,
                            references: sourceInfo.references,
                            metadata: sourceInfo.metadata,
                            ruleSet: sourceInfo.ruleSet,
                        };
                        migrations = [];
                        if (source.version < target.version) {
                            migrationMode = schemaregistry_client_1.RuleMode.UPGRADE;
                            first = source;
                            last = target;
                        }
                        else if (source.version > target.version) {
                            migrationMode = schemaregistry_client_1.RuleMode.DOWNGRADE;
                            first = target;
                            last = source;
                        }
                        else {
                            return [2 /*return*/, migrations];
                        }
                        previous = null;
                        return [4 /*yield*/, this.getSchemasBetween(subject, first, last, format)];
                    case 2:
                        versions = _a.sent();
                        for (i = 0; i < versions.length; i++) {
                            version_1 = versions[i];
                            if (i === 0) {
                                previous = version_1;
                                continue;
                            }
                            if (version_1.ruleSet != null && this.hasRules(version_1.ruleSet, migrationMode)) {
                                m = void 0;
                                if (migrationMode === schemaregistry_client_1.RuleMode.UPGRADE) {
                                    m = {
                                        ruleMode: migrationMode,
                                        source: previous,
                                        target: version_1,
                                    };
                                }
                                else {
                                    m = {
                                        ruleMode: migrationMode,
                                        source: version_1,
                                        target: previous,
                                    };
                                }
                                migrations.push(m);
                            }
                            previous = version_1;
                        }
                        if (migrationMode === schemaregistry_client_1.RuleMode.DOWNGRADE) {
                            migrations = migrations.reverse();
                        }
                        return [2 /*return*/, migrations];
                }
            });
        });
    };
    Deserializer.prototype.getSchemasBetween = function (subject, first, last, format) {
        return __awaiter(this, void 0, void 0, function () {
            var version1, version2, result, i, meta;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (last.version - first.version <= 1) {
                            return [2 /*return*/, [first, last]];
                        }
                        version1 = first.version;
                        version2 = last.version;
                        result = [first];
                        i = version1 + 1;
                        _a.label = 1;
                    case 1:
                        if (!(i < version2)) return [3 /*break*/, 4];
                        return [4 /*yield*/, this.client.getSchemaMetadata(subject, i, true, format)];
                    case 2:
                        meta = _a.sent();
                        result.push(meta);
                        _a.label = 3;
                    case 3:
                        i++;
                        return [3 /*break*/, 1];
                    case 4:
                        result.push(last);
                        return [2 /*return*/, result];
                }
            });
        });
    };
    Deserializer.prototype.executeMigrations = function (migrations, subject, topic, msg) {
        return __awaiter(this, void 0, void 0, function () {
            var _i, migrations_1, migration;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _i = 0, migrations_1 = migrations;
                        _a.label = 1;
                    case 1:
                        if (!(_i < migrations_1.length)) return [3 /*break*/, 4];
                        migration = migrations_1[_i];
                        return [4 /*yield*/, this.executeRules(subject, topic, migration.ruleMode, migration.source, migration.target, msg, null)];
                    case 2:
                        // TODO fix source, target?
                        msg = _a.sent();
                        _a.label = 3;
                    case 3:
                        _i++;
                        return [3 /*break*/, 1];
                    case 4: return [2 /*return*/, msg];
                }
            });
        });
    };
    return Deserializer;
}(Serde));
exports.Deserializer = Deserializer;
/**
 * TopicNameStrategy creates a subject name by appending -[key|value] to the topic name.
 * @param topic - the topic name
 * @param serdeType - the serde type
 */
var TopicNameStrategy = function (topic, serdeType) {
    var suffix = '-value';
    if (serdeType === SerdeType.KEY) {
        suffix = '-key';
    }
    return topic + suffix;
};
exports.TopicNameStrategy = TopicNameStrategy;
/**
 * RuleContext represents a rule context
 */
var RuleContext = /** @class */ (function () {
    function RuleContext(source, target, subject, topic, isKey, ruleMode, rule, index, rules, inlineTags, fieldTransformer) {
        this.source = source;
        this.target = target;
        this.subject = subject;
        this.topic = topic;
        this.isKey = isKey;
        this.ruleMode = ruleMode;
        this.rule = rule;
        this.index = index;
        this.rules = rules;
        this.inlineTags = inlineTags;
        this.fieldTransformer = fieldTransformer;
        this.fieldContexts = [];
    }
    RuleContext.prototype.getParameter = function (name) {
        var params = this.rule.params;
        if (params != null) {
            var value = params[name];
            if (value != null) {
                return value;
            }
        }
        var metadata = this.target.metadata;
        if (metadata != null && metadata.properties != null) {
            var value = metadata.properties[name];
            if (value != null) {
                return value;
            }
        }
        return null;
    };
    RuleContext.prototype.getInlineTags = function (name) {
        var _a;
        var tags = (_a = this.inlineTags) === null || _a === void 0 ? void 0 : _a.get(name);
        if (tags != null) {
            return tags;
        }
        return new Set();
    };
    RuleContext.prototype.currentField = function () {
        var size = this.fieldContexts.length;
        if (size === 0) {
            return null;
        }
        return this.fieldContexts[size - 1];
    };
    RuleContext.prototype.enterField = function (containingMessage, fullName, name, fieldType, tags) {
        var allTags = new Set(tags !== null && tags !== void 0 ? tags : this.getInlineTags(fullName));
        for (var _i = 0, _a = this.getTags(fullName); _i < _a.length; _i++) {
            var v = _a[_i];
            allTags.add(v);
        }
        var fieldContext = new FieldContext(containingMessage, fullName, name, fieldType, allTags);
        this.fieldContexts.push(fieldContext);
        return fieldContext;
    };
    RuleContext.prototype.getTags = function (fullName) {
        var tags = new Set();
        var metadata = this.target.metadata;
        if ((metadata === null || metadata === void 0 ? void 0 : metadata.tags) != null) {
            for (var _i = 0, _a = Object.entries(metadata.tags); _i < _a.length; _i++) {
                var _b = _a[_i], k = _b[0], v = _b[1];
                if ((0, wildcard_matcher_1.match)(fullName, k)) {
                    for (var _c = 0, v_1 = v; _c < v_1.length; _c++) {
                        var tag = v_1[_c];
                        tags.add(tag);
                    }
                }
            }
        }
        return tags;
    };
    RuleContext.prototype.leaveField = function () {
        var size = this.fieldContexts.length - 1;
        this.fieldContexts = this.fieldContexts.slice(0, size);
    };
    return RuleContext;
}());
exports.RuleContext = RuleContext;
/**
 * FieldRuleExecutor represents a field rule executor
 */
var FieldRuleExecutor = /** @class */ (function () {
    function FieldRuleExecutor() {
        this.config = null;
    }
    FieldRuleExecutor.prototype.transform = function (ctx, msg) {
        return __awaiter(this, void 0, void 0, function () {
            var i, otherRule, i, otherRule, fieldTransform;
            return __generator(this, function (_a) {
                // TODO preserve source
                switch (ctx.ruleMode) {
                    case schemaregistry_client_1.RuleMode.WRITE:
                    case schemaregistry_client_1.RuleMode.UPGRADE:
                        for (i = 0; i < ctx.index; i++) {
                            otherRule = ctx.rules[i];
                            if (areTransformsWithSameTag(ctx.rule, otherRule)) {
                                // ignore this transform if an earlier one has the same tag
                                return [2 /*return*/, msg];
                            }
                        }
                        break;
                    case schemaregistry_client_1.RuleMode.READ:
                    case schemaregistry_client_1.RuleMode.DOWNGRADE:
                        for (i = ctx.index + 1; i < ctx.rules.length; i++) {
                            otherRule = ctx.rules[i];
                            if (areTransformsWithSameTag(ctx.rule, otherRule)) {
                                // ignore this transform if a later one has the same tag
                                return [2 /*return*/, msg];
                            }
                        }
                        break;
                }
                fieldTransform = this.newTransform(ctx);
                return [2 /*return*/, ctx.fieldTransformer(ctx, fieldTransform, msg)];
            });
        });
    };
    return FieldRuleExecutor;
}());
exports.FieldRuleExecutor = FieldRuleExecutor;
function areTransformsWithSameTag(rule1, rule2) {
    return rule1.tags != null && rule1.tags.length > 0
        && rule1.kind === 'TRANSFORM'
        && rule1.kind === rule2.kind
        && rule1.mode === rule2.mode
        && rule1.type === rule2.type
        && rule1.tags === rule2.tags;
}
/**
 * FieldContext represents a field context
 */
var FieldContext = /** @class */ (function () {
    function FieldContext(containingMessage, fullName, name, fieldType, tags) {
        this.containingMessage = containingMessage;
        this.fullName = fullName;
        this.name = name;
        this.type = fieldType;
        this.tags = new Set(tags);
    }
    FieldContext.prototype.isPrimitive = function () {
        var t = this.type;
        return t === FieldType.STRING || t === FieldType.BYTES || t === FieldType.INT
            || t === FieldType.LONG || t === FieldType.FLOAT || t === FieldType.DOUBLE
            || t === FieldType.BOOLEAN || t === FieldType.NULL;
    };
    FieldContext.prototype.typeName = function () {
        return this.type.toString();
    };
    return FieldContext;
}());
exports.FieldContext = FieldContext;
var FieldType;
(function (FieldType) {
    FieldType["RECORD"] = "RECORD";
    FieldType["ENUM"] = "ENUM";
    FieldType["ARRAY"] = "ARRAY";
    FieldType["MAP"] = "MAP";
    FieldType["COMBINED"] = "COMBINED";
    FieldType["FIXED"] = "FIXED";
    FieldType["STRING"] = "STRING";
    FieldType["BYTES"] = "BYTES";
    FieldType["INT"] = "INT";
    FieldType["LONG"] = "LONG";
    FieldType["FLOAT"] = "FLOAT";
    FieldType["DOUBLE"] = "DOUBLE";
    FieldType["BOOLEAN"] = "BOOLEAN";
    FieldType["NULL"] = "NULL";
})(FieldType || (exports.FieldType = FieldType = {}));
/**
 * ErrorAction represents an error action
 */
var ErrorAction = /** @class */ (function () {
    function ErrorAction() {
    }
    ErrorAction.prototype.configure = function (clientConfig, config) {
    };
    ErrorAction.prototype.type = function () {
        return 'ERROR';
    };
    ErrorAction.prototype.run = function (ctx, msg, err) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                throw new SerializationError(err.message);
            });
        });
    };
    ErrorAction.prototype.close = function () {
    };
    return ErrorAction;
}());
exports.ErrorAction = ErrorAction;
/**
 * NoneAction represents a no-op action
 */
var NoneAction = /** @class */ (function () {
    function NoneAction() {
    }
    NoneAction.prototype.configure = function (clientConfig, config) {
    };
    NoneAction.prototype.type = function () {
        return 'NONE';
    };
    NoneAction.prototype.run = function (ctx, msg, err) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/];
            });
        });
    };
    NoneAction.prototype.close = function () {
    };
    return NoneAction;
}());
exports.NoneAction = NoneAction;
/**
 * RuleError represents a rule error
 */
var RuleError = /** @class */ (function (_super) {
    __extends(RuleError, _super);
    /**
     * Creates a new rule error.
     * @param message - The error message.
     */
    function RuleError(message) {
        return _super.call(this, message) || this;
    }
    return RuleError;
}(Error));
exports.RuleError = RuleError;
/**
 * RuleConditionError represents a rule condition error
 */
var RuleConditionError = /** @class */ (function (_super) {
    __extends(RuleConditionError, _super);
    /**
     * Creates a new rule condition error.
     * @param rule - The rule.
     */
    function RuleConditionError(rule) {
        var _this = _super.call(this, RuleConditionError.error(rule)) || this;
        _this.rule = rule;
        return _this;
    }
    RuleConditionError.error = function (rule) {
        var errMsg = rule.doc;
        if (!errMsg) {
            if (rule.expr !== '') {
                return "Expr failed: '".concat(rule.expr, "'");
            }
            return "Condition failed: '".concat(rule.name, "'");
        }
        return errMsg;
    };
    return RuleConditionError;
}(RuleError));
exports.RuleConditionError = RuleConditionError;
