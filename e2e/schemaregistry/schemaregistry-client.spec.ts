import { RestService } from '../../schemaregistry/rest-service';
import {
  Compatibility,
  SchemaRegistryClient,
  ServerConfig,
  SchemaInfo,
  SchemaMetadata,
  Metadata
} from '../../schemaregistry/schemaregistry-client';
import { beforeEach, describe, expect, it } from '@jest/globals';

/* eslint-disable @typescript-eslint/no-non-null-asserted-optional-chain */

const baseUrls = ['http://localhost:8081'];
const headers = { 'Content-Type': 'application/vnd.schemaregistry.v1+json' };
const restService = new RestService(baseUrls, false);
restService.setHeaders(headers);

const basicAuth = Buffer.from('RBACAllowedUser-lsrc1:nohash').toString('base64');
restService.setAuth(basicAuth);

restService.setTimeout(10000);

let schemaRegistryClient: SchemaRegistryClient;
const testSubject = 'integ-test-subject';
const testServerConfigSubject = 'integ-test-server-config-subject';

const schemaString: string = JSON.stringify({
  type: 'record',
  name: 'User',
  fields: [
    { name: 'name', type: 'string' },
    { name: 'age', type: 'int' },
  ],
});

const metadata: Metadata = {
  properties: {
    owner: 'Bob Jones',
    email: 'bob@acme.com',
  },
};

const schemaInfo: SchemaInfo = {
  schema: schemaString,
  metadata: metadata,
};

const backwardCompatibleSchemaString: string = JSON.stringify({
  type: 'record',
  name: 'User',
  fields: [
    { name: 'name', type: 'string' },
    { name: 'age', type: 'int' },
    { name: 'email', type: 'string', default: "" },
  ],
});

const backwardCompatibleMetadata: Metadata = {
  properties: {
    owner: 'Bob Jones2',
    email: 'bob@acme.com',
  },
};

const backwardCompatibleSchemaInfo: SchemaInfo = {
  schema: backwardCompatibleSchemaString,
  schemaType: 'AVRO',
  metadata: backwardCompatibleMetadata,
};

