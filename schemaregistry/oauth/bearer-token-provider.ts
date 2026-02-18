interface BearerTokenProvider {
  getAccessToken(): Promise<string>;
  getAdditionalHeaders(): Record<string, string>;
  tokenExpired(): boolean;
}

interface BearerTokenProviderBuilder {
  build(maxRetries: number, retriesWaitMs: number, retriesMaxWaitMs: number): BearerTokenProvider
}

// internal/testing usage only
export {
  BearerTokenProvider as _BearerTokenProvider,
  BearerTokenProviderBuilder as _BearerTokenProviderBuilder
}

