const pool = require("../config/db");
const {
  OPEN_STATUS,
  CLOSED_STATUS,
  createInitialState,
  replayEvents,
  normalizeAmount,
} = require("../aggregates/accountAggregate");
const eventStore = require("./eventStore");
const snapshotService = require("./snapshotService");
const projector = require("./projector");
const { getPagination } = require("../utils/pagination");

function createError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeSummary(row) {
  if (!row) {
    return null;
  }

  return {
    accountId: row.account_id,
    ownerName: row.owner_name,
    balance: Number(row.balance),
    currency: row.currency,
    status: row.status,
    version: Number(row.version),
  };
}

async function loadAccountState(accountId, client = pool) {
  const snapshot = await snapshotService.getSnapshot(accountId, client);
  const baseState = snapshot
    ? {
        ...createInitialState(accountId),
        ...snapshot.snapshot_data,
        version: Number(snapshot.last_event_number),
      }
    : createInitialState(accountId);

  const events = await eventStore.getEventsByAggregateId(
    accountId,
    {
      afterEventNumber: snapshot
        ? Number(snapshot.last_event_number)
        : undefined,
    },
    client,
  );

  const state = replayEvents(events, baseState);
  return {
    state,
    snapshot,
    events,
  };
}

async function persistEventAndProject({
  aggregateId,
  eventType,
  eventData,
  client,
}) {
  const event = await eventStore.appendEvent({
    aggregateId,
    aggregateType: "BankAccount",
    eventType,
    eventData,
    client,
  });

  await projector.projectEvent(event, client);
  return event;
}

async function saveSnapshotIfNeeded(accountId, state, client) {
  if (!snapshotService.shouldCreateSnapshot(state.version)) {
    return null;
  }

  return snapshotService.saveSnapshot({
    aggregateId: accountId,
    snapshotData: {
      accountId: state.accountId,
      ownerName: state.ownerName,
      balance: state.balance,
      currency: state.currency,
      status: state.status,
      lastUpdatedAt: state.lastUpdatedAt,
    },
    lastEventNumber: state.version,
    client,
  });
}

