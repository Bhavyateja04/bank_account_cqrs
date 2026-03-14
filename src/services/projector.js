const pool = require("../config/db");
const eventStore = require("./eventStore");

async function projectEvent(event, client = pool) {
  switch (event.event_type) {
    case "AccountCreated":
      await projectAccountCreated(event, client);
      break;
    case "MoneyDeposited":
    case "MoneyWithdrawn":
      await projectMoneyMovement(event, client);
      break;
    case "AccountClosed":
      await projectAccountClosed(event, client);
      break;
    default:
      break;
  }
}

async function projectAccountCreated(event, client) {
  const query = `
		INSERT INTO account_summaries (
			account_id,
			owner_name,
			balance,
			currency,
			status,
			version
		)
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (account_id)
		DO UPDATE SET
			owner_name = EXCLUDED.owner_name,
			balance = EXCLUDED.balance,
			currency = EXCLUDED.currency,
			status = EXCLUDED.status,
			version = EXCLUDED.version
	`;

  await client.query(query, [
    event.aggregate_id,
    event.event_data.ownerName,
    Number(event.event_data.initialBalance || 0),
    event.event_data.currency,
    "OPEN",
    event.event_number,
  ]);
}

async function projectMoneyMovement(event, client) {
  const delta =
    event.event_type === "MoneyDeposited"
      ? Number(event.event_data.amount)
      : -Number(event.event_data.amount);
  const transactionType =
    event.event_type === "MoneyDeposited" ? "DEPOSIT" : "WITHDRAW";

  await client.query(
    `
			UPDATE account_summaries
			SET balance = balance + $2,
					version = $3
			WHERE account_id = $1
		`,
    [event.aggregate_id, delta, event.event_number],
  );

  await client.query(
    `
			INSERT INTO transaction_history (
				transaction_id,
				account_id,
				type,
				amount,
				description,
				timestamp
			)
			VALUES ($1, $2, $3, $4, $5, $6)
			ON CONFLICT (transaction_id)
			DO UPDATE SET
				type = EXCLUDED.type,
				amount = EXCLUDED.amount,
				description = EXCLUDED.description,
				timestamp = EXCLUDED.timestamp
		`,
    [
      event.event_data.transactionId || event.event_id,
      event.aggregate_id,
      transactionType,
      Number(event.event_data.amount),
      event.event_data.description || null,
      event.timestamp,
    ],
  );
}

async function projectAccountClosed(event, client) {
  await client.query(
    `
			UPDATE account_summaries
			SET status = $2,
					version = $3
			WHERE account_id = $1
		`,
    [event.aggregate_id, "CLOSED", event.event_number],
  );
}

async function rebuildProjections() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query("TRUNCATE TABLE transaction_history, account_summaries");

    const events = await eventStore.getAllEvents(client);
    for (const event of events) {
      await projectEvent(event, client);
    }

    await client.query("COMMIT");
    return {
      rebuiltEvents: events.length,
      rebuiltAt: new Date().toISOString(),
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function getProjectionStatus() {
  const [eventCountResult] = await Promise.all([
    pool.query("SELECT COUNT(*) AS count FROM events"),
  ]);

  const totalEvents = Number(eventCountResult.rows[0].count);

  return {
    totalEventsInStore: totalEvents,
    projections: [
      {
        name: "AccountSummaries",
        lastProcessedEventNumberGlobal: totalEvents,
        lag: 0,
      },
      {
        name: "TransactionHistory",
        lastProcessedEventNumberGlobal: totalEvents,
        lag: 0,
      },
    ],
  };
}

module.exports = {
  projectEvent,
  rebuildProjections,
  getProjectionStatus,
};
