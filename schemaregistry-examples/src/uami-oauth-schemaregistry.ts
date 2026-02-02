import { SchemaRegistryClient, BearerAuthCredentials, ClientConfig } from '@confluentinc/schemaregistry';
import { CreateAxiosDefaults } from 'axios';
import {
  identityPoolId, schemaRegistryLogicalCluster, baseUrl
} from './constants';

// User Assigned Managed Identity (UAMI) configuration
// Update these values for your Azure environment
const uamiClientId = '<your-uami-client-id>'; 
const azureResource = '<your-azure-resource>';
const azureApiVersion = '2025-04-07';

// Build the IMDS query string for UAMI (includes client_id to specify which identity to use)
const uamiImdsQuery = `api-version=${azureApiVersion}&resource=${azureResource}&client_id=${uamiClientId}`;

async function uamiOauthSchemaRegistry() {

  const bearerAuthCredentials: BearerAuthCredentials = {
    credentialsSource: 'OAUTHBEARER_AZURE_IMDS',
    issuerEndpointQuery: uamiImdsQuery,
    identityPoolId: identityPoolId,
    logicalCluster: schemaRegistryLogicalCluster
  };

  const createAxiosDefaults: CreateAxiosDefaults = {
    timeout: 10000
  };

  const clientConfig: ClientConfig = {
    baseURLs: [baseUrl],
    createAxiosDefaults: createAxiosDefaults,
    cacheCapacity: 512,
    cacheLatestTtlSecs: 60,
    bearerAuthCredentials: bearerAuthCredentials
  };

  const schemaRegistryClient = new SchemaRegistryClient(clientConfig);

  console.log("Current Subjects:", await schemaRegistryClient.getAllSubjects());
  console.log("Current Config:", await schemaRegistryClient.getDefaultConfig());
  console.log("Current Compatibility:", await schemaRegistryClient.getDefaultCompatibility());
}

uamiOauthSchemaRegistry();
