# Bank Account CQRS With Event Sourcing

This project implements a bank account management API using Event Sourcing and CQRS on Node.js and PostgreSQL.

## Stack

- Node.js + Express
- PostgreSQL 15
- Docker + Docker Compose

## Features

- Command APIs:
  - POST /api/accounts
  - POST /api/accounts/{accountId}/deposit
  - POST /api/accounts/{accountId}/withdraw
  - POST /api/accounts/{accountId}/close
- Query APIs:
  - GET /api/accounts/{accountId}
  - GET /api/accounts/{accountId}/events
  - GET /api/accounts/{accountId}/balance-at/{timestamp}
  - GET /api/accounts/{accountId}/transactions?page=1&pageSize=10
- Projection administration:
  - POST /api/projections/rebuild
  - GET /api/projections/status
- Snapshotting:
  - Automatically saves snapshots every 50 events per aggregate.

## Environment Variables

Use .env with the following values (see .env.example):

- API_PORT
- DATABASE_URL
- DB_USER
- DB_PASSWORD
- DB_NAME

## Run

1. Build and start services:
   - docker compose up --build -d
2. Check health:
   - http://localhost:8080/health
3. Run smoke test:
   - npm run smoke:test

## NPM Scripts

- npm run docker:up
- npm run docker:down
- npm run docker:reset
- npm run smoke:test

## Database Initialization

Schemas are created on startup from:

- seeds/schema.sql

## Submission Data

Automated evaluators use:

- submission.json
