#!/bin/bash
set -e

# Define a function to check if the certs.zip file exists on the Docker volume
check_certs_exist() {
  docker run --rm \
    -v certs:/usr/share/elasticsearch/config/certs \
    --entrypoint="" \
    docker.elastic.co/elasticsearch/elasticsearch:${STACK_VERSION} \
    sh -c 'if [ -f /usr/share/elasticsearch/config/certs/certs.zip ]; then exit 0; else exit 1; fi'
}

# If certs.zip does not exist, run the setup commands
if ! check_certs_exist; then
  # Run the setup commands
  # Replace the following lines with the content of the 'command' section from your original 'setup' service
  # Make sure to use the environment variables from the .env file, like ${ELASTIC_PASSWORD} and ${KIBANA_PASSWORD}

  # Pull the Elasticsearch image
  docker pull docker.elastic.co/elasticsearch/elasticsearch:${STACK_VERSION}

  # Create a temporary container for setup
  docker run --name temp_setup \
  -v certs:/usr/share/elasticsearch/config/certs \
  --env ELASTIC_PASSWORD=${ELASTIC_PASSWORD} \
  --env KIBANA_PASSWORD=${KIBANA_PASSWORD} \
  --rm -it docker.elastic.co/elasticsearch/elasticsearch:${STACK_VERSION} \
  bash
  
  bash -c '
        if [ x${ELASTIC_PASSWORD} == x ]; then
          echo "Set the ELASTIC_PASSWORD environment variable in the .env file";
          exit 1;
        elif [ x${KIBANA_PASSWORD} == x ]; then
          echo "Set the KIBANA_PASSWORD environment variable in the .env file";
          exit 1;
        fi;
        if [ ! -f config/certs/ca.zip ]; then
          echo "Creating CA";
          bin/elasticsearch-certutil ca --silent --pem -out config/certs/ca.zip;
          unzip config/certs/ca.zip -d config/certs;
        fi;
        if [ ! -f config/certs/certs.zip ]; then
          echo "Creating certs";
          echo -ne \
          "instances:\n"\
          "  - name: es01\n"\
          "    dns:\n"\
          "      - es01\n"\
          "      - localhost\n"\
          "    ip:\n"\
          "      - 127.0.0.1\n"\
          "  - name: es02\n"\
          "    dns:\n"\
          "      - es02\n"\
          "      - localhost\n"\
          "    ip:\n"\
          "      - 127.0.0.1\n"\
          "  - name: es03\n"\
          "    dns:\n"\
          "      - es03\n"\
          "      - localhost\n"\
          "    ip:\n"\
          "      - 127.0.0.1\n"\
          > config/certs/instances.yml;
          bin/elasticsearch-certutil cert --silent --pem -out config/certs/certs.zip --in config/certs/instances.yml --ca-cert config/certs/ca/ca.crt --ca-key config/certs/ca/ca.key;
          unzip config/certs/certs.zip -d config/certs;
        fi;
        echo "Setting file permissions"
        chown -R root:root config/certs;
        find . -type d -exec chmod 750 \{\} \;;
        find . -type f -exec chmod 640 \{\} \;;
        echo "Waiting for Elasticsearch availability";
        until curl -s --cacert config/certs/ca/ca.crt https://es01:9200 | grep -q "missing authentication credentials"; do sleep 30; done;
        echo "Setting kibana_system password";
        until curl -s -X POST --cacert config/certs/ca/ca.crt -u "elastic:${ELASTIC_PASSWORD}" -H "Content-Type: application/json" https://es01:9200/_security/user/kibana_system/_password -d "{\"password\":\"${KIBANA_PASSWORD}\"}" | grep -q "^{}"; do sleep 10; done;
        echo "All done!";
      '
# Stop and remove the temporary container
docker stop temp_setup
docker rm temp_setup

fi