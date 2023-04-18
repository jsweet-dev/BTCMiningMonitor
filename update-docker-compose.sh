#!/bin/bash

# Get the latest release version from GitHub
latest_version=$(curl --silent "https://api.github.com/repos/docker/compose/releases/latest" | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/')

# Check if the latest version is already installed
current_version=$(docker-compose --version | awk '{print $3}' | sed 's/,//')
if [ "$latest_version" == "$current_version" ]; then
  echo "Docker Compose is already up to date (version $current_version)."
  exit 0
fi

# Download and install the latest version
echo "Upgrading Docker Compose from version $current_version to $latest_version..."
sudo curl -L "https://github.com/docker/compose/releases/download/$latest_version/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verify the upgrade
new_version=$(docker-compose --version | awk '{print $3}' | sed 's/,//')
if [ "$latest_version" == "$new_version" ]; then
  echo "Docker Compose has been upgraded to version $new_version."
else
  echo "Something went wrong. Docker Compose was not upgraded."
  exit 1
fi