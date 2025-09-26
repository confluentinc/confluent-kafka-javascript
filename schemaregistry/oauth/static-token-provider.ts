import { BearerAuthCredentials } from '../rest-service';
import {
  _AbstractBearerTokenProviderBuilder as AbstractBearerTokenProviderBuilder,
  _AbstractOauthTokenProvider as AbstractOauthTokenProvider,
} from './abstract-oauth-client';
import {
  _BearerTokenProvider as BearerTokenProvider
} from './bearer-token-provider';


class StaticTokenProviderBuilder extends AbstractBearerTokenProviderBuilder {

  constructor(
      bearerAuthCredentials: BearerAuthCredentials) {
      super(bearerAuthCredentials);
  }

  protected override validate() {
      super.validate();
      if (!this.bearerAuthCredentials.token) {
        throw new Error('Bearer token not provided');
      }
  }

  override build() : BearerTokenProvider {
    this.validate();
    return new StaticTokenProvider(this.bearerAuthCredentials);
  }
}

class StaticTokenProvider extends AbstractOauthTokenProvider {

  private token: string; 

  constructor(bearerAuthCredentials: BearerAuthCredentials) {
    super(bearerAuthCredentials);
    this.token = bearerAuthCredentials.token!;
  }

  getAccessToken(): Promise<string> {
      return Promise.resolve(this.token);
  }

  tokenExpired(): boolean {
    return false;
  }
}

// internal/testing usage only
export {
  StaticTokenProviderBuilder as _StaticTokenProviderBuilder
}
