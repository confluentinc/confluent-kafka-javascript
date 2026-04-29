// H1 placeholder. H3 fills in:
//   - AwsOAuthBearerConfig (interface)
//   - AwsOAuthBearerToken / NodeRdKafkaOAuthToken (interfaces)
//   - validateConfig / applyDefaults (helpers)
//   - AwsStsTokenProvider (class wrapping STSClient + GetWebIdentityTokenCommand)
// H8 (deferred / gated) appends:
//   - awsOAuthBearerProvider / awsOAuthBearerTokenRefreshCb (typed factories — Path B)
export {};
