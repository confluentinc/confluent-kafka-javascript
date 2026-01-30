
import {
  Association,
  AssociationCreateOrUpdateRequest,
  AssociationInfo,
  AssociationResponse,
  Client,
  Compatibility,
  LifecyclePolicy,
  minimize,
  SchemaInfo,
  SchemaMetadata,
  ServerConfig
} from './schemaregistry-client';
import stringify from "json-stringify-deterministic";
import {v4} from "uuid";
import {ClientConfig} from "./rest-service";
import {RestError} from "./rest-error";
import {SchemaId} from "./serde/serde";

interface VersionCacheEntry {
  version: number;
  softDeleted: boolean;
}

interface InfoCacheEntry {
  info: SchemaInfo;
  softDeleted: boolean;
}

interface MetadataCacheEntry {
  metadata: SchemaMetadata;
  softDeleted: boolean;
}

class Counter {
  private count: number = 0;

  currentValue(): number {
    return this.count;
  }

  increment(): number {
    this.count++;
    return this.count;
  }
}

const noSubject = "";

interface AssociationCacheEntry {
  resourceName: string;
  resourceNamespace: string;
  resourceType: string;
  associations: Association[];
}

class MockClient implements Client {
  private clientConfig?: ClientConfig;
  private infoToSchemaCache: Map<string, MetadataCacheEntry>;
  private idToSchemaCache: Map<string, InfoCacheEntry>;
  private guidToSchemaCache: Map<string, InfoCacheEntry>;
  private schemaToVersionCache: Map<string, VersionCacheEntry>;
  private configCache: Map<string, ServerConfig>;
  private associationCache: Map<string, AssociationCacheEntry>;  // keyed by resourceId
  private counter: Counter;

  constructor(config?: ClientConfig) {
    this.clientConfig = config
    this.infoToSchemaCache = new Map();
    this.idToSchemaCache = new Map();
    this.guidToSchemaCache = new Map();
    this.schemaToVersionCache = new Map();
    this.configCache = new Map();
    this.associationCache = new Map();
    this.counter = new Counter();
  }

  config(): ClientConfig {
    return this.clientConfig!
  }

  async register(subject: string, schema: SchemaInfo, normalize: boolean = false): Promise<number> {
    const metadata = await this.registerFullResponse(subject, schema, normalize);
    if (!metadata) {
      throw new RestError("Failed to register schema", 422, 42200);
    }
    return metadata.id!;
  }

  async registerFullResponse(subject: string, schema: SchemaInfo, normalize: boolean = false): Promise<SchemaMetadata> {
    const cacheKey = stringify({ subject, schema: minimize(schema) });

    const cacheEntry = this.infoToSchemaCache.get(cacheKey);
    if (cacheEntry && !cacheEntry.softDeleted) {
      return cacheEntry.metadata;
    }

    const schemaId = await this.getIDFromRegistry(subject, schema);
    if (schemaId.id === -1) {
      throw new RestError("Failed to retrieve schema ID from registry", 422, 42200);
    }

    const metadata: SchemaMetadata = { id: schemaId.id!, guid: schemaId.guid!, ...schema };
    this.infoToSchemaCache.set(cacheKey, { metadata, softDeleted: false });

    return metadata;
  }

  private async getIDFromRegistry(subject: string, schema: SchemaInfo): Promise<SchemaId> {
    let id = -1;
    for (const [key, value] of this.idToSchemaCache.entries()) {
      const parsedKey = JSON.parse(key);
      if (parsedKey.subject === subject && this.schemasEqual(value.info, schema)) {
        id = parsedKey.id;
        break;
      }
    }

    let guid = "";
    for (const [key, value] of this.guidToSchemaCache.entries()) {
      if (this.schemasEqual(value.info, schema)) {
        guid = key;
        break;
      }
    }

    await this.generateVersion(subject, schema);
    if (id < 0) {
      id = this.counter.increment();
      const idCacheKey = stringify({ subject, id });
      this.idToSchemaCache.set(idCacheKey, { info: schema, softDeleted: false });
      guid = v4()
      this.guidToSchemaCache.set(guid, { info: schema, softDeleted: false });
    }

    return new SchemaId("", id, guid);
  }

