# Skill: Security & API Standards

This skill defines the mandatory security protocols for all API developments and system integrations in this project.

## Mandatory Security Layers

1. **API Authentication (API-Key):**
   - Every single endpoint MUST be protected by an `X-API-Key` header or a similar mechanism.
   - Public endpoints (without keys) are strictly forbidden unless explicitly authorized for a specific reason.

2. **User Authentication (JWT):**
   - Implement a login system based on Email and Password.
   - Upon successful login, the system MUST generate a signed JWT (JSON Web Token).
   - JWTs should have a reasonable expiration time (e.g., 24h) and use a strong secret stored in `.env`.

3. **Rate Limiting:**
   - Implement rate limiting (e.g., using `slowapi` or custom middleware) to prevent Brute Force and DoS attacks.
   - Limits should be applied based on the API Key or IP address.

4. **Input Validation & Sanitization:**
   - Use Pydantic models for all Request Bodies and Query Parameters.
   - Never trust raw user input. Sanitize strings and validate types strictly.

5. **CORS (Cross-Origin Resource Sharing):**
   - Always restrict `CORS_ALLOWED_ORIGINS` to trusted domains in the `.env`. Never use `*` (asterisk) in production environments.

6. **Secrets Management:**
   - NEVER hardcode secrets, passwords, or keys in the source code.
   - All sensitive data MUST be fetched from environment variables (`os.getenv`).

7. **Data Masking in Logs:**
   - In logs or debug info, sensitive data (Passwords, CPFs, Emails) must be masked (e.g., `pass****`).

## Reference Implementation Patterns

### FastAPI API Key Dependency (Example)
```python
from fastapi import Security, HTTPException, status
from fastapi.security.api_key import APIKeyHeader

api_key_header = APIKeyHeader(name="X-API-Key", auto_error=True)

async def get_api_key(api_key: str = Security(api_key_header)):
    if api_key != os.getenv("AGENT_API_KEY"):
        raise HTTPException(status_code=403, detail="Invalid API Key")
    return api_key
```

### JWT Pattern
- Algorithm: HS256
- Payload: `{"sub": user_id, "exp": ...}`
