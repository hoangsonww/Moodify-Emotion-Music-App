# NGINX Docker Setup

This directory contains all necessary files to set up an NGINX server using Docker for the **Moodify App**. It includes a `Dockerfile` to build an NGINX image, a `docker-compose.yml` file to orchestrate the Docker container setup, and a configuration file (`nginx.conf`) to define NGINX’s server behavior.

## Directory Structure

- **docker-compose.yml**: Defines services, networks, and volumes for the Docker setup. This file configures the NGINX service and can be used to start the container with `docker-compose`.
- **Dockerfile**: Contains the instructions to build a Docker image for NGINX, applying any specific configurations or customizations required.
- **nginx.conf**: The NGINX configuration file. This file is used to specify the server configuration, such as listening ports, server names, proxy settings, and location rules.
- **start_nginx.sh**: A shell script to start the NGINX server. This script can be used as an entry point or utility to start the service within the container or on the host system.

## Prerequisites

- **Docker**: Make sure Docker is installed on your machine. [Get Docker here](https://www.docker.com/get-started).
- **Docker Compose**: This setup requires Docker Compose. Install it if you haven’t done so already. [Get Docker Compose here](https://docs.docker.com/compose/install/).

## Setup and Usage

1. **Build the Docker Image** (optional, if `docker-compose` is configured to build automatically):

   ```bash
   docker build -t custom-nginx .
   ```

2. **Run the NGINX Server** using Docker Compose:

   ```bash
   docker-compose up -d
   ```

   This command will start the NGINX server in detached mode. The `docker-compose.yml` file will handle the setup, including any volume mappings, port configurations, and network settings.

3. **Access the NGINX Server**:

- By default, NGINX should be accessible at `http://localhost:80` (or the port specified in `nginx.conf`).
- Adjust `nginx.conf` if you need custom settings for server name, proxying, or different ports.

4. **Stop the NGINX Server**:
   ```bash
   docker-compose down
   ```
   This command will stop and remove the NGINX container(s).

## Configuration

- **nginx.conf**: Modify this file to customize NGINX behavior. Some common changes include:

  - Updating the listening port.
  - Adding server names or aliases.
  - Configuring reverse proxy settings.

- **start_nginx.sh**: This script can be used to start the NGINX server if it’s not started by Docker Compose automatically or if you’re running NGINX on a host machine.

## Troubleshooting

- **View Logs**: To see logs for the NGINX container, use:

  ```bash
  docker-compose logs -f
  ```

- **Rebuild the Image**: If you change the `Dockerfile`, rebuild the image with:
  ```bash
  docker-compose up -d --build
  ```

## Additional Information

- **Ports**: Make sure the ports defined in `docker-compose.yml` or `nginx.conf` do not conflict with other services on your host machine.
- **Volumes**: Ensure any volumes mounted for `nginx.conf` or other assets are correctly specified in `docker-compose.yml`.

---

For more information about the project, refer to the main [README.md](../README.md) file. Thanks for checking out this NGINX Docker setup!
