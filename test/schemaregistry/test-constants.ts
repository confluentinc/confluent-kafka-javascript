import { CreateAxiosDefaults } from 'axios';
import { ClientConfig, BasicAuthCredentials } from '../../schemaregistry/rest-service';

const baseUrls = ['http://localhost:8081'];

const mockBaseUrls = ['http://mocked-url'];

const createAxiosDefaults: CreateAxiosDefaults = {
  timeout: 10000
};

const basicAuthCredentials: BasicAuthCredentials = {
  credentialsSource: 'USER_INFO',
  userInfo: 'RBACAllowedUser-lsrc1:nohash',
};

const clientConfig: ClientConfig = {
  baseURLs: baseUrls,
  createAxiosDefaults: createAxiosDefaults,
  isForward: false,
  cacheCapacity: 512,
  cacheLatestTtlSecs: 60,
  basicAuthCredentials: basicAuthCredentials,
};

const mockClientConfig: ClientConfig = {
  baseURLs: mockBaseUrls,
  createAxiosDefaults: createAxiosDefaults,
  isForward: false,
  cacheCapacity: 512,
  cacheLatestTtlSecs: 60,
  basicAuthCredentials: basicAuthCredentials
};

export { clientConfig, mockClientConfig };
