FROM node:20-slim

# Install Google Chrome Stable and fonts
# This ensures all underlying Linux dependencies (libnss3, libasound2, etc) are installed so Puppeteer can boot headless chrome
RUN apt-get update \
    && apt-get install -y wget gnupg \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /usr/share/keyrings/googlechrome-linux-keyring.gpg \
    && sh -c 'echo "deb [arch=amd64 signed-by=/usr/share/keyrings/googlechrome-linux-keyring.gpg] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 \
      --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy root package.json for install:all and build scripts
COPY package.json ./

# Copy package files for caching
COPY frontend/package.json ./frontend/
COPY backend/package.json ./backend/

# Install dependencies for both frontend and backend
RUN npm run install:all

# Copy all source files
COPY . .

# Build the frontend Vite app
RUN npm run build

# Switch working directory to backend to run the server
WORKDIR /app/backend

# Expose the API port
EXPOSE 3001

# Start the Express server
CMD ["npm", "start"]
