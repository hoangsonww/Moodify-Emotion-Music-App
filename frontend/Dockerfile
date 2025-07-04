FROM node:18-alpine AS build

# install dependencies
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci

# build the app
COPY frontend/ ./
RUN npm run build
RUN npm prune --production

# lightweight runtime to serve the build
FROM node:18-alpine
WORKDIR /app

# copy build from previous stage
COPY --from=build /app/build ./build

# install a simple static server
RUN npm install -g serve

EXPOSE 3000
CMD ["serve", "-s", "build", "-l", "3000"]
