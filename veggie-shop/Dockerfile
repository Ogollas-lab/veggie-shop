# Use official Node.js image
FROM node:18-slim

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install production dependencies
RUN npm install --only=production

# Copy application source code
COPY . .

# Expose the port Cloud Run expects (8080 by default, but we'll use env PORT)
EXPOSE 3000

# Start the application
CMD [ "node", "server.js" ]
