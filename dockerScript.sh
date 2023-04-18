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
  FROM node:14

  WORKDIR /app

  COPY package*.json ./

  RUN npm install

  COPY . .

  EXPOSE 3001

  CMD ["npm", "start"]
EOL
else  
  echo "backend/Dockerfile already exists. Skipping step."
fi

if [ ! -f frontend/Dockerfile ]; then
  cat > frontend/Dockerfile <<EOL
  FROM node:14 as build

  WORKDIR /app

  COPY package*.json ./

  RUN npm install

  COPY . .

  RUN npm run build

  FROM nginx:1.19

  COPY --from=build /app/build /usr/share/nginx/html
EOL
else  
  echo "frontend/Dockerfile already exists. Skipping step."
fi

if [ ! -f backend/.env ]; then
  cat > backend/.env <<EOL
  MONGODB_URI=mongodb://root:rootpassword@mongodb:27017/miner_monitoring
EOL
else  
  echo "backend/.env already exists. Skipping step."
fi

echo "Step 4: Create docker-compose.yml file"
if [ -f docker-compose.yml ]; then
  cat > docker-compose.yml <<EOL
  version: '3.8'

  services:
    mongodb:
      image: mongo:4.4
      container_name: miner_monitoring_mongodb
      environment:
        MONGO_INITDB_ROOT_USERNAME: root
        MONGO_INITDB_ROOT_PASSWORD: rootpassword
      ports:
        - "27017:27017"
      volumes:
        - mongodb_data:/data/db

    backend:
      build: ./backend
      container_name: miner_monitoring_backend
      environment:
        NODE_ENV: production
      ports:
        - "3001:3001"
      depends_on:
        - mongodb

    frontend:
      build: ./frontend
      container_name: miner_monitoring_frontend
      ports:
        - "3000:80"

  volumes:
    mongodb_data:
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