  private async generateVersion(subject: string, schema: SchemaInfo): Promise<void> {
    const versions = await this.allVersions(subject);
    let newVersion: number;

    if (versions.length === 0) {
      newVersion = 1;
    } else {
      newVersion = versions[versions.length - 1] + 1;
    }

    const cacheKey = stringify({ subject, schema: minimize(schema) });
    this.schemaToVersionCache.set(cacheKey, { version: newVersion, softDeleted: false });
  }

  async getBySubjectAndId(subject: string, id: number, format?: string): Promise<SchemaInfo> {
    const cacheKey = stringify({ subject, id });
    const cacheEntry = this.idToSchemaCache.get(cacheKey);

    if (!cacheEntry || cacheEntry.softDeleted) {
      throw new RestError("Schema not found", 404, 40400);
    }
    return cacheEntry.info;
  }

  async getByGuid(guid: string, format?: string): Promise<SchemaInfo> {
    const cacheEntry = this.guidToSchemaCache.get(guid);

    if (!cacheEntry || cacheEntry.softDeleted) {
      throw new RestError("Schema not found", 404, 40400);
    }
    return cacheEntry.info;
  }

  async getId(subject: string, schema: SchemaInfo): Promise<number> {
    const metadata = await this.getIdFullResponse(subject, schema);
    return metadata.id!;
  }

  async getIdFullResponse(subject: string, schema: SchemaInfo): Promise<SchemaMetadata> {
    const cacheKey = stringify({ subject, schema: minimize(schema) });
    const cacheEntry = this.infoToSchemaCache.get(cacheKey);
    if (!cacheEntry || cacheEntry.softDeleted) {
      throw new RestError("Schema not found", 404, 40400);
    }
    return cacheEntry.metadata;
  }

  async getLatestSchemaMetadata(subject: string, format?: string): Promise<SchemaMetadata> {
    const version = await this.latestVersion(subject);
    if (version === -1) {
      throw new RestError("No versions found for subject", 404, 40400);
    }

    return this.getSchemaMetadata(subject, version);
  }

  async getSchemaMetadata(subject: string, version: number, deleted: boolean = false, format?: string): Promise<SchemaMetadata> {
    let json;
    for (const [key, value] of this.schemaToVersionCache.entries()) {
      const parsedKey = JSON.parse(key);
      if (parsedKey.subject === subject && value.version === version) {
        json = parsedKey;
        break
      }
    }

    if (!json) {
      throw new RestError("Schema not found", 404, 40400);
    }

    let id: number = -1;
    for (const [key, value] of this.idToSchemaCache.entries()) {
      const parsedKey = JSON.parse(key);
      if (parsedKey.subject === subject && value.info.schema === json.schema.schema) {
        id = parsedKey.id;
        break
      }
    }
    if (id === -1) {
      throw new RestError("Schema not found", 404, 40400);
    }
    let guid: string = "";
    for (const [key, value] of this.guidToSchemaCache.entries()) {
      if (value.info.schema === json.schema.schema) {
        guid = key
        break
      }
    }
    if (guid === "") {
      throw new RestError("Schema not found", 404, 40400);
    }

    return {
      id,
      guid,
      version,
      subject,
      ...json.schema,
    };
  }

