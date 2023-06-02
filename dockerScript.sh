#!/bin/bash
set -e

echo "Step 1: Install Docker in WSL2"
if ! command -v docker &> /dev/null; then
  sudo apt-get update
  sudo apt-get install -y apt-transport-https ca-certificates curl software-properties-common
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
  sudo apt-get update
  sudo apt-get install -y docker-ce docker-ce-cli containerd.io
  sudo usermod -aG docker $USER
else
  echo "Docker is already installed. Skipping step."
fi  

echo "Step 2: Install Docker Compose"
if ! command -v docker-compose &> /dev/null; then
  sudo curl -L "https://github.com/docker/compose/releases/download/1.29.2/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
  sudo chmod +x /usr/local/bin/docker-compose
else
  echo "Docker Compose is already installed. Skipping step."
fi 

echo "You may need to log out and log back in for the Docker group changes to take effect."
echo "Press Enter to continue..."
read

echo "Step 3: Create Dockerfiles and .env file"
mkdir -p backend frontend

if [ ! -f backend/Dockerfile ]; then
  cat > backend/Dockerfile <<EOL
  # Use the official Node.js 14 image as the base image
  FROM node:18

  # Install necessary dependencies for Puppeteer
  RUN apt-get update \
      && apt-get install -y wget gnupg \
      && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /usr/share/keyrings/googlechrome-linux-keyring.gpg \
      && sh -c 'echo "deb [arch=amd64 signed-by=/usr/share/keyrings/googlechrome-linux-keyring.gpg] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
      && apt-get update \
      && apt-get install -y google-chrome-stable fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-khmeros fonts-kacst fonts-freefont-ttf libxss1 \
        --no-install-recommends \
      && rm -rf /var/lib/apt/lists/* \
      && groupadd -r pptruser && useradd -rm -g pptruser -G audio,video pptruser

  RUN mkdir -p /app/screenshots && chown pptruser:pptruser /app/screenshots
  RUN mkdir -p /app/charts && chown pptruser:pptruser /app/charts

  USER pptruser

  WORKDIR /home/pptruser

  # Copy package.json and package-lock.json files into the container
  COPY --chown=pptruser:pptruser package*.json ./

  # Install dependencies
  RUN npm install

  # Copy the application code into the container
  COPY --chown=pptruser:pptruser . .

  # Expose the application port
  EXPOSE 3001

  # Use PM2 to run the application
  CMD ["npx", "pm2-runtime", "ecosystem.config.js"]

EOL
else  
  echo "backend/Dockerfile already exists. Skipping step."
fi

if [ ! -f frontend/Dockerfile ]; then
  cat > frontend/Dockerfile <<EOL
  FROM node:18 as build

  WORKDIR /app

  COPY package*.json ./

  RUN npm install

  COPY . .

  RUN npm run build

  FROM nginx:1.19

  COPY --from=build /app/build /usr/share/nginx/html
  COPY nginx.conf /etc/nginx/conf.d/default.conf


EOL
else  
  echo "frontend/Dockerfile already exists. Skipping step."
fi

if [ ! -f backend/.env ]; then
  cat > backend/.env <<EOL
  MONGODB_URI=mongodb://root:rootpassword@mongodb:27017/miner_monitoring?authSource=admin
  MONGODB_DEV_URI=mongodb://root:rootpassword@localhost:27037/miner_monitoring?authSource=admin
  F2POOL_API_KEY=yourapikeyhere
  SCREENSHOT_PATH=/app/screenshots
  CHARTS_PATH=/app/charts
  MINING_USER_NAME_1=mining_user_name_1
  MINING_USER_NAME_2=mining_user_name_2
EOL
else  
  echo "backend/.env already exists. Skipping step."
fi

echo "Step 4: Create docker-compose.yml file"
if [ -f docker-compose.yml ]; then
  cat > docker-compose.yml <<EOL
  version: '3.8'

  services:
    es01:
      image: docker.elastic.co/elasticsearch/elasticsearch:${STACK_VERSION}
      environment:
        - "discovery.type=single-node"
        - "ES_JAVA_OPTS=-Xms512m -Xmx512m"
        - ELASTIC_PASSWORD=${ELASTIC_PASSWORD}
        - KIBANA_PASSWORD=${KIBANA_PASSWORD}
        - bootstrap.memory_lock=true
        - xpack.security.enabled=true
        - xpack.security.http.ssl.enabled=true
        - xpack.security.http.ssl.key=certs/es01/es01.key
        - xpack.security.http.ssl.certificate=certs/es01/es01.crt
        - xpack.security.http.ssl.certificate_authorities=certs/ca/ca.crt
        - xpack.security.transport.ssl.enabled=true
        - xpack.security.transport.ssl.key=certs/es01/es01.key
        - xpack.security.transport.ssl.certificate=certs/es01/es01.crt
        - xpack.security.transport.ssl.certificate_authorities=certs/ca/ca.crt
        - xpack.security.transport.ssl.verification_mode=certificate
        - xpack.license.self_generated.type=${LICENSE}
      ports:
        - ${ES_PORT}:9200
      volumes:
        - certs:/usr/share/elasticsearch/config/certs
        - es01_data:/usr/share/elasticsearch/data
      healthcheck:
        test:
          [
            "CMD-SHELL",
            "curl -s --cacert config/certs/ca/ca.crt https://localhost:9200 | grep -q 'missing authentication credentials'",
          ]
        interval: 10s
        timeout: 10s
        retries: 120

    kibana:
      image: docker.elastic.co/kibana/kibana:${STACK_VERSION}
      ports:
        - ${KIBANA_PORT}:5601
      environment:
        - ELASTICSEARCH_HOSTS=https://es01:9200
        - SERVERNAME=kibana
        - ELASTICSEARCH_USERNAME=kibana_system
        - ELASTICSEARCH_PASSWORD=${KIBANA_PASSWORD}
        - ELASTICSEARCH_SSL_CERTIFICATEAUTHORITIES=config/certs/ca/ca.crt
      depends_on:
        es01:
          condition: service_healthy
      volumes:
        - certs:/usr/share/kibana/config/certs
        - kibana_data:/usr/share/kibana/data
      healthcheck:
        test:
          [
            "CMD-SHELL",
            "curl -s -I http://localhost:5601 | grep -q 'HTTP/1.1 302 Found'",
          ]
        interval: 10s
        timeout: 10s
        retries: 120

    fluentd:
      build: ./fluentd
      ports:
        - "24224:24224"
        - "24224:24224/udp"
      environment:
        - ELASTIC_PASSWORD=${ELASTIC_PASSWORD}
      depends_on:
        - es01
      volumes:
        - ./fluentd:/fluentd/etc
        - logs_data:/fluentd/log

    mongodb:
      image: mongo:4.4
      depends_on:
        - fluentd
      environment:
        MONGO_INITDB_ROOT_USERNAME: root
        MONGO_INITDB_ROOT_PASSWORD: rootpassword
      ports:
        - "27037:27017"
      volumes:
        - mongodb_data:/data/db
      logging:
        driver: "fluentd"
        options:
          fluentd-address: 127.0.0.1:24224
          tag: "mongodb"

    backend:
      build: ./backend
      environment:
        NODE_ENV: production
      ports:
        - "3011:3001"
      depends_on:
        - mongodb
        - fluentd
      volumes:
        - screenshots:/app/screenshots
        - charts:/app/charts
      logging:
        driver: "fluentd"
        options:
          fluentd-address: 127.0.0.1:24224        
          tag: "backend"

    frontend:
      build: ./frontend
      ports:
        - "3010:80"
      depends_on:
        - fluentd
      logging:
        driver: "fluentd"
        options:
          fluentd-address: 127.0.0.1:24224        
          tag: "frontend"


  volumes:
    mongodb_data:
    screenshots:
    charts:
    logs_data:
    es01_data: 
    certs:
    kibana_data:

EOL
else  
  echo "docker-compose.yml already exists. Skipping step."
fi

echo "Step 5: Build and run the application"
docker-compose up -d

echo "Application is now running with Docker containers. To access the frontend, open your browser and navigate to http://localhost:3000"


# As an alternative to steps 3 - 5, you can also use the following command to download the files from GitHub and run the application:
# echo "Step 3: Clone the f2pool Miner Monitoring repository"
# if [ ! -d "f2pool-miner-monitoring" ]; then
#   git clone https://github.com/jsweet-dev/BTCMiningMonitor.git
# else
#   echo "f2pool-miner-monitoring repository already cloned. Skipping step."
# fi

# echo "Step 4: Navigate to the f2pool-miner-monitoring directory and start the application"
# cd f2pool-miner-monitoring
# docker-compose up -d
