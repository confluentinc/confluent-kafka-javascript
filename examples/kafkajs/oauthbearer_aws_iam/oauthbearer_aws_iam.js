// AWS IAM OAUTHBEARER authentication using the KafkaJS-compatible API.
//
// The new package `@confluentinc/kafka-javascript-oauthbearer-aws` is opt-in:
// a consumer that doesn't install it pulls zero AWS SDK into node_modules.
// Install both packages:
//
//   npm install @confluentinc/kafka-javascript \
//               @confluentinc/kafka-javascript-oauthbearer-aws
//
// Prerequisites on the caller's AWS account:
//   1. Account admin has run `aws iam enable-outbound-web-identity-federation`
//      once — this is what actually turns the new STS API on.
//   2. The caller's identity (EC2 role, ECS task role, EKS IRSA, Pod Identity,
//      SSO, or a profile resolved via the default credential chain) has
//      `sts:GetWebIdentityToken` permission.
//   3. Confluent Cloud OIDC trust is configured for the chosen `audience`.
//
// IMPORTANT: Do NOT set `sasl.oauthbearer.method` in this config. That
// selects the librdkafka-native path and bypasses `oauthBearerProvider`.

const { Kafka } = require('@confluentinc/kafka-javascript').KafkaJS;
const {
    awsOAuthBearerProvider,
} = require('@confluentinc/kafka-javascript-oauthbearer-aws');

async function run() {
    const kafka = new Kafka({});
    const producer = kafka.producer({
        kafkaJS: {
            brokers: [process.env.BOOTSTRAP || 'localhost:9092'],
            ssl: true,
            sasl: {
                mechanism: 'oauthbearer',
                oauthBearerProvider: awsOAuthBearerProvider({
                    region: process.env.AWS_REGION || 'eu-north-1',
                    audience: process.env.AUDIENCE || 'https://api.example.com',
                    // durationSeconds defaults to 300; raise (max 3600) for longer-lived tokens.
                    // stsEndpoint: 'https://sts-fips.us-east-1.amazonaws.com',  // FIPS/VPC override
                }),
            },
        },
    });

    await producer.connect();
    console.log('Producer connected');

    const report = await producer.send({
        topic: process.env.TOPIC || 'topic',
        messages: [{ value: 'Hello world!' }],
    });
    console.log('Producer sent message', report);

    await producer.disconnect();
}

run().catch((err) => {
    console.error(err);
    process.exit(1);
});
