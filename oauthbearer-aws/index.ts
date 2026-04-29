// H4 — public barrel. The complete public surface of this package
// through H7. Path B exports (typed factories, AwsOAuthBearerConfig,
// AwsStsTokenProvider) are H8-gated and currently not pursued.
//
// CONSUMERS:
//   - @confluentinc/kafka-javascript core uses `awsAutoWire.createHandler`
//     via require() at client construction. The signature is FROZEN; see
//     test/contract.test.ts.
//   - The `AwsOAuthBearerToken` type is documented as the return shape of
//     `awsAutoWire.createHandler`'s returned function — exported so TS
//     consumers can type-annotate against it.

export type { AwsOAuthBearerToken } from './provider';
export * as awsAutoWire from './auto-wire';
