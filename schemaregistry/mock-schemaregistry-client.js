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
exports.MockClient = void 0;
var schemaregistry_client_1 = require("./schemaregistry-client");
var stringify = require('json-stringify-deterministic');
var rest_error_1 = require("./rest-error");
var Counter = /** @class */ (function () {
    function Counter() {
        this.count = 0;
    }
    Counter.prototype.currentValue = function () {
        return this.count;
    };
    Counter.prototype.increment = function () {
        this.count++;
        return this.count;
    };
    return Counter;
}());
var noSubject = "";
var MockClient = /** @class */ (function () {
    function MockClient(config) {
        this.clientConfig = config;
        this.infoToSchemaCache = new Map();
        this.idToSchemaCache = new Map();
        this.schemaToVersionCache = new Map();
        this.configCache = new Map();
        this.counter = new Counter();
    }
    MockClient.prototype.config = function () {
        return this.clientConfig;
    };
    MockClient.prototype.register = function (subject_1, schema_1) {
        return __awaiter(this, arguments, void 0, function (subject, schema, normalize) {
            var metadata;
            if (normalize === void 0) { normalize = false; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.registerFullResponse(subject, schema, normalize)];
                    case 1:
                        metadata = _a.sent();
                        if (!metadata) {
                            throw new rest_error_1.RestError("Failed to register schema", 422, 42200);
                        }
                        return [2 /*return*/, metadata.id];
                }
            });
        });
    };
    MockClient.prototype.registerFullResponse = function (subject_1, schema_1) {
        return __awaiter(this, arguments, void 0, function (subject, schema, normalize) {
            var cacheKey, cacheEntry, id, metadata;
            if (normalize === void 0) { normalize = false; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        cacheKey = stringify({ subject: subject, schema: (0, schemaregistry_client_1.minimize)(schema) });
                        cacheEntry = this.infoToSchemaCache.get(cacheKey);
                        if (cacheEntry && !cacheEntry.softDeleted) {
                            return [2 /*return*/, cacheEntry.metadata];
                        }
                        return [4 /*yield*/, this.getIDFromRegistry(subject, schema)];
                    case 1:
                        id = _a.sent();
                        if (id === -1) {
                            throw new rest_error_1.RestError("Failed to retrieve schema ID from registry", 422, 42200);
                        }
                        metadata = __assign(__assign({}, schema), { id: id });
                        this.infoToSchemaCache.set(cacheKey, { metadata: metadata, softDeleted: false });
                        return [2 /*return*/, metadata];
                }
            });
        });
    };
    MockClient.prototype.getIDFromRegistry = function (subject, schema) {
        return __awaiter(this, void 0, void 0, function () {
            var id, _i, _a, _b, key, value, parsedKey, idCacheKey;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        id = -1;
                        for (_i = 0, _a = this.idToSchemaCache.entries(); _i < _a.length; _i++) {
                            _b = _a[_i], key = _b[0], value = _b[1];
                            parsedKey = JSON.parse(key);
                            if (parsedKey.subject === subject && this.schemasEqual(value.info, schema)) {
                                id = parsedKey.id;
                                break;
                            }
                        }
                        return [4 /*yield*/, this.generateVersion(subject, schema)];
                    case 1:
                        _c.sent();
                        if (id < 0) {
                            id = this.counter.increment();
                            idCacheKey = stringify({ subject: subject, id: id });
                            this.idToSchemaCache.set(idCacheKey, { info: schema, softDeleted: false });
                        }
                        return [2 /*return*/, id];
                }
            });
        });
    };
    MockClient.prototype.generateVersion = function (subject, schema) {
        return __awaiter(this, void 0, void 0, function () {
            var versions, newVersion, cacheKey;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.allVersions(subject)];
                    case 1:
                        versions = _a.sent();
                        if (versions.length === 0) {
                            newVersion = 1;
                        }
                        else {
                            newVersion = versions[versions.length - 1] + 1;
                        }
                        cacheKey = stringify({ subject: subject, schema: (0, schemaregistry_client_1.minimize)(schema) });
                        this.schemaToVersionCache.set(cacheKey, { version: newVersion, softDeleted: false });
                        return [2 /*return*/];
                }
            });
        });
    };
    MockClient.prototype.getBySubjectAndId = function (subject, id, format) {
        return __awaiter(this, void 0, void 0, function () {
            var cacheKey, cacheEntry;
            return __generator(this, function (_a) {
                cacheKey = stringify({ subject: subject, id: id });
                cacheEntry = this.idToSchemaCache.get(cacheKey);
                if (!cacheEntry || cacheEntry.softDeleted) {
                    throw new rest_error_1.RestError("Schema not found", 404, 40400);
                }
                return [2 /*return*/, cacheEntry.info];
            });
        });
    };
    MockClient.prototype.getId = function (subject, schema) {
        return __awaiter(this, void 0, void 0, function () {
            var cacheKey, cacheEntry;
            return __generator(this, function (_a) {
                cacheKey = stringify({ subject: subject, schema: (0, schemaregistry_client_1.minimize)(schema) });
                cacheEntry = this.infoToSchemaCache.get(cacheKey);
                if (!cacheEntry || cacheEntry.softDeleted) {
                    throw new rest_error_1.RestError("Schema not found", 404, 40400);
                }
                return [2 /*return*/, cacheEntry.metadata.id];
            });
        });
    };
    MockClient.prototype.getLatestSchemaMetadata = function (subject, format) {
        return __awaiter(this, void 0, void 0, function () {
            var version;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.latestVersion(subject)];
                    case 1:
                        version = _a.sent();
                        if (version === -1) {
                            throw new rest_error_1.RestError("No versions found for subject", 404, 40400);
                        }
                        return [2 /*return*/, this.getSchemaMetadata(subject, version)];
                }
            });
        });
    };
    MockClient.prototype.getSchemaMetadata = function (subject_1, version_1) {
        return __awaiter(this, arguments, void 0, function (subject, version, deleted, format) {
            var json, _i, _a, _b, key, value, parsedKey, id, _c, _d, _e, key, value, parsedKey;
            if (deleted === void 0) { deleted = false; }
            return __generator(this, function (_f) {
                for (_i = 0, _a = this.schemaToVersionCache.entries(); _i < _a.length; _i++) {
                    _b = _a[_i], key = _b[0], value = _b[1];
                    parsedKey = JSON.parse(key);
                    if (parsedKey.subject === subject && value.version === version) {
                        json = parsedKey;
                    }
                }
                if (!json) {
                    throw new rest_error_1.RestError("Schema not found", 404, 40400);
                }
                id = -1;
                for (_c = 0, _d = this.idToSchemaCache.entries(); _c < _d.length; _c++) {
                    _e = _d[_c], key = _e[0], value = _e[1];
                    parsedKey = JSON.parse(key);
                    if (parsedKey.subject === subject && value.info.schema === json.schema.schema) {
                        id = parsedKey.id;
                    }
                }
                if (id === -1) {
                    throw new rest_error_1.RestError("Schema not found", 404, 40400);
                }
                return [2 /*return*/, __assign({ id: id, version: version, subject: subject }, json.schema)];
            });
        });
    };
    MockClient.prototype.getLatestWithMetadata = function (subject_1, metadata_1) {
        return __awaiter(this, arguments, void 0, function (subject, metadata, deleted, format) {
            var metadataStr, key, encodedKey, encodedValue, results, _i, _a, _b, key, value, parsedKey, latest, id, _c, _d, _e, key, value, parsedKey;
            if (deleted === void 0) { deleted = false; }
            return __generator(this, function (_f) {
                metadataStr = '';
                for (key in metadata) {
                    encodedKey = encodeURIComponent(key);
                    encodedValue = encodeURIComponent(metadata[key]);
                    metadataStr += "&key=".concat(encodedKey, "&value=").concat(encodedValue);
                }
                results = [];
                for (_i = 0, _a = this.schemaToVersionCache.entries(); _i < _a.length; _i++) {
                    _b = _a[_i], key = _b[0], value = _b[1];
                    parsedKey = JSON.parse(key);
                    if (parsedKey.subject === subject && (!value.softDeleted || deleted)) {
                        if (parsedKey.schema.metadata && this.isSubset(metadata, parsedKey.schema.metadata.properties)) {
                            results.push(__assign({ version: value.version, subject: subject }, parsedKey.schema));
                        }
                    }
                }
                if (results.length === 0) {
                    throw new rest_error_1.RestError("Schema not found", 404, 40400);
                }
                latest = results[0];
                results.forEach(function (result) {
                    if (result.version > latest.version) {
                        latest = result;
                    }
                });
                id = -1;
                for (_c = 0, _d = this.idToSchemaCache.entries(); _c < _d.length; _c++) {
                    _e = _d[_c], key = _e[0], value = _e[1];
                    parsedKey = JSON.parse(key);
                    if (parsedKey.subject === subject && value.info.schema === latest.schema) {
                        id = parsedKey.id;
                    }
                }
                if (id === -1) {
                    throw new rest_error_1.RestError("Schema not found", 404, 40400);
                }
                latest.id = id;
                return [2 /*return*/, latest];
            });
        });
    };
    MockClient.prototype.isSubset = function (containee, container) {
        for (var key in containee) {
            if (containee[key] !== container[key]) {
                return false;
            }
        }
        return true;
    };
    MockClient.prototype.getAllVersions = function (subject) {
        return __awaiter(this, void 0, void 0, function () {
            var results;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.allVersions(subject)];
                    case 1:
                        results = _a.sent();
                        if (results.length === 0) {
                            throw new rest_error_1.RestError("No versions found for subject", 404, 40400);
                        }
                        return [2 /*return*/, results];
                }
            });
        });
    };
    MockClient.prototype.allVersions = function (subject) {
        return __awaiter(this, void 0, void 0, function () {
            var versions, _i, _a, _b, key, value, parsedKey;
            return __generator(this, function (_c) {
                versions = [];
                for (_i = 0, _a = this.schemaToVersionCache.entries(); _i < _a.length; _i++) {
                    _b = _a[_i], key = _b[0], value = _b[1];
                    parsedKey = JSON.parse(key);
                    if (parsedKey.subject === subject && !value.softDeleted) {
                        versions.push(value.version);
                    }
                }
                return [2 /*return*/, versions];
            });
        });
    };
    MockClient.prototype.latestVersion = function (subject) {
        return __awaiter(this, void 0, void 0, function () {
            var versions;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.allVersions(subject)];
                    case 1:
                        versions = _a.sent();
                        if (versions.length === 0) {
                            return [2 /*return*/, -1];
                        }
                        return [2 /*return*/, versions[versions.length - 1]];
                }
            });
        });
    };
    MockClient.prototype.deleteVersion = function (cacheKey, version, permanent) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                if (permanent) {
                    this.schemaToVersionCache.delete(cacheKey);
                }
                else {
                    this.schemaToVersionCache.set(cacheKey, { version: version, softDeleted: true });
                }
                return [2 /*return*/];
            });
        });
    };
    MockClient.prototype.deleteInfo = function (cacheKey, info, permanent) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                if (permanent) {
                    this.idToSchemaCache.delete(cacheKey);
                }
                else {
                    this.idToSchemaCache.set(cacheKey, { info: info, softDeleted: true });
                }
                return [2 /*return*/];
            });
        });
    };
    MockClient.prototype.deleteMetadata = function (cacheKey, metadata, permanent) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                if (permanent) {
                    this.infoToSchemaCache.delete(cacheKey);
                }
                else {
                    this.infoToSchemaCache.set(cacheKey, { metadata: metadata, softDeleted: true });
                }
                return [2 /*return*/];
            });
        });
    };
    MockClient.prototype.getVersion = function (subject_1, schema_1) {
        return __awaiter(this, arguments, void 0, function (subject, schema, normalize) {
            var cacheKey, cacheEntry;
            if (normalize === void 0) { normalize = false; }
            return __generator(this, function (_a) {
                cacheKey = stringify({ subject: subject, schema: (0, schemaregistry_client_1.minimize)(schema) });
                cacheEntry = this.schemaToVersionCache.get(cacheKey);
                if (!cacheEntry || cacheEntry.softDeleted) {
                    throw new rest_error_1.RestError("Schema not found", 404, 40400);
                }
                return [2 /*return*/, cacheEntry.version];
            });
        });
    };
    MockClient.prototype.getAllSubjects = function () {
        return __awaiter(this, void 0, void 0, function () {
            var subjects, _i, _a, _b, key, value, parsedKey;
            return __generator(this, function (_c) {
                subjects = [];
                for (_i = 0, _a = this.schemaToVersionCache.entries(); _i < _a.length; _i++) {
                    _b = _a[_i], key = _b[0], value = _b[1];
                    parsedKey = JSON.parse(key);
                    if (!value.softDeleted && !subjects.includes(parsedKey.subject)) {
                        subjects.push(parsedKey.subject);
                    }
                }
                return [2 /*return*/, subjects.sort()];
            });
        });
    };
    MockClient.prototype.deleteSubject = function (subject_1) {
        return __awaiter(this, arguments, void 0, function (subject, permanent) {
            var deletedVersions, _i, _a, _b, key, value, parsedKey, _c, _d, _e, key, value, parsedKey, _f, _g, _h, key, value, parsedKey;
            if (permanent === void 0) { permanent = false; }
            return __generator(this, function (_j) {
                switch (_j.label) {
                    case 0:
                        deletedVersions = [];
                        _i = 0, _a = this.infoToSchemaCache.entries();
                        _j.label = 1;
                    case 1:
                        if (!(_i < _a.length)) return [3 /*break*/, 4];
                        _b = _a[_i], key = _b[0], value = _b[1];
                        parsedKey = JSON.parse(key);
                        if (!(parsedKey.subject === subject && (permanent || !value.softDeleted))) return [3 /*break*/, 3];
                        return [4 /*yield*/, this.deleteMetadata(key, value.metadata, permanent)];
                    case 2:
                        _j.sent();
                        _j.label = 3;
                    case 3:
                        _i++;
                        return [3 /*break*/, 1];
                    case 4:
                        _c = 0, _d = this.schemaToVersionCache.entries();
                        _j.label = 5;
                    case 5:
                        if (!(_c < _d.length)) return [3 /*break*/, 8];
                        _e = _d[_c], key = _e[0], value = _e[1];
                        parsedKey = JSON.parse(key);
                        if (!(parsedKey.subject === subject && (permanent || !value.softDeleted))) return [3 /*break*/, 7];
                        return [4 /*yield*/, this.deleteVersion(key, value.version, permanent)];
                    case 6:
                        _j.sent();
                        deletedVersions.push(value.version);
                        _j.label = 7;
                    case 7:
                        _c++;
                        return [3 /*break*/, 5];
                    case 8:
                        this.configCache.delete(subject);
                        if (!permanent) return [3 /*break*/, 12];
                        _f = 0, _g = this.idToSchemaCache.entries();
                        _j.label = 9;
                    case 9:
                        if (!(_f < _g.length)) return [3 /*break*/, 12];
                        _h = _g[_f], key = _h[0], value = _h[1];
                        parsedKey = JSON.parse(key);
                        if (!(parsedKey.subject === subject && (!value.softDeleted))) return [3 /*break*/, 11];
                        return [4 /*yield*/, this.deleteInfo(key, value.info, permanent)];
                    case 10:
                        _j.sent();
                        _j.label = 11;
                    case 11:
                        _f++;
                        return [3 /*break*/, 9];
                    case 12: return [2 /*return*/, deletedVersions];
                }
            });
        });
    };
    MockClient.prototype.deleteSubjectVersion = function (subject_1, version_1) {
        return __awaiter(this, arguments, void 0, function (subject, version, permanent) {
            var _i, _a, _b, key, value, parsedKey, cacheKeySchema, cacheEntry, cacheKeyInfo, cacheSchemaEntry;
            if (permanent === void 0) { permanent = false; }
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _i = 0, _a = this.schemaToVersionCache.entries();
                        _c.label = 1;
                    case 1:
                        if (!(_i < _a.length)) return [3 /*break*/, 7];
                        _b = _a[_i], key = _b[0], value = _b[1];
                        parsedKey = JSON.parse(key);
                        if (!(parsedKey.subject === subject && value.version === version)) return [3 /*break*/, 6];
                        return [4 /*yield*/, this.deleteVersion(key, version, permanent)];
                    case 2:
                        _c.sent();
                        cacheKeySchema = stringify({ subject: subject, schema: (0, schemaregistry_client_1.minimize)(parsedKey.schema) });
                        cacheEntry = this.infoToSchemaCache.get(cacheKeySchema);
                        if (!cacheEntry) return [3 /*break*/, 4];
                        return [4 /*yield*/, this.deleteMetadata(cacheKeySchema, cacheEntry.metadata, permanent)];
                    case 3:
                        _c.sent();
                        _c.label = 4;
                    case 4:
                        if (!(permanent && cacheEntry)) return [3 /*break*/, 6];
                        cacheKeyInfo = stringify({ subject: subject, id: cacheEntry.metadata.id });
                        cacheSchemaEntry = this.idToSchemaCache.get(cacheKeyInfo);
                        if (!cacheSchemaEntry) return [3 /*break*/, 6];
                        return [4 /*yield*/, this.deleteInfo(cacheKeyInfo, cacheSchemaEntry.info, permanent)];
                    case 5:
                        _c.sent();
                        _c.label = 6;
                    case 6:
                        _i++;
                        return [3 /*break*/, 1];
                    case 7: return [2 /*return*/, version];
                }
            });
        });
    };
    MockClient.prototype.testSubjectCompatibility = function (subject, schema) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                throw new Error("Unsupported operation");
            });
        });
    };
    MockClient.prototype.testCompatibility = function (subject, version, schema) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                throw new Error("Unsupported operation");
            });
        });
    };
    MockClient.prototype.getCompatibility = function (subject) {
        return __awaiter(this, void 0, void 0, function () {
            var cacheEntry;
            return __generator(this, function (_a) {
                cacheEntry = this.configCache.get(subject);
                if (!cacheEntry) {
                    throw new rest_error_1.RestError("Subject not found", 404, 40400);
                }
                return [2 /*return*/, cacheEntry.compatibilityLevel];
            });
        });
    };
    MockClient.prototype.updateCompatibility = function (subject, compatibility) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                this.configCache.set(subject, { compatibilityLevel: compatibility });
                return [2 /*return*/, compatibility];
            });
        });
    };
    MockClient.prototype.getDefaultCompatibility = function () {
        return __awaiter(this, void 0, void 0, function () {
            var cacheEntry;
            return __generator(this, function (_a) {
                cacheEntry = this.configCache.get(noSubject);
                if (!cacheEntry) {
                    throw new rest_error_1.RestError("Default compatibility not found", 404, 40400);
                }
                return [2 /*return*/, cacheEntry.compatibilityLevel];
            });
        });
    };
    MockClient.prototype.updateDefaultCompatibility = function (compatibility) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                this.configCache.set(noSubject, { compatibilityLevel: compatibility });
                return [2 /*return*/, compatibility];
            });
        });
    };
    MockClient.prototype.getConfig = function (subject) {
        return __awaiter(this, void 0, void 0, function () {
            var cacheEntry;
            return __generator(this, function (_a) {
                cacheEntry = this.configCache.get(subject);
                if (!cacheEntry) {
                    throw new rest_error_1.RestError("Subject not found", 404, 40400);
                }
                return [2 /*return*/, cacheEntry];
            });
        });
    };
    MockClient.prototype.updateConfig = function (subject, config) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                this.configCache.set(subject, config);
                return [2 /*return*/, config];
            });
        });
    };
    MockClient.prototype.getDefaultConfig = function () {
        return __awaiter(this, void 0, void 0, function () {
            var cacheEntry;
            return __generator(this, function (_a) {
                cacheEntry = this.configCache.get(noSubject);
                if (!cacheEntry) {
                    throw new rest_error_1.RestError("Default config not found", 404, 40400);
                }
                return [2 /*return*/, cacheEntry];
            });
        });
    };
    MockClient.prototype.updateDefaultConfig = function (config) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                this.configCache.set(noSubject, config);
                return [2 /*return*/, config];
            });
        });
    };
    MockClient.prototype.clearLatestCaches = function () {
        return;
    };
    MockClient.prototype.clearCaches = function () {
        return;
    };
    MockClient.prototype.close = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/];
            });
        });
    };
    MockClient.prototype.schemasEqual = function (schema1, schema2) {
        return stringify(schema1) === stringify(schema2);
    };
    return MockClient;
}());
exports.MockClient = MockClient;
