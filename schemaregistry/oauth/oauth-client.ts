import { ModuleOptions, ClientCredentials, ClientCredentialTokenConfig, AccessToken } from 'simple-oauth2';
import {
  _AbstractBearerTokenProviderBuilder as AbstractBearerTokenProviderBuilder,
  _AbstractOAuthClient as AbstractOAuthClient,
} from './abstract-oauth-client';
import { BearerAuthCredentials } from '../rest-service';
import {
  _BearerTokenProvider as BearerTokenProvider
} from './bearer-token-provider';
const TOKEN_EXPIRATION_THRESHOLD_SECONDS = 30 * 60; // 30 minutes

class OAuthClientBuilder extends AbstractBearerTokenProviderBuilder {
    
    static readonly requiredFields = [
      'clientId',
      'clientSecret',
      'issuerEndpointUrl',
      'scope'
    ];

    constructor(
        bearerAuthCredentials: BearerAuthCredentials) {
        super(bearerAuthCredentials);
    }
  
    protected override validate() {
      super.validate();
      const missingField = OAuthClientBuilder.requiredFields.find(
        field => !(field in this.bearerAuthCredentials));

      if (missingField) {
        throw new Error(`OAuth credential '${missingField}' not provided`);
      }
    }
  
    override build(maxRetries: number, retriesWaitMs: number, retriesMaxWaitMs: number) : BearerTokenProvider {
      this.validate();
      return new OAuthClient(
        this.bearerAuthCredentials,
        maxRetries,
        retriesWaitMs,
        retriesMaxWaitMs);
    }
}

class OAuthClient extends AbstractOAuthClient {
  private client: ClientCredentials;
  private tokenObject: AccessToken | undefined;
  private tokenParams: ClientCredentialTokenConfig;

  constructor(bearerAuthCredentials: BearerAuthCredentials,
    maxRetries: number, retriesWaitMs: number, retriesMaxWaitMs: number
  ) {
    super(bearerAuthCredentials, maxRetries, retriesWaitMs, retriesMaxWaitMs);

    const tokenEndpoint = new URL(bearerAuthCredentials.issuerEndpointUrl!);
    const clientConfig: ModuleOptions = {
      client: {
        id: bearerAuthCredentials.clientId!,
        secret: bearerAuthCredentials.clientSecret!,
      },
      auth: {
        tokenHost: tokenEndpoint.origin,
        tokenPath: tokenEndpoint.pathname
      },
      options: {
        credentialsEncodingMode: 'loose'
      }
    }

    this.tokenParams = { scope: bearerAuthCredentials.scope! };

    this.client = new ClientCredentials(clientConfig);
  }

  override async fetchToken(): Promise<string> {
      this.tokenObject = await this.client.getToken(this.tokenParams);
      return this.getAccessTokenString();
  }

  override tokenExpired(): boolean {
    return this.tokenObject === undefined || 
      this.tokenObject.expired(TOKEN_EXPIRATION_THRESHOLD_SECONDS);
  }

  private getAccessTokenString(): string {
    const accessToken = this.tokenObject?.token?.['access_token'];

    if (typeof accessToken !== 'string') {
      throw new Error('Access token is not available');
    }

    return accessToken;
  }
}

// internal/testing usage only
export {
  OAuthClient as _OAuthClient,
  OAuthClientBuilder as _OAuthClientBuilder,
}