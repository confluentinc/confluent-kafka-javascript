import { beforeEach, afterEach, describe, expect, it, jest } from '@jest/globals';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { RestService } from '../rest-service';
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
