#!/bin/bash
#
# Build the s390x (IBM Z) release artifact.
#
# Semaphore has no native s390x agent, so this runs on a regular amd64 agent and
# offloads the build over SSH to a dedicated IBM Z host, the same approach librdkafka
# uses (confluentinc/librdkafka packaging/tools/build-release-artifacts-s390x.sh).
#
# Two modes:
#
#   (default)      Driver. Reads the host and credentials from Vault, copies this
#                  script to the host, runs the build there, and copies the resulting
#                  tarball back so the calling job can `artifact push` it.
#
#   --build-here   Does the actual build in the current directory. Runs on any s390x
#                  machine. When native s390x agents become available, point the block
#                  at one and call this directly — nothing else needs to change.
#
# Required by the driver: NODE_VERSION, S390X_USER, LOCAL_KEY.

set -e

MODE="$1"

if [ "$MODE" != "--build-here" ]; then
    #
    # Driver mode — on the amd64 agent.
    #
    for var in NODE_VERSION S390X_USER LOCAL_KEY; do
        if [ -z "${!var}" ]; then
            echo "$var not defined"
            exit 1
        fi
    done

    SSH_KEY_PATH="v1/devel/kv/cp-env/s390x-key/IBM-Cloud-S390x-key"
    S390X_HOST=$(vault kv get -field=ip $SSH_KEY_PATH)
    SSH_USER_AT_HOST="$S390X_USER@$S390X_HOST"
    SSH_COMMAND="ssh -o ServerAliveInterval=60 -i ./$LOCAL_KEY $SSH_USER_AT_HOST"
    SCP_COMMAND="scp -i ./$LOCAL_KEY"

    vault kv get -field=private_key $SSH_KEY_PATH > ./$LOCAL_KEY
    chmod go-rwx ./$LOCAL_KEY
    echo "SSH key saved to $LOCAL_KEY"

    if [ -z "$(ssh-keygen -F $S390X_HOST)" ]; then
        vault kv get -field=known_host $SSH_KEY_PATH >> ~/.ssh/known_hosts
        echo "Added $S390X_HOST to the list of known hosts"
    fi

    # Identify the commit by SHA rather than by ref name: on a pull request Semaphore
    # sets SEMAPHORE_GIT_BRANCH to the base branch, so resolving by name would build
    # the wrong thing.
    CURRENT_TARGET=$(git rev-parse HEAD)

    DIR=$(eval $SSH_COMMAND mktemp -d --suffix=ckjs)
    echo "Building $CURRENT_TARGET for node $NODE_VERSION on $S390X_HOST in $DIR"

    # Only this script needs copying to bootstrap; the build script comes from the
    # clone, so it always matches the commit under test.
    #
    # Note we deliberately do not forward the agent's ~/.npmrc. package-lock.json
    # resolves everything from registry.npmjs.org, so no registry credentials are
    # needed. The agent's CodeArtifact token is scoped to the job's OIDC identity
    # anyway and is rejected when presented from another host.
    eval $SCP_COMMAND .semaphore/build-s390x.sh $SSH_USER_AT_HOST:$DIR/

    set +e
    eval $SSH_COMMAND "NODE_VERSION=$NODE_VERSION $DIR/build-s390x.sh --build-here $CURRENT_TARGET $DIR"
    RET=$?
    set -e

    if [ $RET -eq 0 ]; then
        mkdir -p "build/stage/${SEMAPHORE_GIT_TAG_NAME}"
        eval $SCP_COMMAND "$SSH_USER_AT_HOST:$DIR/confluent-kafka-javascript/build/stage/${SEMAPHORE_GIT_TAG_NAME}/*.tar.gz" \
            "build/stage/${SEMAPHORE_GIT_TAG_NAME}/"
        RET=$?
        echo "Copied artifact to the agent"
    fi

    if [[ "$DIR" =~ ^/tmp/.*$ ]]; then
        eval $SSH_COMMAND rm -rf $DIR || echo "Failed to remove remote work directory $DIR"
    fi

    exit $RET
fi

#
# Build mode — on the s390x host.
#
CURRENT_TARGET=$2
DIR=$3
cd "$DIR"

# Shared machines: only ever remove work directories this script created, and only
# once they are stale.
find /tmp -maxdepth 1 -name "tmp.*ckjs" -mtime +1 -exec rm -rf {} + 2>/dev/null || true

export DEBIAN_FRONTEND=noninteractive
sudo apt-get update
sudo apt-get install -y git ca-certificates curl gnupg

if ! command -v docker >/dev/null 2>&1; then
    echo "Installing docker"
    sudo install -m 0755 -d /etc/apt/keyrings
    sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
    sudo chmod a+r /etc/apt/keyrings/docker.asc

    sudo tee /etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}")
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF

    sudo apt-get update
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    sudo systemctl start docker || true
    sudo usermod -aG docker $USER
fi

# The build must not run under a path containing '@'. GNU ar's MRI mode treats it as a
# response-file sigil and truncates the ADDLIB path in librdkafka's final static-lib
# step. mktemp gives us a clean path here; the same is not true of a customer's
# node_modules/@confluentinc install.
echo "Fetching confluent-kafka-javascript at $CURRENT_TARGET"
git init -q confluent-kafka-javascript
cd confluent-kafka-javascript
git remote add origin https://github.com/confluentinc/confluent-kafka-javascript.git
git fetch -q --depth 1 origin "$CURRENT_TARGET"
git checkout -q FETCH_HEAD
git submodule update --init --recursive
echo "Building $(git log --oneline -1)"

# No --platform flag: the host is natively s390x. -u 0 because the container writes
# build output into the bind mount.
# newgrp starts a new shell, so the docker exit code has to be carried out of the
# heredoc explicitly rather than read from $? afterwards.
set +e
newgrp docker <<EOF
docker run --rm -u 0 \
    -e NODE_VERSION="$NODE_VERSION" \
    -v "$PWD:/v" \
    -w /v ubuntu:20.04 \
    /v/.semaphore/build-docker-s390x.sh
exit \$?
EOF
RET=$?
set -e
echo "Build exited $RET"

# The container ran as root, so hand ownership back or the driver cannot clean up.
sudo chown -R "$(id -u):$(id -g)" "$DIR" || true

exit $RET
