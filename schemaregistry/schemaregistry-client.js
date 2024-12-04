"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
exports.SchemaRegistryClient = exports.RuleMode = exports.Compatibility = void 0;
exports.minimize = minimize;
var rest_service_1 = require("./rest-service");
var stringify = require('json-stringify-deterministic');
var lru_cache_1 = require("lru-cache");
var async_mutex_1 = require("async-mutex");
var mock_schemaregistry_client_1 = require("./mock-schemaregistry-client");
/*
 * Confluent-Schema-Registry-TypeScript - Node.js wrapper for Confluent Schema Registry
 *
 * Copyright (c) 2024 Confluent, Inc.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license.  See the LICENSE.txt file for details.
 */
var Compatibility;
(function (Compatibility) {
    Compatibility["NONE"] = "NONE";
    Compatibility["BACKWARD"] = "BACKWARD";
    Compatibility["FORWARD"] = "FORWARD";
    Compatibility["FULL"] = "FULL";
    Compatibility["BACKWARD_TRANSITIVE"] = "BACKWARD_TRANSITIVE";
    Compatibility["FORWARD_TRANSITIVE"] = "FORWARD_TRANSITIVE";
    Compatibility["FULL_TRANSITIVE"] = "FULL_TRANSITIVE";
})(Compatibility || (exports.Compatibility = Compatibility = {}));
var RuleMode;
(function (RuleMode) {
    RuleMode["UPGRADE"] = "UPGRADE";
    RuleMode["DOWNGRADE"] = "DOWNGRADE";
    RuleMode["UPDOWN"] = "UPDOWN";
    RuleMode["WRITE"] = "WRITE";
    RuleMode["READ"] = "READ";
    RuleMode["WRITEREAD"] = "WRITEREAD";
})(RuleMode || (exports.RuleMode = RuleMode = {}));
// Ensure that SchemaMetadata fields are removed from the SchemaInfo
function minimize(info) {
    return {
        schemaType: info.schemaType,
        schema: info.schema,
        references: info.references,
        metadata: info.metadata,
        ruleSet: info.ruleSet
    };
}
/**
 * SchemaRegistryClient is a client for interacting with the Confluent Schema Registry.
 * This client will cache responses from Schema Registry to reduce network requests.
 */