describe('SchemaRegistryClient Integration Test', () => {

  beforeEach(async () => {
    schemaRegistryClient = new SchemaRegistryClient(restService);
    const subjects: string[] = await schemaRegistryClient.getAllSubjects();

    if (subjects && subjects.includes(testSubject)) {
      await schemaRegistryClient.deleteSubject(testSubject);
      await schemaRegistryClient.deleteSubject(testSubject, true);
    }

    if (subjects && subjects.includes(testServerConfigSubject)) {
      await schemaRegistryClient.deleteSubject(testServerConfigSubject);
      await schemaRegistryClient.deleteSubject(testServerConfigSubject, true);
    }
  });

  it('should register, retrieve, and delete a schema', async () => {
    // Register a schema
    const registerResponse:  SchemaMetadata = await schemaRegistryClient.registerFullResponse(testSubject, schemaInfo);
    expect(registerResponse).toBeDefined();

    const schemaId = registerResponse?.id!;
    const version = registerResponse?.version!;

    const getSchemaResponse: SchemaInfo = await schemaRegistryClient.getBySubjectAndId(testSubject, schemaId);
    expect(getSchemaResponse).toEqual(schemaInfo);

    const getIdResponse: number = await schemaRegistryClient.getId(testSubject, schemaInfo);
    expect(getIdResponse).toEqual(schemaId);

    // Delete the schema
    const deleteSubjectResponse: number = await schemaRegistryClient.deleteSubjectVersion(testSubject, version);
    expect(deleteSubjectResponse).toEqual(version);

    const permanentDeleteSubjectResponse: number = await schemaRegistryClient.deleteSubjectVersion(testSubject, version, true);
    expect(permanentDeleteSubjectResponse).toEqual(version);
  });

  it('Should get all versions and a specific version of a schema', async () => {
    // Register a schema
    const registerResponse:  SchemaMetadata = await schemaRegistryClient.registerFullResponse(testSubject, schemaInfo);
    expect(registerResponse).toBeDefined();

    const version = registerResponse?.version!;

    const getVersionResponse: number = await schemaRegistryClient.getVersion(testSubject, schemaInfo);
    expect(getVersionResponse).toEqual(version);

    const allVersionsResponse: number[] = await schemaRegistryClient.getAllVersions(testSubject);
    expect(allVersionsResponse).toEqual([version]);
  });

  it('Should get schema metadata', async () => {
    // Register a schema
    const registerResponse:  SchemaMetadata = await schemaRegistryClient.registerFullResponse(testSubject, schemaInfo);
    expect(registerResponse).toBeDefined();

    const schemaVersion: number = registerResponse?.version!;

    const registerResponse2:  SchemaMetadata = await schemaRegistryClient.registerFullResponse(testSubject, backwardCompatibleSchemaInfo);
    expect(registerResponse2).toBeDefined();

    const schemaMetadata: SchemaMetadata = {
      id: registerResponse?.id!,
      version: schemaVersion,
      schema: schemaInfo.schema,
      subject: testSubject,
      metadata: metadata,
    };

    const schemaMetadata2: SchemaMetadata = {
      id: registerResponse2?.id!,
      version: registerResponse2?.version!,
      schema: backwardCompatibleSchemaInfo.schema,
      subject: testSubject,
      metadata: backwardCompatibleMetadata,
    };

    const getLatestMetadataResponse:  SchemaMetadata = await schemaRegistryClient.getLatestSchemaMetadata(testSubject);
    expect(schemaMetadata2).toEqual(getLatestMetadataResponse);

    const getMetadataResponse:  SchemaMetadata = await schemaRegistryClient.getSchemaMetadata(testSubject, schemaVersion);
    expect(schemaMetadata).toEqual(getMetadataResponse);
  });

  it('Should test compatibility for a version and subject, getting and updating', async () => {
    const registerResponse:  SchemaMetadata = await schemaRegistryClient.registerFullResponse(testSubject, schemaInfo);
    expect(registerResponse).toBeDefined();

    const version = registerResponse?.version!;

    const updateCompatibilityResponse: Compatibility = await schemaRegistryClient.updateCompatibility(testSubject, Compatibility.BackwardTransitive);
    expect(updateCompatibilityResponse).toEqual(Compatibility.BackwardTransitive);

    const getCompatibilityResponse: Compatibility = await schemaRegistryClient.getCompatibility(testSubject);
    expect(getCompatibilityResponse).toEqual(Compatibility.BackwardTransitive);

    const testSubjectCompatibilityResponse: boolean = await schemaRegistryClient.testSubjectCompatibility(testSubject, backwardCompatibleSchemaInfo);
    expect(testSubjectCompatibilityResponse).toEqual(true);

    const testCompatibilityResponse: boolean = await schemaRegistryClient.testCompatibility(testSubject, version, backwardCompatibleSchemaInfo);
    expect(testCompatibilityResponse).toEqual(true);
  });

  it('Should update and get default compatibility', async () => {
    const updateDefaultCompatibilityResponse: Compatibility = await schemaRegistryClient.updateDefaultCompatibility(Compatibility.Full);
    expect(updateDefaultCompatibilityResponse).toEqual(Compatibility.Full);

    const getDefaultCompatibilityResponse: Compatibility = await schemaRegistryClient.getDefaultCompatibility();
    expect(getDefaultCompatibilityResponse).toEqual(Compatibility.Full);
  });

  it('Should update and get subject Config', async () => {
    const subjectConfigRequest: ServerConfig = {
      compatibility: Compatibility.Full,
      normalize: true
    };

    const subjectConfigResponse: ServerConfig = {
      compatibilityLevel: Compatibility.Full,
      normalize: true
    };

    const registerResponse:  SchemaMetadata = await schemaRegistryClient.registerFullResponse(testServerConfigSubject, schemaInfo);
    expect(registerResponse).toBeDefined();

    const updateConfigResponse: ServerConfig = await schemaRegistryClient.updateConfig(testServerConfigSubject, subjectConfigRequest);
    expect(updateConfigResponse).toBeDefined();

    const getConfigResponse: ServerConfig = await schemaRegistryClient.getConfig(testServerConfigSubject);
    expect(getConfigResponse).toEqual(subjectConfigResponse);
  });

  it('Should get and set default Config', async () => {
    const serverConfigRequest: ServerConfig = {
      compatibility: Compatibility.Full,
      normalize: false
    };

    const serverConfigResponse: ServerConfig = {
      compatibilityLevel: Compatibility.Full,
      normalize: false
    };

    const updateDefaultConfigResponse: ServerConfig = await schemaRegistryClient.updateDefaultConfig(serverConfigRequest);
    expect(updateDefaultConfigResponse).toBeDefined();

    const getDefaultConfigResponse: ServerConfig = await schemaRegistryClient.getDefaultConfig();
    expect(getDefaultConfigResponse).toEqual(serverConfigResponse);
  });

});
