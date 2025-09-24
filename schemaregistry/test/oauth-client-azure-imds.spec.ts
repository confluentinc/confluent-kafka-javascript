import {
  _AzureIMDSOAuthClient as AzureIMDSOAuthClient,
  _AzureIMDSOAuthClientBuilder as AzureIMDSOAuthClientBuilder,
  _AzureIMDSBearerToken as AzureIMDSBearerToken,
 } from '../oauth/oauth-client-azure-imds';
import { beforeEach, afterEach, describe, expect, it, jest } from '@jest/globals';
import Wreck from '@hapi/wreck';
import * as retryHelper from '@confluentinc/schemaregistry/retry-helper';
import { maxRetries, retriesWaitMs, retriesMaxWaitMs } from './test-constants';
import { boomify } from '@hapi/boom';
import { BearerAuthCredentials } from '../rest-service';
import Http from 'http';

const mockError = boomify(new Error('Error Message'), { statusCode: 429 });
const mockErrorNonRetry = boomify(new Error('Error Message'), { statusCode: 401 });

describe('AzureIMDSOAuthClient', () => {
  const tokenEndpoint = 'https://example.com/token';
  const tokenEndpointQuery = 'resource=&api-version=&client_id=';

  let oauthClient: AzureIMDSOAuthClient;

  const res : Http.IncomingMessage = {} as Http.IncomingMessage;
  const WreckGetSpy = jest.spyOn(Wreck, 'get');
  const mockToken: AzureIMDSBearerToken = {
    access_token: 'mockAccessToken',
    expires_in: '3600',
    expires_on: (Math.floor(Date.now() / 1000) + 3600).toString(), // 1 hour from now
  };
  const mockTokenExpired: AzureIMDSBearerToken = {
    access_token: 'mockAccessToken',
    expires_in: '3600',
    expires_on: (Math.floor(Date.now() / 1000) - 7200).toString(), // 2 hours ago
  };
  const basicConfig: BearerAuthCredentials = {
    credentialsSource: 'OAUTHBEARER_AZURE_IMDS',
    logicalCluster: 'clusterId',
    identityPoolId: 'identityPoolId',
  };

  beforeEach(() => {

    const bearerAuthCredentials: BearerAuthCredentials = {
      ...basicConfig,
      issuerEndpointQuery: tokenEndpointQuery
    };

    oauthClient = new AzureIMDSOAuthClientBuilder(
        bearerAuthCredentials,
    ).build(
      maxRetries, retriesWaitMs, retriesMaxWaitMs
    ) as AzureIMDSOAuthClient;

    jest.spyOn(retryHelper, 'isRetriable');
    jest.spyOn(retryHelper, 'fullJitter');
    jest.spyOn(retryHelper, 'sleep');

    jest.spyOn(oauthClient, 'generateAccessToken');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should fail when no endpoint or query parameters are provided', async () => {
    const bearerAuthCredentialsException: BearerAuthCredentials = {
      ...basicConfig
    }
    expect(() =>
      new AzureIMDSOAuthClientBuilder(
        bearerAuthCredentialsException,
      ).build(maxRetries, retriesWaitMs, retriesMaxWaitMs)
    ).toThrow(new Error('Missing required configuration property: issuerEndpointQuery'));
  });

  it('should retrieve an access token successfully', async () => {
    WreckGetSpy.mockResolvedValueOnce({ payload: mockToken, res });

    const token = await oauthClient.getAccessToken();
    expect(token).toBe('mockAccessToken');
    expect(WreckGetSpy).toHaveBeenCalledWith(
      expect.stringContaining(`http://169.254.169.254/metadata/identity/oauth2/token?${tokenEndpointQuery}`),
      expect.any(Object));
  });

  it('should succeed when an endpoint is provided', async () => {
    WreckGetSpy.mockResolvedValueOnce({ payload: mockToken, res });
    const bearerAuthCredentialsEndpoint: BearerAuthCredentials = {
      ...basicConfig,
      issuerEndpointUrl: tokenEndpoint
    }

    await expect(async () => {
      const oauthClientEndpoint = new AzureIMDSOAuthClientBuilder(
        bearerAuthCredentialsEndpoint,
      ).build(maxRetries, retriesWaitMs, retriesMaxWaitMs);

      const token = await oauthClientEndpoint.getAccessToken();
      expect(token).toBe('mockAccessToken');
      expect(WreckGetSpy).toHaveBeenCalledWith(
        expect.stringContaining(`${tokenEndpoint}`),
        expect.any(Object));
    }).not.toThrow();
  });

  it('should succeed when both an endpoint and a query are provided', async () => {
    WreckGetSpy.mockResolvedValueOnce({ payload: mockToken, res });
    const bearerAuthCredentialsEndpointQuery: BearerAuthCredentials = {
      ...basicConfig,
      issuerEndpointUrl: tokenEndpoint,
      issuerEndpointQuery: tokenEndpointQuery,
    }

    await expect(async () => {
      const oauthClientEndpoint = new AzureIMDSOAuthClientBuilder(
        bearerAuthCredentialsEndpointQuery,
      ).build(maxRetries, retriesWaitMs, retriesMaxWaitMs);

      const token = await oauthClientEndpoint.getAccessToken();
      expect(token).toBe('mockAccessToken');
      expect(WreckGetSpy).toHaveBeenCalledWith(
        expect.stringContaining(`${tokenEndpoint}?${tokenEndpointQuery}`),
        expect.any(Object));
    }).not.toThrow();
  });

  it('should retry on retriable errors and succeed', async () => {

    // Fail twice with retriable errors, then succeed
    WreckGetSpy
      .mockRejectedValueOnce(mockError)
      .mockRejectedValueOnce(mockError)
      .mockResolvedValue({ payload: mockToken, res });

    const token = await oauthClient.getAccessToken();

    expect(token).toBe('mockAccessToken');
    expect(retryHelper.fullJitter).toHaveBeenCalledTimes(maxRetries);
    expect(retryHelper.fullJitter).toHaveBeenCalledWith(retriesWaitMs, retriesMaxWaitMs, 0);
    expect(retryHelper.fullJitter).toHaveBeenCalledWith(retriesWaitMs, retriesMaxWaitMs, 1);
    
    expect(retryHelper.isRetriable).toHaveBeenCalledTimes(maxRetries);
    expect(retryHelper.sleep).toHaveBeenCalledTimes(maxRetries);
  });

  it('should fail immediately on non-retriable errors', async () => {
    WreckGetSpy.mockRejectedValueOnce(mockErrorNonRetry);
    await expect(oauthClient.getAccessToken()).rejects.toThrowError();

    expect(retryHelper.isRetriable).toHaveBeenCalledTimes(1);
    expect(retryHelper.fullJitter).not.toHaveBeenCalled();
    expect(retryHelper.sleep).not.toHaveBeenCalled();
  });

  it('should fail after exhausting all retries', async () => {
    WreckGetSpy.mockRejectedValue(mockError);

    await expect(oauthClient.getAccessToken()).rejects.toThrowError();


    expect(retryHelper.isRetriable).toHaveBeenCalledTimes(maxRetries);

    expect(retryHelper.fullJitter).toHaveBeenCalledTimes(maxRetries);
    expect(retryHelper.fullJitter).toHaveBeenCalledWith(retriesWaitMs, retriesMaxWaitMs, 0);
    expect(retryHelper.fullJitter).toHaveBeenCalledWith(retriesWaitMs, retriesMaxWaitMs, 1);
    expect(retryHelper.sleep).toHaveBeenCalledTimes(maxRetries);
  });

  it('should not refresh token when not expired', async () => {
    WreckGetSpy.mockResolvedValueOnce({ payload: mockToken, res });

    await oauthClient.getAccessToken();
    await oauthClient.getAccessToken();

    expect(oauthClient.generateAccessToken).toHaveBeenCalledTimes(1);
  });

  it('should refresh token when expired', async () => {
    WreckGetSpy.mockResolvedValueOnce({ payload: mockTokenExpired, res });
    WreckGetSpy.mockResolvedValueOnce({ payload: mockToken, res });

    await oauthClient.getAccessToken();
    await oauthClient.getAccessToken();

    expect(oauthClient.generateAccessToken).toHaveBeenCalledTimes(2);
  });
});
