// AWS IAM OAUTHBEARER authentication using the node-rdkafka API.
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
// selects the librdkafka-native path and bypasses `oauthbearer_token_refresh_cb`.

const Kafka = require('@confluentinc/kafka-javascript');
const {
    awsOAuthBearerTokenRefreshCb,
} = require('@confluentinc/kafka-javascript-oauthbearer-aws');

function run() {
    const producer = new Kafka.Producer({
        'metadata.broker.list': process.env.BOOTSTRAP || 'localhost:9092',
        'dr_cb': true,

        'security.protocol': 'SASL_SSL',
        'sasl.mechanisms': 'OAUTHBEARER',
        'oauthbearer_token_refresh_cb': awsOAuthBearerTokenRefreshCb({
            region: process.env.AWS_REGION || 'eu-north-1',
            audience: process.env.AUDIENCE || 'https://api.example.com',
            // durationSeconds defaults to 300; raise (max 3600) for longer-lived tokens.
            // stsEndpoint: 'https://sts-fips.us-east-1.amazonaws.com',  // FIPS/VPC override
        }),
    });

    producer.connect();

    producer.on('event.log', (event) => {
        console.log(event);
    });

    producer.on('ready', () => {
        console.log('Producer is ready!');
        producer.setPollInterval(1000);
        producer.produce(
            process.env.TOPIC || 'topic',
            null,
            Buffer.from('messageValue'),
            'messageKey',
        );
    });

    producer.on('error', (err) => {
        console.error('Encountered error in producer:', err.message);
    });

    producer.on('delivery-report', (err, report) => {
        console.log('delivery-report:', JSON.stringify(report));
        producer.disconnect();
    });
}

run();
