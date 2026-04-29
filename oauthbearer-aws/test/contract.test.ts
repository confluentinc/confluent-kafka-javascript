/**
 * Frozen-signature guard for the cross-package contract.
 *
 * `@confluentinc/kafka-javascript` core depends on these assertions holding
 * for every published version of this package. Failing any test here is a
 * BREAKING CHANGE and requires a major version bump on the optional pkg.
 *
 * Imports go through `../index` (the published barrel), not `../auto-wire`
 * (the implementation), to ensure changes to the barrel can't silently break
 * the contract while the implementation file still tests fine in isolation.
 */

import * as pkg from '../index';

describe('cross-package contract — awsAutoWire (FROZEN; bumping = major version)', () => {
  it('exports the awsAutoWire namespace from the package barrel', () => {
    expect(pkg.awsAutoWire).toBeDefined();
    expect(typeof pkg.awsAutoWire).toBe('object');
  });

  it('awsAutoWire.createHandler is a function', () => {
    expect(typeof pkg.awsAutoWire.createHandler).toBe('function');
  });

  it('awsAutoWire.createHandler accepts exactly one parameter', () => {
    // Frozen at 1 (kafkaConfig). Adding a parameter is a breaking change.
    expect(pkg.awsAutoWire.createHandler.length).toBe(1);
  });

  it('createHandler returns a function (the per-call refresh handler)', () => {
    const handler = pkg.awsAutoWire.createHandler({
      'sasl.oauthbearer.config':
        'region=us-east-1 audience=https://x',
    });
    expect(typeof handler).toBe('function');
  });

  it('the returned function accepts exactly one parameter', () => {
    // Frozen at 1 (oauthbearerConfig string passed by librdkafka per call).
    const handler = pkg.awsAutoWire.createHandler({
      'sasl.oauthbearer.config':
        'region=us-east-1 audience=https://x',
    });
    expect(handler.length).toBe(1);
  });
});
