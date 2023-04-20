# Use the official Node.js 14 image as the base image
FROM node:14
RUN rm -rf /home/pptruser/screenshots

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

USER pptruser

WORKDIR /home/pptruser

RUN mkdir -p /home/pptruser/screenshots 
RUN chown -R pptruser:pptruser /home/pptruser/screenshots

# Copy package.json and package-lock.json files into the container
COPY package*.json ./

# Install dependencies
RUN npm install

# Create the .local-chromium directory
# RUN mkdir -p /app/node_modules/puppeteer/.local-chromium/

# Set up the sandbox file and directory
# RUN find /app/node_modules/puppeteer/.local-chromium -type f -name chrome_sandbox -print \
#     -exec chown root:root {} \; \
#     -exec chmod 4755 {} \; \
#     && mkdir -p /usr/local/sbin/ \
#     && cp -p $(find /app/node_modules/puppeteer/.local-chromium -type f -name chrome_sandbox) /usr/local/sbin/chrome-devel-sandbox \
#     && chown pptruser:pptruser /usr/local/sbin/chrome-devel-sandbox


# Copy the application code into the container
COPY --chown=pptruser:pptruser . .

# Expose the application port
EXPOSE 3001

# Use PM2 to run the application
CMD ["npx", "pm2-runtime", "ecosystem.config.js"]
