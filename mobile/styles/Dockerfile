# Base image
FROM node:14

# Set the working directory
WORKDIR /app

# Copy package.json and install dependencies
COPY package.json yarn.lock ./
RUN yarn install

# Copy the rest of the application code
COPY . .

# Expose the port that React runs on
EXPOSE 3000

# Start the React development server
CMD ["yarn", "start"]
