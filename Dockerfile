FROM node:20-alpine

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./

# Only install production dependencies
RUN npm install --production

# Bundle app source
COPY . .

# Cloud Run uses the PORT environment variable
ENV PORT=8080
EXPOSE 8080

# Start command
CMD ["npm", "start"]