  async getLatestWithMetadata(subject: string, metadata: { [key: string]: string },
                              deleted: boolean = false, format?: string): Promise<SchemaMetadata> {
    let metadataStr = '';

    for (const key in metadata) {
      const encodedKey = encodeURIComponent(key);
      const encodedValue = encodeURIComponent(metadata[key]);
      metadataStr += `&key=${encodedKey}&value=${encodedValue}`;
    }

    let results: SchemaMetadata[] = [];

    for (const [key, value] of this.schemaToVersionCache.entries()) {
      const parsedKey = JSON.parse(key);
      if (parsedKey.subject === subject && (!value.softDeleted || deleted)) {
        if (parsedKey.schema.metadata && this.isSubset(metadata, parsedKey.schema.metadata.properties)) {
          results.push({
            version: value.version,
            subject,
            ...parsedKey.schema
          });
        }
      }
    }

    if (results.length === 0) {
      throw new RestError("Schema not found", 404, 40400);
    }

    let latest: SchemaMetadata = results[0];

    results.forEach((result) => {
      if (result.version! > latest.version!) {
        latest = result;
      }
    });

    let id: number = -1;
    for (const [key, value] of this.idToSchemaCache.entries()) {
      const parsedKey = JSON.parse(key);
      if (parsedKey.subject === subject && value.info.schema === latest.schema) {
        id = parsedKey.id;
        break
      }
    }
    if (id === -1) {
      throw new RestError("Schema not found", 404, 40400);
    }

    latest.id = id;
    return latest;
  }

  private isSubset(containee: { [key: string]: string }, container: { [key: string]: string }){
    for (const key in containee) {
      if (containee[key] !== container[key]) {
        return false;
      }
    }
    return true;
  }

  async getAllVersions(subject: string): Promise<number[]> {
    const results = await this.allVersions(subject);

    if (results.length === 0) {
      throw new RestError("No versions found for subject", 404, 40400);
    }
    return results;
  }

  private async allVersions(subject: string): Promise<number[]> {
    const versions: number[] = [];

    for (const [key, value] of this.schemaToVersionCache.entries()) {
      const parsedKey = JSON.parse(key);
      if (parsedKey.subject === subject && !value.softDeleted) {
        versions.push(value.version);
      }
    }
    return versions;
  }

  private async latestVersion(subject: string): Promise<number> {
    const versions = await this.allVersions(subject);
    if (versions.length === 0) {
      return -1;
    }
    return versions[versions.length - 1];
  }

  private async deleteVersion(cacheKey: string, version: number, permanent: boolean): Promise<void> {
    if (permanent) {
      this.schemaToVersionCache.delete(cacheKey);
    } else {
      this.schemaToVersionCache.set(cacheKey, { version, softDeleted: true });
    }
  }

  private async deleteInfo(cacheKey: string, info: SchemaInfo, permanent: boolean): Promise<void> {
    if (permanent) {
      this.idToSchemaCache.delete(cacheKey);
    } else {
      this.idToSchemaCache.set(cacheKey, { info, softDeleted: true });
    }
  }

  private async deleteMetadata(cacheKey: string, metadata: SchemaMetadata, permanent: boolean): Promise<void> {
    if (permanent) {
      this.infoToSchemaCache.delete(cacheKey);
    } else {
      this.infoToSchemaCache.set(cacheKey, { metadata, softDeleted: true });
    }
  }

  async getVersion(subject: string, schema: SchemaInfo,
                   normalize: boolean = false, deleted: boolean = false): Promise<number> {
    const cacheKey = stringify({ subject, schema: minimize(schema) });
    const cacheEntry = this.schemaToVersionCache.get(cacheKey);

    if (!cacheEntry || cacheEntry.softDeleted) {
      throw new RestError("Schema not found", 404, 40400);
    }

    return cacheEntry.version;
  }

  async getAllSubjects(): Promise<string[]> {
    const subjects: string[] = [];
    for (const [key, value] of this.schemaToVersionCache.entries()) {
      const parsedKey = JSON.parse(key);
      if (!value.softDeleted && !subjects.includes(parsedKey.subject)) {
        subjects.push(parsedKey.subject);
      }
    }
    return subjects.sort();
  }