async function createAccount({
  accountId,
  ownerName,
  currency = "USD",
  initialBalance = 0,
}) {
  if (!accountId || !ownerName) {
    throw createError(400, "accountId and ownerName are required");
  }

  const startingBalance = normalizeAmount(initialBalance);
  if (startingBalance < 0) {
    throw createError(400, "initialBalance cannot be negative");
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const existingEvents = await eventStore.getEventsByAggregateId(
      accountId,
      {},
      client,
    );
    if (existingEvents.length > 0) {
      throw createError(409, `Account ${accountId} already exists`);
    }

    const event = await persistEventAndProject({
      aggregateId: accountId,
      eventType: "AccountCreated",
      eventData: {
        ownerName,
        currency,
        initialBalance: startingBalance,
      },
      client,
    });

    await client.query("COMMIT");

    return {
      message: "Account created",
      eventId: event.event_id,
      accountId,
      status: OPEN_STATUS,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function deposit(
  accountId,
  { amount, description = null, transactionId },
) {
  return applyMonetaryCommand(accountId, {
    amount,
    description,
    transactionId,
    eventType: "MoneyDeposited",
    successMessage: "Deposit accepted",
  });
}

async function withdraw(
  accountId,
  { amount, description = null, transactionId },
) {
  return applyMonetaryCommand(accountId, {
    amount,
    description,
    transactionId,
    eventType: "MoneyWithdrawn",
    successMessage: "Withdrawal accepted",
  });
}

async function applyMonetaryCommand(
  accountId,
  { amount, description, transactionId, eventType, successMessage },
) {
  if (!transactionId || typeof transactionId !== "string") {
    throw createError(400, "transactionId is required");
  }

  const numericAmount = normalizeAmount(amount);
  if (!numericAmount || numericAmount <= 0) {
    throw createError(400, "amount must be greater than zero");
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const { state } = await loadAccountState(accountId, client);

    if (!state.status) {
      throw createError(404, `Account ${accountId} not found`);
    }

    if (state.status === CLOSED_STATUS) {
      throw createError(409, `Account ${accountId} is closed`);
    }

    const duplicateTransaction = await eventStore.hasTransactionForAccount(
      accountId,
      transactionId,
      client,
    );
    if (duplicateTransaction) {
      await client.query("COMMIT");
      return {
        message: "Duplicate transaction ignored",
        accountId,
        transactionId,
        balance: state.balance,
        version: state.version,
      };
    }

    if (eventType === "MoneyWithdrawn" && state.balance < numericAmount) {
      throw createError(409, "Insufficient funds");
    }

    const event = await persistEventAndProject({
      aggregateId: accountId,
      eventType,
      eventData: {
        amount: numericAmount,
        description,
        transactionId,
      },
      client,
    });

    const updatedState = replayEvents([event], state);
    await saveSnapshotIfNeeded(accountId, updatedState, client);
    await client.query("COMMIT");

    return {
      message: successMessage,
      eventId: event.event_id,
      accountId,
      balance: updatedState.balance,
      version: updatedState.version,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function closeAccount(accountId, { reason = null } = {}) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const { state } = await loadAccountState(accountId, client);

    if (!state.status) {
      throw createError(404, `Account ${accountId} not found`);
    }

    if (state.status === CLOSED_STATUS) {
      throw createError(409, `Account ${accountId} is already closed`);
    }

    if (normalizeAmount(state.balance) !== 0) {
      throw createError(409, "Account can only be closed when balance is zero");
    }

    const event = await persistEventAndProject({
      aggregateId: accountId,
      eventType: "AccountClosed",
      eventData: {
        reason,
      },
      client,
    });

    const updatedState = replayEvents([event], state);
    await saveSnapshotIfNeeded(accountId, updatedState, client);
    await client.query("COMMIT");

    return {
      message: "Account closed",
      eventId: event.event_id,
      accountId,
      status: updatedState.status,
      version: updatedState.version,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function getAccount(accountId) {
  const { rows } = await pool.query(
    `
			SELECT *
			FROM account_summaries
			WHERE account_id = $1
		`,
    [accountId],
  );

  const account = normalizeSummary(rows[0]);
  if (!account) {
    throw createError(404, `Account ${accountId} not found`);
  }

  return account;
}

async function getAccountEvents(accountId) {
  const events = await eventStore.getEventsByAggregateId(accountId);
  if (events.length === 0) {
    throw createError(404, `Account ${accountId} not found`);
  }

  return events.map((event) => ({
    eventId: event.event_id,
    eventType: event.event_type,
    eventNumber: event.event_number,
    timestamp: event.timestamp,
    data: event.event_data,
  }));
}

async function getBalanceAt(accountId, timestamp) {
  const requestedTimestamp = new Date(timestamp);
  if (Number.isNaN(requestedTimestamp.getTime())) {
    throw createError(400, "timestamp must be a valid ISO-8601 date value");
  }

  const events = await eventStore.getEventsByAggregateId(accountId, {
    atOrBeforeTimestamp: requestedTimestamp.toISOString(),
  });

  if (events.length === 0) {
    throw createError(
      404,
      `No events found for account ${accountId} at the requested timestamp`,
    );
  }

  const state = replayEvents(events, createInitialState(accountId));
  return {
    accountId,
    balanceAt: state.balance,
    timestamp: requestedTimestamp.toISOString(),
  };
}

async function getTransactions(accountId, query) {
  const page = Number(query.page || 1);
  const pageSize = Number(query.pageSize || 10);

  const account = await getAccount(accountId);

  const totalCountResult = await pool.query(
    `
			SELECT COUNT(*) AS count
			FROM transaction_history
			WHERE account_id = $1
		`,
    [accountId],
  );

  const totalCount = Number(totalCountResult.rows[0].count);
  const pagination = getPagination(page, pageSize, totalCount);

  const result = await pool.query(
    `
			SELECT *
			FROM transaction_history
			WHERE account_id = $1
			ORDER BY timestamp DESC
			LIMIT $2 OFFSET $3
		`,
    [accountId, pagination.pageSize, pagination.offset],
  );

  return {
    accountId: account.accountId,
    currentPage: pagination.currentPage,
    pageSize: pagination.pageSize,
    totalPages: pagination.totalPages,
    totalCount,
    items: result.rows.map((row) => ({
      transactionId: row.transaction_id,
      accountId: row.account_id,
      type: row.type,
      amount: Number(row.amount),
      description: row.description,
      timestamp: row.timestamp,
    })),
  };
}

module.exports = {
  createAccount,
  deposit,
  withdraw,
  closeAccount,
  getAccount,
  getAccountEvents,
  getBalanceAt,
  getTransactions,
};
