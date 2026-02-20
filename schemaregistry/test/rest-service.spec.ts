import { beforeEach, afterEach, describe, expect, it, jest } from '@jest/globals';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { RestService, BearerAuthCredentials } from '../rest-service';
import * as retryHelper from '@confluentinc/schemaregistry/retry-helper';
import { maxRetries, retriesWaitMs, retriesMaxWaitMs } from './test-constants';

describe('RestService Retry Policy', () => {
  let restService: RestService;
  let mock: InstanceType<typeof MockAdapter>;

  beforeEach(() => {
    mock = new MockAdapter(axios);
    restService = new RestService(['http://localhost'], false, {}, undefined, undefined,
      maxRetries, retriesWaitMs, retriesMaxWaitMs);
  });

  afterEach(() => {
    mock.reset();
  });

  it('should retry on retryable errors and eventually succeed', async () => {
    const url = '/test';
    const responseData = { message: 'Success' };

    mock.onGet(url).replyOnce(429).onGet(url).replyOnce(502).onGet(url).reply(200, responseData);

    const response = await restService.handleRequest(url, 'GET');

    expect(response.status).toBe(200);
    expect(response.data).toEqual(responseData);
    expect(mock.history.get.length).toBe(3);
  });

  it('should throw an error after exhausting retries', async () => {
    const url = '/test';

    mock.onGet(url).reply(429);

    await expect(restService.handleRequest(url, 'GET')).rejects.toThrowError();
    expect(mock.history.get.length).toBe(maxRetries + 1);
  });

  it('should not retry on non-retryable errors (e.g., 401)', async () => {
    const url = '/test';

    mock.onGet(url).reply(401);

    await expect(restService.handleRequest(url, 'GET')).rejects.toThrowError();
    expect(mock.history.get.length).toBe(1);
  });

  it('should apply exponential backoff with jitter and retry only on retriable errors', async () => {
    const url = '/test';
    jest.spyOn(retryHelper, 'isRetriable');
    jest.spyOn(retryHelper, 'fullJitter');

    mock.onGet(url).reply(500);

    await expect(restService.handleRequest(url, 'GET')).rejects.toThrowError();

    expect(mock.history.get.length).toBe(maxRetries + 1);

    expect(retryHelper.fullJitter).toHaveBeenCalledTimes(maxRetries);
    expect(retryHelper.fullJitter).toHaveBeenCalledWith(retriesWaitMs, retriesMaxWaitMs, 0);
    expect(retryHelper.fullJitter).toHaveBeenCalledWith(retriesWaitMs, retriesMaxWaitMs, 1);

    expect(retryHelper.isRetriable).toHaveBeenCalledTimes(maxRetries);
    expect(retryHelper.isRetriable).toHaveBeenCalledWith(500);
  });
});

describe('RestService Bearer Auth', () => {
  let mock: InstanceType<typeof MockAdapter>;

  beforeEach(() => {
    mock = new MockAdapter(axios);
  });

  afterEach(() => {
    mock.reset();
  });

  it('should set Confluent-Identity-Pool-Id header when identityPoolId is provided', async () => {
    const bearerAuth: BearerAuthCredentials = {
      credentialsSource: 'STATIC_TOKEN',
      token: 'my-token',
      logicalCluster: 'lsrc-abc123',
      identityPoolId: 'pool-Gx30',
    };

    const restService = new RestService(
      ['http://localhost'], false, {}, undefined, bearerAuth,
      maxRetries, retriesWaitMs, retriesMaxWaitMs
    );

    mock.onGet('/subjects').reply(200, ['subject1']);
    await restService.handleRequest('/subjects', 'GET');

    const requestHeaders = mock.history.get[0].headers;
    expect(requestHeaders?.['Confluent-Identity-Pool-Id']).toBe('pool-Gx30');
    expect(requestHeaders?.['target-sr-cluster']).toBe('lsrc-abc123');
    expect(requestHeaders?.['Authorization']).toBe('Bearer my-token');
  });

  it('should join array of identityPoolIds into comma-separated header', async () => {
    const bearerAuth: BearerAuthCredentials = {
      credentialsSource: 'STATIC_TOKEN',
      token: 'my-token',
      logicalCluster: 'lsrc-abc123',
      identityPoolId: ['pool-1', 'pool-2', 'pool-3'],
    };

    const restService = new RestService(
      ['http://localhost'], false, {}, undefined, bearerAuth,
      maxRetries, retriesWaitMs, retriesMaxWaitMs
    );

    mock.onGet('/subjects').reply(200, ['subject1']);
    await restService.handleRequest('/subjects', 'GET');

    const requestHeaders = mock.history.get[0].headers;
    expect(requestHeaders?.['Confluent-Identity-Pool-Id']).toBe('pool-1,pool-2,pool-3');
  });

  it('should not set Confluent-Identity-Pool-Id header when identityPoolId is omitted', async () => {
    const bearerAuth: BearerAuthCredentials = {
      credentialsSource: 'STATIC_TOKEN',
      token: 'my-token',
      logicalCluster: 'lsrc-abc123',
    };

    const restService = new RestService(
      ['http://localhost'], false, {}, undefined, bearerAuth,
      maxRetries, retriesWaitMs, retriesMaxWaitMs
    );

    mock.onGet('/subjects').reply(200, ['subject1']);
    await restService.handleRequest('/subjects', 'GET');

    const requestHeaders = mock.history.get[0].headers;
    expect(requestHeaders?.['Confluent-Identity-Pool-Id']).toBeUndefined();
    expect(requestHeaders?.['target-sr-cluster']).toBe('lsrc-abc123');
  });
});
