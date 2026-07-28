import {Client, SchemaRegistryClient} from "../schemaregistry-client";
import {ClientConfig} from "../rest-service";
import {Serde} from "./serde";

/**
 * Constructs a serde for a Kafka client from either a Schema Registry client
 * the application created, or a client configuration to create one from.
 *
 * A client the application supplied is never closed by the serde. A client
 * created here is owned by the serde, closed together with it, and released
 * right away if the serde cannot be constructed or its initializer throws.
 *
 * @param clientConfig - configuration to create a Schema Registry client from
 * @param client - a Schema Registry client the application owns
 * @param construct - creates the serde from the resolved client
 * @param init - optional callback run on the constructed serde
 */
export function buildKafkaSerde<S extends Serde>(
  clientConfig: ClientConfig | null | undefined,
  client: Client | null | undefined,
  construct: (client: Client) => S,
  init?: ((serde: S) => void) | null
): S {
  if (client != null && clientConfig != null) {
    throw new Error('Cannot specify both a Schema Registry client and a client configuration; use one or the other')
  }

  let owned = false
  if (client == null) {
    if (clientConfig == null) {
      throw new Error('Schema Registry client configuration is required')
    }
    if (clientConfig.baseURLs == null || clientConfig.baseURLs.length === 0) {
      throw new Error('Schema Registry client baseURLs attribute is required')
    }
    client = new SchemaRegistryClient(clientConfig)
    owned = true
  }

  let serde: S
  try {
    serde = construct(client)
  } catch (err) {
    if (owned) {
      closeQuietly(client)
    }
    throw err
  }
  if (owned) {
    serde.ownSchemaRegistryClient()
  }

  if (init != null) {
    try {
      init(serde)
    } catch (err) {
      closeQuietly(serde)
      throw err
    }
  }
  return serde
}

/* The original error is the one that matters: a failure while releasing must not hide it. */
function closeQuietly(closeable: { close(): Promise<void> | void }): void {
  try {
    Promise.resolve(closeable.close()).catch(() => {})
  } catch {
    // ignore
  }
}