  async deleteSubject(subject: string, permanent: boolean = false): Promise<number[]> {
    const deletedVersions: number[] = [];
    for (const [key, value] of this.infoToSchemaCache.entries()) {
      const parsedKey = JSON.parse(key);
      if (parsedKey.subject === subject && (permanent || !value.softDeleted)) {
        await this.deleteMetadata(key, value.metadata, permanent);
      }
    }

    for (const [key, value] of this.schemaToVersionCache.entries()) {
      const parsedKey = JSON.parse(key);
      if (parsedKey.subject === subject && (permanent || !value.softDeleted)) {
        await this.deleteVersion(key, value.version, permanent);
        deletedVersions.push(value.version);
      }
    }

    this.configCache.delete(subject);

    if (permanent) {
      for (const [key, value] of this.idToSchemaCache.entries()) {
        const parsedKey = JSON.parse(key);
        if (parsedKey.subject === subject && (!value.softDeleted)) {
          await this.deleteInfo(key, value.info, permanent);
        }
      }
    }

    return deletedVersions;
  }

  async deleteSubjectVersion(subject: string, version: number, permanent: boolean = false): Promise<number> {
    for (const [key, value] of this.schemaToVersionCache.entries()) {
      const parsedKey = JSON.parse(key);
      if (parsedKey.subject === subject && value.version === version) {
        await this.deleteVersion(key, version, permanent);

        const cacheKeySchema = stringify({ subject, schema: minimize(parsedKey.schema) });
        const cacheEntry = this.infoToSchemaCache.get(cacheKeySchema);
        if (cacheEntry) {
          await this.deleteMetadata(cacheKeySchema, cacheEntry.metadata, permanent);
        }

        if (permanent && cacheEntry) {
          const cacheKeyInfo = stringify({ subject, id: cacheEntry.metadata.id });
          const cacheSchemaEntry = this.idToSchemaCache.get(cacheKeyInfo);
          if (cacheSchemaEntry) {
            await this.deleteInfo(cacheKeyInfo, cacheSchemaEntry.info, permanent);
          }
        }
      }
    }

    return version;
  }

  async testSubjectCompatibility(subject: string, schema: SchemaInfo): Promise<boolean> {
    throw new Error("Unsupported operation");
  }

  async testCompatibility(subject: string, version: number, schema: SchemaInfo): Promise<boolean> {
    throw new Error("Unsupported operation");
  }

  async getCompatibility(subject: string): Promise<Compatibility> {
    const cacheEntry = this.configCache.get(subject);
    if (!cacheEntry) {
      throw new RestError("Subject not found", 404, 40400);
    }
    return cacheEntry.compatibilityLevel as Compatibility;
  }

  async updateCompatibility(subject: string, compatibility: Compatibility): Promise<Compatibility> {
    this.configCache.set(subject, { compatibilityLevel: compatibility });
    return compatibility;
  }

  async getDefaultCompatibility(): Promise<Compatibility> {
    const cacheEntry = this.configCache.get(noSubject);
    if (!cacheEntry) {
      throw new RestError("Default compatibility not found", 404, 40400);
    }
    return cacheEntry.compatibilityLevel as Compatibility;
  }

  async updateDefaultCompatibility(compatibility: Compatibility): Promise<Compatibility> {
    this.configCache.set(noSubject, { compatibilityLevel: compatibility });
    return compatibility;
  }

  async getConfig(subject: string): Promise<ServerConfig> {
    const cacheEntry = this.configCache.get(subject);
    if (!cacheEntry) {
      throw new RestError("Subject not found", 404, 40400);
    }
    return cacheEntry;
  }

  async updateConfig(subject: string, config: ServerConfig): Promise<ServerConfig> {
    this.configCache.set(subject, config);
    return config;
  }

  async getDefaultConfig(): Promise<ServerConfig> {
    const cacheEntry = this.configCache.get(noSubject);
    if (!cacheEntry) {
      throw new RestError("Default config not found", 404, 40400);
    }
    return cacheEntry;
  }

