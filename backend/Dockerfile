# Use Node.js 18 LTS
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --legacy-peer-deps

# Copy all backend files
COPY . .

# Expose port
EXPOSE 3001

# Start server
CMD ["node", "server.js"]