# Implementation Plan: Update S3 Keys and Docker Local

**Branch**: `007-update-s3-docker` | **Date**: 2026-04-10 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/007-update-s3-docker/spec.md`

## Summary

Standardize the Object Storage variables from `B2_` prefix to `S3_` prefix, completely remove the unused `STR_REDIS_URL`, and adjust `docker-compose-local.yml` to remove the default `postgres` service, allowing containers to connect to an external running Postgres via the `network_swarm_public` Docker bridge.

## Technical Context

**Language/Version**: Python 3.11  
**Primary Dependencies**: Docker, FastAPI, TaskIQ  
**Storage**: Backblaze B2 (acting via S3 API), PostgreSQL  
**Testing**: Configuration and manual spin-up  
**Target Platform**: Linux Server / Docker  
**Project Type**: Web Service Configuration  

## Constitution Check

*GATE: Passed. (No change to tech stack since Backblaze B2 remains, just variable rename).*

## Project Structure

### Documentation (this feature)

```text
specs/007-update-s3-docker/
├── plan.md              
├── research.md          
├── data-model.md        
├── quickstart.md        
```

### Source Code

```text
# Updating Configurations and Compose
backend/
├── src/
│   ├── core/
│   │   └── redis_bus.py (remove)
│   ├── services/
│   │   └── cloud_service.py (rename refs)
│   └── tkq/
│       └── tkq_config.py (remove)
infra/
└── docker-compose-local.yml (remove postgres, add network)
```
**Structure Decision**: The repository structure is maintained.

## Complexity Tracking

N/A
