# Skill: Project Organization

This skill defines the mandatory structure for this project.

## Instructions
1. Always keep `backend` and `frontend` as the primary functional directories.
2. Put all Docker related files in the `docker/` folder.
3. Keep unit tests inside `backend/tests/unit/`.
4. AI-generated documentation goes to `docs/`.
5. Any script used for debugging, temporary testing, or log output must be placed in `debug/`.

## Directory Map
- `/backend` -> Logic & API
- `/frontend` -> UI
- `/docker` -> Containers
- `/backend/tests/unit` -> Unit tests
- `/docs` -> Knowledge & Specs
- `/debug` -> Maintenance & Temp files