  async updateDefaultConfig(config: ServerConfig): Promise<ServerConfig> {
    this.configCache.set(noSubject, config);
    return config;
  }

  async getAssociationsByResourceName(
    resourceName: string,
    resourceNamespace: string,
    resourceType: string | null,
    associationTypes: string[],
    lifecycle: LifecyclePolicy | null,
    offset: number,
    limit: number
  ): Promise<Association[]> {
    const results: Association[] = [];

    for (const [_, entry] of this.associationCache.entries()) {
      if (entry.resourceName === resourceName && entry.resourceNamespace === resourceNamespace) {
        if (resourceType != null && entry.resourceType !== resourceType) {
          continue;
        }
        for (const assoc of entry.associations) {
          if (associationTypes.length === 0 || associationTypes.includes(assoc.associationType)) {
            if (lifecycle == null || assoc.lifecycle === lifecycle) {
              results.push(assoc);
            }
          }
        }
      }
    }

    // Apply pagination
    const start = offset;
    const end = limit >= 1 ? start + limit : results.length;
    return results.slice(start, end);
  }

  async createAssociation(request: AssociationCreateOrUpdateRequest): Promise<AssociationResponse> {
    const resourceId = request.resourceId || v4();
    const resourceName = request.resourceName || '';
    const resourceNamespace = request.resourceNamespace || '-';
    const resourceType = request.resourceType || 'topic';

    // Get or create association cache entry
    let cacheEntry = this.associationCache.get(resourceId);
    if (!cacheEntry) {
      cacheEntry = {
        resourceName,
        resourceNamespace,
        resourceType,
        associations: []
      };
      this.associationCache.set(resourceId, cacheEntry);
    }

    const responseAssociations: AssociationInfo[] = [];

    // Process each association in the request
    for (const assocInfo of request.associations || []) {
      const association: Association = {
        subject: assocInfo.subject || '',
        resourceName,
        resourceNamespace,
        resourceId,
        resourceType,
        associationType: assocInfo.associationType || 'value',
        lifecycle: assocInfo.lifecycle,
        frozen: assocInfo.frozen
      };

      // Check if association already exists (same subject and associationType)
      const existingIndex = cacheEntry.associations.findIndex(
        a => a.subject === association.subject && a.associationType === association.associationType
      );

      if (existingIndex >= 0) {
        // Update existing
        cacheEntry.associations[existingIndex] = association;
      } else {
        // Add new
        cacheEntry.associations.push(association);
      }

      responseAssociations.push({
        subject: association.subject,
        associationType: association.associationType,
        lifecycle: association.lifecycle,
        frozen: association.frozen
      });
    }

    return {
      resourceName,
      resourceNamespace,
      resourceId,
      resourceType,
      associations: responseAssociations
    };
  }

  async deleteAssociations(
    resourceId: string,
    resourceType: string | null,
    associationTypes: string[] | null,
    cascadeLifecycle: boolean
  ): Promise<void> {
    const cacheEntry = this.associationCache.get(resourceId);
    if (!cacheEntry) {
      return;
    }

    if (resourceType != null && cacheEntry.resourceType !== resourceType) {
      return;
    }

    if (associationTypes == null || associationTypes.length === 0) {
      // Delete all associations for this resourceId
      this.associationCache.delete(resourceId);
    } else {
      // Filter out specified association types
      cacheEntry.associations = cacheEntry.associations.filter(
        a => !associationTypes.includes(a.associationType)
      );

      // If no associations left, remove the entry
      if (cacheEntry.associations.length === 0) {
        this.associationCache.delete(resourceId);
      }
    }
  }

  clearLatestCaches(): void {
    return;
  }

  clearCaches(): void {
    return;
  }

  async close(): Promise<void> {
    return;
  }

  private schemasEqual(schema1: SchemaInfo, schema2: SchemaInfo): boolean {
    return stringify(schema1) === stringify(schema2);
  }
}

export { MockClient };
