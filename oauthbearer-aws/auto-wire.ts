// H1 placeholder. H4 fills in:
//   - createHandler(kafkaConfig: Record<string, unknown>):
//       (oauthbearerConfig: string) => Promise<NodeRdKafkaOAuthToken>
//
//     The cross-package contract called by @confluentinc/kafka-javascript
//     core via require() + `pkg.awsAutoWire.createHandler(...)`. Frozen
//     signature — bumping requires a major version on the optional package.
export {};
