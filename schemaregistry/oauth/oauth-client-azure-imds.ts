import {
  _AbstractOAuthClient as AbstractOAuthClient,
  _AbstractBearerTokenProviderBuilder as AbstractBearerTokenProviderBuilder
} from './abstract-oauth-client';
import Wreck from '@hapi/wreck';
import { BearerAuthCredentials } from '../rest-service';
import {
  _BearerTokenProvider as BearerTokenProvider
} from './bearer-token-provider';

const TOKEN_EXPIRATION_THRESHOLD_PERCENTAGE = 0.8;

class AzureIMDSBearerToken {
  access_token?: string = undefined;
  expires_in?: string = undefined;
  expires_on?: string = undefined;
}

class AzureIMDSOAuthClientBuilder extends AbstractBearerTokenProviderBuilder {
  constructor(
      bearerAuthCredentials: BearerAuthCredentials) {
      super(bearerAuthCredentials);
  }

  protected override validate() {
    super.validate();
    if (!this.bearerAuthCredentials.issuerEndpointUrl &&
        !this.bearerAuthCredentials.issuerEndpointQuery)
        throw new Error(`Missing required configuration property: issuerEndpointQuery`);
  }

  override build(maxRetries: number, retriesWaitMs: number, retriesMaxWaitMs: number): BearerTokenProvider {
    this.validate();
    return new AzureIMDSOAuthClient(this.bearerAuthCredentials, maxRetries, retriesWaitMs, retriesMaxWaitMs);
  }
}

class AzureIMDSOAuthClient extends AbstractOAuthClient {

  private tokenEndpoint: string; 
  private tokenObject?: AzureIMDSBearerToken;
  private static readonly DEFAULT_AZURE_IMDS_TOKEN_ENDPOINT : string = 'http://169.254.169.254/metadata/identity/oauth2/token';

  constructor(bearerAuthCredentials: BearerAuthCredentials,
    maxRetries: number, retriesWaitMs: number,
    retriesMaxWaitMs: number
  ) {
    super(bearerAuthCredentials, maxRetries, retriesWaitMs, retriesMaxWaitMs);
    this.tokenEndpoint = bearerAuthCredentials.issuerEndpointUrl ||
      AzureIMDSOAuthClient.DEFAULT_AZURE_IMDS_TOKEN_ENDPOINT;
    if (bearerAuthCredentials.issuerEndpointQuery) {
      const url = new URL(this.tokenEndpoint);
      url.search = bearerAuthCredentials.issuerEndpointQuery;
      url.hash = '';
      this.tokenEndpoint = url.toString();
    }
  }

  override async fetchToken(): Promise<string> {
      const { payload } = await Wreck.get<AzureIMDSBearerToken>(
        this.tokenEndpoint, {
        headers: {
          Metadata: 'true'
        },
        json: 'force',
        timeout: 30000 // 30 seconds limit for each request
      });
      this.tokenObject = payload;
      return this.getAccessTokenString();
  }

  override tokenExpired(): boolean {
    if (!this.tokenObject?.expires_in || !this.tokenObject?.expires_on)
      return true;

    const expiresIn = +this.tokenObject.expires_in;
    let expiresOn = +this.tokenObject.expires_on;
    if (isNaN(expiresIn) || isNaN(expiresOn))
      return true;

    const expiryWindow = expiresIn * 1000 * TOKEN_EXPIRATION_THRESHOLD_PERCENTAGE;
    expiresOn = expiresOn * 1000;
    return expiresOn < Date.now() + expiryWindow;
  }

  private getAccessTokenString(): string {
    const accessToken = this.tokenObject?.access_token;

    if (typeof accessToken !== 'string') {
      throw new Error('Access token is not available');
    }

    return accessToken;
  }
}

// internal/testing usage only
export {
  AzureIMDSOAuthClientBuilder as _AzureIMDSOAuthClientBuilder,
  AzureIMDSOAuthClient as _AzureIMDSOAuthClient,
  AzureIMDSBearerToken as _AzureIMDSBearerToken
}