var SchemaRegistryClient = /** @class */ (function () {
    /**
     * Create a new Schema Registry client.
     * @param config - The client configuration.
     */
    function SchemaRegistryClient(config) {
        this.clientConfig = config;
        var cacheOptions = __assign({ max: config.cacheCapacity !== undefined ? config.cacheCapacity : 1000 }, (config.cacheLatestTtlSecs !== undefined && { maxAge: config.cacheLatestTtlSecs * 1000 }));
        this.restService = new rest_service_1.RestService(config.baseURLs, config.isForward, config.createAxiosDefaults, config.basicAuthCredentials, config.bearerAuthCredentials);
        this.schemaToIdCache = new lru_cache_1.LRUCache(cacheOptions);
        this.idToSchemaInfoCache = new lru_cache_1.LRUCache(cacheOptions);
        this.infoToSchemaCache = new lru_cache_1.LRUCache(cacheOptions);
        this.latestToSchemaCache = new lru_cache_1.LRUCache(cacheOptions);
        this.schemaToVersionCache = new lru_cache_1.LRUCache(cacheOptions);
        this.versionToSchemaCache = new lru_cache_1.LRUCache(cacheOptions);
        this.metadataToSchemaCache = new lru_cache_1.LRUCache(cacheOptions);
        this.schemaToIdMutex = new async_mutex_1.Mutex();
        this.idToSchemaInfoMutex = new async_mutex_1.Mutex();
        this.infoToSchemaMutex = new async_mutex_1.Mutex();
        this.latestToSchemaMutex = new async_mutex_1.Mutex();
        this.schemaToVersionMutex = new async_mutex_1.Mutex();
        this.versionToSchemaMutex = new async_mutex_1.Mutex();
        this.metadataToSchemaMutex = new async_mutex_1.Mutex();
    }
    SchemaRegistryClient.newClient = function (config) {
        var url = config.baseURLs[0];
        if (url.startsWith("mock://")) {
            return new mock_schemaregistry_client_1.MockClient(config);
        }
        return new SchemaRegistryClient(config);
    };
    SchemaRegistryClient.prototype.config = function () {
        return this.clientConfig;
    };
    /**
     * Register a schema with the Schema Registry and return the schema ID.
     * @param subject - The subject under which to register the schema.
     * @param schema - The schema to register.
     * @param normalize - Whether to normalize the schema before registering.
     */
    SchemaRegistryClient.prototype.register = function (subject_1, schema_1) {
        return __awaiter(this, arguments, void 0, function (subject, schema, normalize) {
            var metadataResult;
            if (normalize === void 0) { normalize = false; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.registerFullResponse(subject, schema, normalize)];
                    case 1:
                        metadataResult = _a.sent();
                        return [2 /*return*/, metadataResult.id];
                }
            });
        });
    };
    /**
     * Register a schema with the Schema Registry and return the full response.
     * @param subject - The subject under which to register the schema.
     * @param schema - The schema to register.
     * @param normalize - Whether to normalize the schema before registering.
     */
    SchemaRegistryClient.prototype.registerFullResponse = function (subject_1, schema_1) {
        return __awaiter(this, arguments, void 0, function (subject, schema, normalize) {
            var cacheKey;
            var _this = this;
            if (normalize === void 0) { normalize = false; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        cacheKey = stringify({ subject: subject, schema: minimize(schema) });
                        return [4 /*yield*/, this.infoToSchemaMutex.runExclusive(function () { return __awaiter(_this, void 0, void 0, function () {
                                var cachedSchemaMetadata, response;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0:
                                            cachedSchemaMetadata = this.infoToSchemaCache.get(cacheKey);
                                            if (cachedSchemaMetadata) {
                                                return [2 /*return*/, cachedSchemaMetadata];
                                            }
                                            subject = encodeURIComponent(subject);
                                            return [4 /*yield*/, this.restService.handleRequest("/subjects/".concat(subject, "/versions?normalize=").concat(normalize), 'POST', schema)];
                                        case 1:
                                            response = _a.sent();
                                            this.infoToSchemaCache.set(cacheKey, response.data);
                                            return [2 /*return*/, response.data];
                                    }
                                });
                            }); })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    /**
     * Get a schema by subject and ID.
     * @param subject - The subject under which the schema is registered.
     * @param id - The schema ID.
     * @param format - The format of the schema.
     */
    SchemaRegistryClient.prototype.getBySubjectAndId = function (subject, id, format) {
        return __awaiter(this, void 0, void 0, function () {
            var cacheKey;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        cacheKey = stringify({ subject: subject, id: id });
                        return [4 /*yield*/, this.idToSchemaInfoMutex.runExclusive(function () { return __awaiter(_this, void 0, void 0, function () {
                                var cachedSchema, formatStr, response;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0:
                                            cachedSchema = this.idToSchemaInfoCache.get(cacheKey);
                                            if (cachedSchema) {
                                                return [2 /*return*/, cachedSchema];
                                            }
                                            subject = encodeURIComponent(subject);
                                            formatStr = format != null ? "&format=".concat(format) : '';
                                            return [4 /*yield*/, this.restService.handleRequest("/schemas/ids/".concat(id, "?subject=").concat(subject).concat(formatStr), 'GET')];
                                        case 1:
                                            response = _a.sent();
                                            this.idToSchemaInfoCache.set(cacheKey, response.data);
                                            return [2 /*return*/, response.data];
                                    }
                                });
                            }); })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    /**
     * Get the ID for a schema.
     * @param subject - The subject under which the schema is registered.
     * @param schema - The schema whose ID to get.
     * @param normalize - Whether to normalize the schema before getting the ID.
     */
    SchemaRegistryClient.prototype.getId = function (subject_1, schema_1) {
        return __awaiter(this, arguments, void 0, function (subject, schema, normalize) {
            var cacheKey;
            var _this = this;
            if (normalize === void 0) { normalize = false; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        cacheKey = stringify({ subject: subject, schema: minimize(schema) });
                        return [4 /*yield*/, this.schemaToIdMutex.runExclusive(function () { return __awaiter(_this, void 0, void 0, function () {
                                var cachedId, response;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0:
                                            cachedId = this.schemaToIdCache.get(cacheKey);
                                            if (cachedId) {
                                                return [2 /*return*/, cachedId];
                                            }
                                            subject = encodeURIComponent(subject);
                                            return [4 /*yield*/, this.restService.handleRequest("/subjects/".concat(subject, "?normalize=").concat(normalize), 'POST', schema)];
                                        case 1:
                                            response = _a.sent();
                                            this.schemaToIdCache.set(cacheKey, response.data.id);
                                            return [2 /*return*/, response.data.id];
                                    }
                                });
                            }); })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    /**
     * Get the latest schema metadata for a subject.
     * @param subject - The subject for which to get the latest schema metadata.
     * @param format - The format of the schema.
     */
    SchemaRegistryClient.prototype.getLatestSchemaMetadata = function (subject, format) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.latestToSchemaMutex.runExclusive(function () { return __awaiter(_this, void 0, void 0, function () {
                            var cachedSchema, formatStr, response;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        cachedSchema = this.latestToSchemaCache.get(subject);
                                        if (cachedSchema) {
                                            return [2 /*return*/, cachedSchema];
                                        }
                                        subject = encodeURIComponent(subject);
                                        formatStr = format != null ? "?format=".concat(format) : '';
                                        return [4 /*yield*/, this.restService.handleRequest("/subjects/".concat(subject, "/versions/latest").concat(formatStr), 'GET')];
                                    case 1:
                                        response = _a.sent();
                                        this.latestToSchemaCache.set(subject, response.data);
                                        return [2 /*return*/, response.data];
                                }
                            });
                        }); })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    /**
     * Get the schema metadata for a subject and version.
     * @param subject - The subject for which to get the schema metadata.
     * @param version - The version of the schema.
     * @param deleted - Whether to include deleted schemas.
     * @param format - The format of the schema.
     */
    SchemaRegistryClient.prototype.getSchemaMetadata = function (subject_1, version_1) {
        return __awaiter(this, arguments, void 0, function (subject, version, deleted, format) {
            var cacheKey;
            var _this = this;
            if (deleted === void 0) { deleted = false; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        cacheKey = stringify({ subject: subject, version: version, deleted: deleted });
                        return [4 /*yield*/, this.versionToSchemaMutex.runExclusive(function () { return __awaiter(_this, void 0, void 0, function () {
                                var cachedSchemaMetadata, formatStr, response;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0:
                                            cachedSchemaMetadata = this.versionToSchemaCache.get(cacheKey);
                                            if (cachedSchemaMetadata) {
                                                return [2 /*return*/, cachedSchemaMetadata];
                                            }
                                            subject = encodeURIComponent(subject);
                                            formatStr = format != null ? "&format=".concat(format) : '';
                                            return [4 /*yield*/, this.restService.handleRequest("/subjects/".concat(subject, "/versions/").concat(version, "?deleted=").concat(deleted).concat(formatStr), 'GET')];
                                        case 1:
                                            response = _a.sent();
                                            this.versionToSchemaCache.set(cacheKey, response.data);
                                            return [2 /*return*/, response.data];
                                    }
                                });
                            }); })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    /**
     * Get the latest schema metadata for a subject with the given metadata.
     * @param subject - The subject for which to get the latest schema metadata.
     * @param metadata - The metadata to match.
     * @param deleted - Whether to include deleted schemas.
     * @param format - The format of the schema.
     */
    SchemaRegistryClient.prototype.getLatestWithMetadata = function (subject_1, metadata_1) {
        return __awaiter(this, arguments, void 0, function (subject, metadata, deleted, format) {
            var cacheKey;
            var _this = this;
            if (deleted === void 0) { deleted = false; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        cacheKey = stringify({ subject: subject, metadata: metadata, deleted: deleted });
                        return [4 /*yield*/, this.metadataToSchemaMutex.runExclusive(function () { return __awaiter(_this, void 0, void 0, function () {
                                var cachedSchemaMetadata, metadataStr, key, encodedKey, encodedValue, formatStr, response;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0:
                                            cachedSchemaMetadata = this.metadataToSchemaCache.get(cacheKey);
                                            if (cachedSchemaMetadata) {
                                                return [2 /*return*/, cachedSchemaMetadata];
                                            }
                                            subject = encodeURIComponent(subject);
                                            metadataStr = '';
                                            for (key in metadata) {
                                                encodedKey = encodeURIComponent(key);
                                                encodedValue = encodeURIComponent(metadata[key]);
                                                metadataStr += "&key=".concat(encodedKey, "&value=").concat(encodedValue);
                                            }
                                            formatStr = format != null ? "&format=".concat(format) : '';
                                            return [4 /*yield*/, this.restService.handleRequest("/subjects/".concat(subject, "/metadata?deleted=").concat(deleted, "&").concat(metadataStr).concat(formatStr), 'GET')];
                                        case 1:
                                            response = _a.sent();
                                            this.metadataToSchemaCache.set(cacheKey, response.data);
                                            return [2 /*return*/, response.data];
                                    }
                                });
                            }); })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    /**
     * Get all versions of a schema for a subject.
     * @param subject - The subject for which to get all versions.
     */
    SchemaRegistryClient.prototype.getAllVersions = function (subject) {
        return __awaiter(this, void 0, void 0, function () {
            var response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.restService.handleRequest("/subjects/".concat(subject, "/versions"), 'GET')];
                    case 1:
                        response = _a.sent();
                        return [2 /*return*/, response.data];
                }
            });
        });
    };
    /**
     * Get the version of a schema for a subject.
     * @param subject - The subject for which to get the version.
     * @param schema - The schema for which to get the version.
     * @param normalize - Whether to normalize the schema before getting the version.
     */
    SchemaRegistryClient.prototype.getVersion = function (subject_1, schema_1) {
        return __awaiter(this, arguments, void 0, function (subject, schema, normalize) {
            var cacheKey;
            var _this = this;
            if (normalize === void 0) { normalize = false; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        cacheKey = stringify({ subject: subject, schema: minimize(schema) });
                        return [4 /*yield*/, this.schemaToVersionMutex.runExclusive(function () { return __awaiter(_this, void 0, void 0, function () {
                                var cachedVersion, response;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0:
                                            cachedVersion = this.schemaToVersionCache.get(cacheKey);
                                            if (cachedVersion) {
                                                return [2 /*return*/, cachedVersion];
                                            }
                                            subject = encodeURIComponent(subject);
                                            return [4 /*yield*/, this.restService.handleRequest("/subjects/".concat(subject, "?normalize=").concat(normalize), 'POST', schema)];
                                        case 1:
                                            response = _a.sent();
                                            this.schemaToVersionCache.set(cacheKey, response.data.version);
                                            return [2 /*return*/, response.data.version];
                                    }
                                });
                            }); })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    /**
     * Get all subjects in the Schema Registry.
     */
    SchemaRegistryClient.prototype.getAllSubjects = function () {
        return __awaiter(this, void 0, void 0, function () {
            var response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.restService.handleRequest("/subjects", 'GET')];
                    case 1:
                        response = _a.sent();
                        return [2 /*return*/, response.data];
                }
            });
        });
    };
    /**
     * Delete a subject from the Schema Registry.
     * @param subject - The subject to delete.
     * @param permanent - Whether to permanently delete the subject.
     */
    SchemaRegistryClient.prototype.deleteSubject = function (subject_1) {
        return __awaiter(this, arguments, void 0, function (subject, permanent) {
            var response;
            var _this = this;
            if (permanent === void 0) { permanent = false; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.infoToSchemaMutex.runExclusive(function () { return __awaiter(_this, void 0, void 0, function () {
                            var _this = this;
                            return __generator(this, function (_a) {
                                this.infoToSchemaCache.forEach(function (_, key) {
                                    var parsedKey = JSON.parse(key);
                                    if (parsedKey.subject === subject) {
                                        _this.infoToSchemaCache.delete(key);
                                    }
                                });
                                return [2 /*return*/];
                            });
                        }); })];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, this.schemaToVersionMutex.runExclusive(function () { return __awaiter(_this, void 0, void 0, function () {
                                var _this = this;
                                return __generator(this, function (_a) {
                                    this.schemaToVersionCache.forEach(function (_, key) {
                                        var parsedKey = JSON.parse(key);
                                        if (parsedKey.subject === subject) {
                                            _this.schemaToVersionCache.delete(key);
                                        }
                                    });
                                    return [2 /*return*/];
                                });
                            }); })];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, this.versionToSchemaMutex.runExclusive(function () { return __awaiter(_this, void 0, void 0, function () {
                                var _this = this;
                                return __generator(this, function (_a) {
                                    this.versionToSchemaCache.forEach(function (_, key) {
                                        var parsedKey = JSON.parse(key);
                                        if (parsedKey.subject === subject) {
                                            _this.versionToSchemaCache.delete(key);
                                        }
                                    });
                                    return [2 /*return*/];
                                });
                            }); })];
                    case 3:
                        _a.sent();
                        return [4 /*yield*/, this.idToSchemaInfoMutex.runExclusive(function () { return __awaiter(_this, void 0, void 0, function () {
                                var _this = this;
                                return __generator(this, function (_a) {
                                    this.idToSchemaInfoCache.forEach(function (_, key) {
                                        var parsedKey = JSON.parse(key);
                                        if (parsedKey.subject === subject) {
                                            _this.idToSchemaInfoCache.delete(key);
                                        }
                                    });
                                    return [2 /*return*/];
                                });
                            }); })];
                    case 4:
                        _a.sent();
                        subject = encodeURIComponent(subject);
                        return [4 /*yield*/, this.restService.handleRequest("/subjects/".concat(subject, "?permanent=").concat(permanent), 'DELETE')];
                    case 5:
                        response = _a.sent();
                        return [2 /*return*/, response.data];
                }
            });
        });
    };
    /**
     * Delete a version of a subject from the Schema Registry.
     * @param subject - The subject to delete.
     * @param version - The version to delete.
     * @param permanent - Whether to permanently delete the version.
     */
    SchemaRegistryClient.prototype.deleteSubjectVersion = function (subject_1, version_1) {
        return __awaiter(this, arguments, void 0, function (subject, version, permanent) {
            var _this = this;
            if (permanent === void 0) { permanent = false; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.schemaToVersionMutex.runExclusive(function () { return __awaiter(_this, void 0, void 0, function () {
                            var metadataValue, cacheKey, response;
                            var _this = this;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        this.schemaToVersionCache.forEach(function (value, key) {
                                            var parsedKey = JSON.parse(key);
                                            if (parsedKey.subject === subject && value === version) {
                                                _this.schemaToVersionCache.delete(key);
                                                var infoToSchemaCacheKey_1 = stringify({ subject: subject, schema: minimize(parsedKey.schema) });
                                                _this.infoToSchemaMutex.runExclusive(function () { return __awaiter(_this, void 0, void 0, function () {
                                                    var cacheKeyID_1;
                                                    var _this = this;
                                                    return __generator(this, function (_a) {
                                                        metadataValue = this.infoToSchemaCache.get(infoToSchemaCacheKey_1);
                                                        if (metadataValue) {
                                                            this.infoToSchemaCache.delete(infoToSchemaCacheKey_1);
                                                            cacheKeyID_1 = stringify({ subject: subject, id: metadataValue.id });
                                                            this.idToSchemaInfoMutex.runExclusive(function () { return __awaiter(_this, void 0, void 0, function () {
                                                                return __generator(this, function (_a) {
                                                                    this.idToSchemaInfoCache.delete(cacheKeyID_1);
                                                                    return [2 /*return*/];
                                                                });
                                                            }); });
                                                        }
                                                        return [2 /*return*/];
                                                    });
                                                }); });
                                            }
                                        });
                                        cacheKey = stringify({ subject: subject, version: version });
                                        this.versionToSchemaMutex.runExclusive(function () { return __awaiter(_this, void 0, void 0, function () {
                                            return __generator(this, function (_a) {
                                                this.versionToSchemaCache.delete(cacheKey);
                                                return [2 /*return*/];
                                            });
                                        }); });
                                        subject = encodeURIComponent(subject);
                                        return [4 /*yield*/, this.restService.handleRequest("/subjects/".concat(subject, "/versions/").concat(version, "?permanent=").concat(permanent), 'DELETE')];
                                    case 1:
                                        response = _a.sent();
                                        return [2 /*return*/, response.data];
                                }
                            });
                        }); })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    /**
     * Test the compatibility of a schema with the latest schema for a subject.
     * @param subject - The subject for which to test compatibility.
     * @param schema - The schema to test compatibility.
     */
    SchemaRegistryClient.prototype.testSubjectCompatibility = function (subject, schema) {
        return __awaiter(this, void 0, void 0, function () {
            var response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        subject = encodeURIComponent(subject);
                        return [4 /*yield*/, this.restService.handleRequest("/compatibility/subjects/".concat(subject, "/versions/latest"), 'POST', schema)];
                    case 1:
                        response = _a.sent();
                        return [2 /*return*/, response.data.is_compatible];
                }
            });
        });
    };
    /**
     * Test the compatibility of a schema with a specific version of a subject.
     * @param subject - The subject for which to test compatibility.
     * @param version - The version of the schema for which to test compatibility.
     * @param schema - The schema to test compatibility.
     */
    SchemaRegistryClient.prototype.testCompatibility = function (subject, version, schema) {
        return __awaiter(this, void 0, void 0, function () {
            var response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        subject = encodeURIComponent(subject);
                        return [4 /*yield*/, this.restService.handleRequest("/compatibility/subjects/".concat(subject, "/versions/").concat(version), 'POST', schema)];
                    case 1:
                        response = _a.sent();
                        return [2 /*return*/, response.data.is_compatible];
                }
            });
        });
    };
    /**
     * Get the compatibility level for a subject.
     * @param subject - The subject for which to get the compatibility level.
     */
    SchemaRegistryClient.prototype.getCompatibility = function (subject) {
        return __awaiter(this, void 0, void 0, function () {
            var response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        subject = encodeURIComponent(subject);
                        return [4 /*yield*/, this.restService.handleRequest("/config/".concat(subject), 'GET')];
                    case 1:
                        response = _a.sent();
                        return [2 /*return*/, response.data.compatibilityLevel];
                }
            });
        });
    };
    /**
     * Update the compatibility level for a subject.
     * @param subject - The subject for which to update the compatibility level.
     * @param update - The compatibility level to update to.
     */
    SchemaRegistryClient.prototype.updateCompatibility = function (subject, update) {
        return __awaiter(this, void 0, void 0, function () {
            var response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        subject = encodeURIComponent(subject);
                        return [4 /*yield*/, this.restService.handleRequest("/config/".concat(subject), 'PUT', { compatibility: update })];
                    case 1:
                        response = _a.sent();
                        return [2 /*return*/, response.data.compatibility];
                }
            });
        });
    };
    /**
     * Get the default/global compatibility level.
     */
    SchemaRegistryClient.prototype.getDefaultCompatibility = function () {
        return __awaiter(this, void 0, void 0, function () {
            var response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.restService.handleRequest("/config", 'GET')];
                    case 1:
                        response = _a.sent();
                        return [2 /*return*/, response.data.compatibilityLevel];
                }
            });
        });
    };
    /**
     * Update the default/global compatibility level.
     * @param update - The compatibility level to update to.
     */
    SchemaRegistryClient.prototype.updateDefaultCompatibility = function (update) {
        return __awaiter(this, void 0, void 0, function () {
            var response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.restService.handleRequest("/config", 'PUT', { compatibility: update })];
                    case 1:
                        response = _a.sent();
                        return [2 /*return*/, response.data.compatibility];
                }
            });
        });
    };
    /**
     * Get the config for a subject.
     * @param subject - The subject for which to get the config.
     */
    SchemaRegistryClient.prototype.getConfig = function (subject) {
        return __awaiter(this, void 0, void 0, function () {
            var response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        subject = encodeURIComponent(subject);
                        return [4 /*yield*/, this.restService.handleRequest("/config/".concat(subject), 'GET')];
                    case 1:
                        response = _a.sent();
                        return [2 /*return*/, response.data];
                }
            });
        });
    };
    /**
     * Update the config for a subject.
     * @param subject - The subject for which to update the config.
     * @param update - The config to update to.
     */
    SchemaRegistryClient.prototype.updateConfig = function (subject, update) {
        return __awaiter(this, void 0, void 0, function () {
            var response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.restService.handleRequest("/config/".concat(subject), 'PUT', update)];
                    case 1:
                        response = _a.sent();
                        return [2 /*return*/, response.data];
                }
            });
        });
    };
    /**
     * Get the default/global config.
     */
    SchemaRegistryClient.prototype.getDefaultConfig = function () {
        return __awaiter(this, void 0, void 0, function () {
            var response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.restService.handleRequest("/config", 'GET')];
                    case 1:
                        response = _a.sent();
                        return [2 /*return*/, response.data];
                }
            });
        });
    };
    /**
     * Update the default/global config.
     * @param update - The config to update to.
     */
    SchemaRegistryClient.prototype.updateDefaultConfig = function (update) {
        return __awaiter(this, void 0, void 0, function () {
            var response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.restService.handleRequest("/config", 'PUT', update)];
                    case 1:
                        response = _a.sent();
                        return [2 /*return*/, response.data];
                }
            });
        });
    };
    /**
     * Clear the latest caches.
     */
    SchemaRegistryClient.prototype.clearLatestCaches = function () {
        this.latestToSchemaCache.clear();
        this.metadataToSchemaCache.clear();
    };
    /**
     * Clear all caches.
     */
    SchemaRegistryClient.prototype.clearCaches = function () {
        this.schemaToIdCache.clear();
        this.idToSchemaInfoCache.clear();
        this.infoToSchemaCache.clear();
        this.latestToSchemaCache.clear();
        this.schemaToVersionCache.clear();
        this.versionToSchemaCache.clear();
        this.metadataToSchemaCache.clear();
    };
    /**
     * Close the client.
     */
    SchemaRegistryClient.prototype.close = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                this.clearCaches();
                return [2 /*return*/];
            });
        });
    };
    // Cache methods for testing
    SchemaRegistryClient.prototype.addToInfoToSchemaCache = function (subject, schema, metadata) {
        return __awaiter(this, void 0, void 0, function () {
            var cacheKey;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        cacheKey = stringify({ subject: subject, schema: minimize(schema) });
                        return [4 /*yield*/, this.infoToSchemaMutex.runExclusive(function () { return __awaiter(_this, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    this.infoToSchemaCache.set(cacheKey, metadata);
                                    return [2 /*return*/];
                                });
                            }); })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    SchemaRegistryClient.prototype.addToSchemaToVersionCache = function (subject, schema, version) {
        return __awaiter(this, void 0, void 0, function () {
            var cacheKey;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        cacheKey = stringify({ subject: subject, schema: minimize(schema) });
                        return [4 /*yield*/, this.schemaToVersionMutex.runExclusive(function () { return __awaiter(_this, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    this.schemaToVersionCache.set(cacheKey, version);
                                    return [2 /*return*/];
                                });
                            }); })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    SchemaRegistryClient.prototype.addToVersionToSchemaCache = function (subject, version, metadata) {
        return __awaiter(this, void 0, void 0, function () {
            var cacheKey;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        cacheKey = stringify({ subject: subject, version: version });
                        return [4 /*yield*/, this.versionToSchemaMutex.runExclusive(function () { return __awaiter(_this, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    this.versionToSchemaCache.set(cacheKey, metadata);
                                    return [2 /*return*/];
                                });
                            }); })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    SchemaRegistryClient.prototype.addToIdToSchemaInfoCache = function (subject, id, schema) {
        return __awaiter(this, void 0, void 0, function () {
            var cacheKey;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        cacheKey = stringify({ subject: subject, id: id });
                        return [4 /*yield*/, this.idToSchemaInfoMutex.runExclusive(function () { return __awaiter(_this, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    this.idToSchemaInfoCache.set(cacheKey, schema);
                                    return [2 /*return*/];
                                });
                            }); })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    SchemaRegistryClient.prototype.getInfoToSchemaCacheSize = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.infoToSchemaMutex.runExclusive(function () { return __awaiter(_this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, this.infoToSchemaCache.size];
                            });
                        }); })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    SchemaRegistryClient.prototype.getSchemaToVersionCacheSize = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.schemaToVersionMutex.runExclusive(function () { return __awaiter(_this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, this.schemaToVersionCache.size];
                            });
                        }); })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    SchemaRegistryClient.prototype.getVersionToSchemaCacheSize = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.versionToSchemaMutex.runExclusive(function () { return __awaiter(_this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, this.versionToSchemaCache.size];
                            });
                        }); })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    SchemaRegistryClient.prototype.getIdToSchemaInfoCacheSize = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.idToSchemaInfoMutex.runExclusive(function () { return __awaiter(_this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, this.idToSchemaInfoCache.size];
                            });
                        }); })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    return SchemaRegistryClient;
}());
exports.SchemaRegistryClient = SchemaRegistryClient;
