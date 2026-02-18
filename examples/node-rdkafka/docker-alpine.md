# Dockerfile for confluent-kafka-javascript

A sample Dockerfile to run the `confluent-kafka-javascript` library using Node.js:

```dockerfile
# The official (Debian-based) and Alpine-based Node.js images are both useable.
FROM node:24

# Create app directory
RUN mkdir -p /usr/local/app

# Move to the app directory
WORKDIR /usr/local/app

# Copy relevant files
COPY . .

# Install application dependencies, if node_modules is not already present.
RUN npm install

# Rebuild the @confluentinc/kafka-javascript package for this environment. See
# below for more details on why this is necessary, and if you can skip this step.
RUN rm -rf node_modules/@confluentinc/kafka-javascript
RUN npm install @confluentinc/kafka-javascript

# Start application
CMD ["node", "index.js"]
```

`confluent-kafka-javascript` contains platform specific binary code (to talk to the underlying C library).
Depending on the OS, platform, architecture, and the libc type (glibc or musl), a different binary is required.

The correct binary is downloaded from GitHub when installing the package for the first time, however, if you copy
the `node_modules` directory from a different environment (e.g., your local machine) into the Docker container, it may not work correctly due to platform differences.

If you can ensure that the `node_modules` directory is not copied into the Docker container, or that the platform
where the image is built is identical to the Docker container's platform, you can skip the reinstallation step.
