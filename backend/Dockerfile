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
