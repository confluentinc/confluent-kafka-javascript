import { beforeEach, afterEach, describe, expect, it, jest } from '@jest/globals';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { RestService, BearerAuthCredentials } from '../rest-service';
import { RestError } from '../rest-error';
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

  it('should retry on network errors with no HTTP response', async () => {
    const url = '/test';

    // networkError() rejects with an error that has no `response`, mimicking a
    // DNS failure / connection refused / reset, etc.
    mock.onGet(url).networkError();

    await expect(restService.handleRequest(url, 'GET')).rejects.toThrowError();
    expect(mock.history.get.length).toBe(maxRetries + 1);
  });

  it('should retry on request timeouts with no HTTP response', async () => {
    const url = '/test';

    mock.onGet(url).timeout();

    await expect(restService.handleRequest(url, 'GET')).rejects.toThrowError();
    expect(mock.history.get.length).toBe(maxRetries + 1);
  });

  it('should not retry intentionally cancelled requests', async () => {
    const url = '/test';
    const fullJitterSpy = jest.spyOn(retryHelper, 'fullJitter');

    mock.onGet(url).reply(200, {});

    // An already-aborted signal makes axios reject with a cancellation
    // (ERR_CANCELED) error that has no response.
    const controller = new AbortController();
    controller.abort();

    await expect(
      restService.handleRequest(url, 'GET', undefined, { signal: controller.signal })
    ).rejects.toThrowError();

    // A cancellation must not schedule any retry/backoff.
    expect(fullJitterSpy).not.toHaveBeenCalled();

    fullJitterSpy.mockRestore();
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

describe('RestService Error Responses', () => {
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

  it('should report a Schema Registry error body as a RestError', async () => {
    mock.onGet('/test').reply(404, { error_code: 40470, message: "Key 'test-value' not found" });

    const error = await restService.handleRequest('/test', 'GET').catch((e) => e);

    expect(error).toBeInstanceOf(RestError);
    expect(error.status).toBe(404);
    expect(error.errorCode).toBe(40470);
    expect(error.message).toContain("Key 'test-value' not found");
  });

  it('should preserve the status when the error body is not a Schema Registry error', async () => {
    // A response produced by a proxy rather than by Schema Registry. The status
    // used to be dropped along with the body, leaving callers that classify
    // errors by status (e.g. treating 404 as "not registered yet") unable to.
    mock.onGet('/test').reply(404, '<html>not found</html>');

    const error = await restService.handleRequest('/test', 'GET').catch((e) => e);

    expect(error).toBeInstanceOf(RestError);
    expect(error.status).toBe(404);
    expect(error.errorCode).toBe(-1);
  });

  it('should preserve the status when the error response has no body', async () => {
    mock.onGet('/test').reply(404);

    const error = await restService.handleRequest('/test', 'GET').catch((e) => e);

    expect(error).toBeInstanceOf(RestError);
    expect(error.status).toBe(404);
    expect(error.errorCode).toBe(-1);
  });

  it('should preserve an error code of zero', async () => {
    // A falsy error code must not be mistaken for a missing one.
    mock.onGet('/test').reply(422, { error_code: 0, message: 'invalid' });

    const error = await restService.handleRequest('/test', 'GET').catch((e) => e);

    expect(error).toBeInstanceOf(RestError);
    expect(error.status).toBe(422);
    expect(error.errorCode).toBe(0);
    expect(error.message).toContain('invalid');
  });

  it('should preserve the status of a retriable error once retries are exhausted', async () => {
    mock.onGet('/test').reply(503, { error_code: 50301, message: 'unavailable' });

    const error = await restService.handleRequest('/test', 'GET').catch((e) => e);

    expect(error).toBeInstanceOf(RestError);
    expect(error.status).toBe(503);
    expect(error.errorCode).toBe(50301);
    expect(mock.history.get.length).toBe(maxRetries + 1);
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
