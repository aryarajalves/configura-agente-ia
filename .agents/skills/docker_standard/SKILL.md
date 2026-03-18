# Skill: Docker Compose Standard Structure

This skill defines the mandatory structure for `docker-compose.yml` files in this project. Whenever the AI agent creates or modifies a docker-compose file, it must strictly follow these patterns.

## Pattern Requirements

1. **Version:** Always use `version: "3.7"`.
2. **Naming & Hostname:**
   - Use `hostname: "{{.Service.Name}}.{{.Task.Slot}}"` for Swarm compatibility.
3. **Environment Variables:**
   - Always fetch environment variables from the `.env` file.
   - If `.env` is updated, the `docker-compose.yml` environment section must be updated accordingly.
4. **Deploy Section:**
   - **Mode:** `replicated`, `replicas: 1`.
   - **Placement:** Specify `constraints` (e.g., `- node.role == manager`).
   - **Resources:** Always define `limits` for `cpus` and `memory`.
5. **Labels (Traefik):**
   - If the service needs external access (is an interface or API), include Traefik labels:
     - `traefik.enable=1`
     - `traefik.http.routers.[service_name].rule=Host([domain])`
     - `traefik.http.routers.[service_name].entrypoints=websecure`
     - `traefik.http.routers.[service_name].tls.certresolver=letsencryptresolver`
     - `traefik.http.services.[service_name].loadbalancer.server.port=[port]`
6. **Networks:**
   - Always use the external network `network_swarm_public` unless explicitly requested otherwise.
7. **Volumes:**
   - Use external volumes where persistent data is required.

## Reference Template

```yaml
version: "3.7"
services:
  [service_name]:
    image: [image_name]:[tag]
    hostname: "{{.Service.Name}}.{{.Task.Slot}}"
    entrypoint: [entrypoint_script]
    command: [command]
    volumes:
    - [volume_name]:[container_path]
    networks:
    - network_swarm_public
    environment:
    - ENV_VAR_1=${ENV_VAR_1}
    - ENV_VAR_2=${ENV_VAR_2}
    deploy:
      mode: replicated
      replicas: 1
      placement:
        constraints:
        - node.role == manager
      resources:
        limits:
          cpus: "1"
          memory: 2048M
      labels:
      - traefik.enable=1
      - traefik.http.routers.[service_name].rule=Host(`[domain]`)
      - traefik.http.routers.[service_name].entrypoints=websecure
      - traefik.http.routers.[service_name].priority=1
      - traefik.http.routers.[service_name].tls.certresolver=letsencryptresolver
      - traefik.http.routers.[service_name].service=[service_name]
      - traefik.http.services.[service_name].loadbalancer.server.port=[port]
      - traefik.http.services.[service_name].loadbalancer.passHostHeader=1

volumes:
  [volume_name]:
    external: true
    name: [volume_name]

networks:
  network_swarm_public:
    name: network_swarm_public
    external: true
```

## Example: Baserow

```yaml
version: "3.7"
services:
  baserow:
    image: baserow/baserow:1.31.1
    hostname: "{{.Service.Name}}.{{.Task.Slot}}"
    entrypoint: /baserow.sh
    command: start
    volumes:
    - baserow_data:/baserow/data
    networks:
    - network_swarm_public
    environment:
    - BASEROW_PUBLIC_URL=https://planilhasalesforce.agency10x.com.br
    - DATABASE_NAME=baserow
    - DATABASE_HOST=postgres
    - DATABASE_PORT=5432
    - DATABASE_USER=postgres
    - DATABASE_PASSWORD=WjdmtLJvVym7SC1djyt5uR
    - SECRET_KEY=727ff2d0094a40d08be33a6eda9e3751
    deploy:
      mode: replicated
      replicas: 1
      placement:
        constraints:
        - node.role == manager
      resources:
        limits:
          cpus: "1"
          memory: 4096M
      labels:
      - traefik.enable=1
      - traefik.http.routers.baserow.rule=Host(`planilhasalesforce.agency10x.com.br`)
      - traefik.http.routers.baserow.entrypoints=websecure
      - traefik.http.routers.baserow.priority=1
      - traefik.http.routers.baserow.tls.certresolver=letsencryptresolver
      - traefik.http.routers.baserow.service=baserow
      - traefik.http.services.baserow.loadbalancer.server.port=80
      - traefik.http.services.baserow.loadbalancer.passHostHeader=1
volumes:
  baserow_data:
    external: true
    name: baserow_data
networks:
  network_swarm_public:
    name: network_swarm_public
    external: true
```
