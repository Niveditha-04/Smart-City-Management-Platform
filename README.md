Monitor and optimize city operations (traffic, air, waste, power) with dashboards, analytics, alerts, and RBAC.

## Stack
- Frontend: React
- Backend: Node/Express + JWT
- DB: PostgreSQL
- Infra: Docker Compose

## Local (Docker)
```bash
docker compose up --build -d
# API: http://localhost:5050  (health: `/`)
# App: npm start in frontend (or your usual dev cmd)

