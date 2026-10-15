# Bank Account Management API — CQRS & Event Sourcing

## 1. Project Overview

A bank account management REST API built using **Node.js, Express.js, and PostgreSQL**. The application follows **Command Query Responsibility Segregation (CQRS)** and **Event Sourcing** to manage account operations, maintain transaction history, and retrieve account balances at specific points in time.

## 2. Technology Stack

- **Backend:** Node.js, Express.js
- **Database:** PostgreSQL 15
- **Containerization:** Docker, Docker Compose

## 3. Core Features

### Account Command APIs
- `POST /api/accounts` — Create a new bank account.
- `POST /api/accounts/{accountId}/deposit` — Deposit money into an account.
- `POST /api/accounts/{accountId}/withdraw` — Withdraw money from an account.
- `POST /api/accounts/{accountId}/close` — Close a bank account.

### Account Query APIs
- `GET /api/accounts/{accountId}` — Retrieve account details and current balance.
- `GET /api/accounts/{accountId}/events` — Fetch the account's event history.
- `GET /api/accounts/{accountId}/balance-at/{timestamp}` — Retrieve the account balance at a specified time.
- `GET /api/accounts/{accountId}/transactions?page=1&pageSize=10` — Retrieve paginated transaction history.

### Projection Management
- `POST /api/projections/rebuild` — Rebuild read-model projections.
- `GET /api/projections/status` — Check projection processing status.

### Event Sourcing and Snapshots
- Account operations are recorded as events in the event store.
- Account state can be reconstructed by replaying recorded events.
- Snapshots are automatically saved after every 50 events per account aggregate to improve state reconstruction performance.

## 4. Environment Configuration

Create a `.env` file in the project root using the following variables. Refer to `.env.example` for the expected configuration.

- `API_PORT` — Backend server port.
- `DATABASE_URL` — PostgreSQL connection URL.
- `DB_USER` — Database username.
- `DB_PASSWORD` — Database password.
- `DB_NAME` — Database name.

## 5. Installation and Execution

### Step 1: Start the application

```bash
docker compose up --build -d
```

### Step 2: Verify application health

Open the following endpoint in your browser or API client:

```text
http://localhost:8080/health
```

### Step 3: Run the smoke test

```bash
npm run smoke:test
```

## 6. Available NPM Scripts

| Command | Description |
|---|---|
| `npm run docker:up` | Start the Docker services. |
| `npm run docker:down` | Stop the Docker services. |
| `npm run docker:reset` | Reset the Docker environment. |
| `npm run smoke:test` | Execute smoke tests against the application. |

## 7. Database Initialization

Database schemas are initialized automatically when the application starts. The SQL initialization script is located at:

```text
seeds/schema.sql
```

## 8. Submission Requirements

The project includes a `submission.json` file used by automated evaluators. Ensure that this file contains the required submission metadata and follows the expected format.
