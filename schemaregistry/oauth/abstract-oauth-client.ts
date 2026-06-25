import { sleep, fullJitter, isRetriable } from '../retry-helper';
import { isBoom } from '@hapi/boom';
import {
  _BearerTokenProvider as BearerTokenProvider,
  _BearerTokenProviderBuilder as BearerTokenProviderBuilder
} from './bearer-token-provider';
import { BearerAuthCredentials } from '../rest-service';

abstract class AbstractBearerTokenProviderBuilder implements BearerTokenProviderBuilder {
  
  protected bearerAuthCredentials : BearerAuthCredentials;

  constructor(
      bearerAuthCredentials: BearerAuthCredentials) {
      this.bearerAuthCredentials = bearerAuthCredentials;
  }

  protected validate() {
    if (!('logicalCluster' in this.bearerAuthCredentials)) {
      throw new Error("Bearer auth header 'logicalCluster' not provided");
    }
  }

  abstract build(maxRetries: number, retriesWaitMs: number, retriesMaxWaitMs: number): BearerTokenProvider;
}

abstract class AbstractOauthTokenProvider implements BearerTokenProvider {

  private additionalHeaders: Record<string, string>;

  constructor(bearerAuthCredentials: BearerAuthCredentials) {
    this.additionalHeaders = {
      'target-sr-cluster': bearerAuthCredentials.logicalCluster!,
    };

    const poolId = Array.isArray(bearerAuthCredentials.identityPoolId)
      ? bearerAuthCredentials.identityPoolId.join(',')
      : bearerAuthCredentials.identityPoolId;

    if (poolId) {
      this.additionalHeaders['Confluent-Identity-Pool-Id'] = poolId;
    }
  }
  
  abstract getAccessToken(): Promise<string>

  abstract tokenExpired(): boolean;

  getAdditionalHeaders(): Record<string, string> {
    return this.additionalHeaders;
  }
}

abstract class AbstractOAuthClient extends AbstractOauthTokenProvider {
  private token: string | null = null;
  private maxRetries: number;
  private retriesWaitMs: number;
  private retriesMaxWaitMs: number;

  constructor(bearerAuthCredentials: BearerAuthCredentials,
    maxRetries: number, retriesWaitMs: number, retriesMaxWaitMs: number
  ) {
    super(bearerAuthCredentials);
    this.maxRetries = maxRetries;
    this.retriesWaitMs = retriesWaitMs;
    this.retriesMaxWaitMs = retriesMaxWaitMs;
  }

  abstract fetchToken(): Promise<string>;

  override async getAccessToken(): Promise<string> {
    if (this.token === null || this.tokenExpired()) {
      await this.generateAccessToken();
      if (this.token === null)
        throw new Error(`token must be available here`);
    }

    return this.token;
  }

  async generateAccessToken(): Promise<void> {
    for (let i = 0; i < this.maxRetries + 1; i++) {
      try {
        this.token = await this.fetchToken();
        return;
      } catch (error: any) {
        if (isBoom(error) && i < this.maxRetries) {
          const statusCode = error.output.statusCode;
          if (isRetriable(statusCode)) {
            const waitTime = fullJitter(this.retriesWaitMs, this.retriesMaxWaitMs, i);
            await sleep(waitTime);
            continue;
          }
        } 
        throw new Error(`Failed to get token from server: ${error}`);
      }
    }
  }
}

// internal/testing usage only
export {
  AbstractBearerTokenProviderBuilder as _AbstractBearerTokenProviderBuilder,
  AbstractOauthTokenProvider as _AbstractOauthTokenProvider,
  AbstractOAuthClient as _AbstractOAuthClient,
}