const { v4: uuidv4 } = require("uuid");

const pool = require("../config/db");

async function appendEvent({
  aggregateId,
  aggregateType,
  eventType,
  eventData,
  client = pool,
}) {
  const nextEventNumber = await getNextEventNumber(aggregateId, client);

  const query = `
		INSERT INTO events (
			event_id,
			aggregate_id,
			aggregate_type,
			event_type,
			event_data,
			event_number
		)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING *
	`;

  const values = [
    uuidv4(),
    aggregateId,
    aggregateType,
    eventType,
    eventData,
    nextEventNumber,
  ];

  const { rows } = await client.query(query, values);
  return rows[0];
}

async function getNextEventNumber(aggregateId, client = pool) {
  const query = `
		SELECT COALESCE(MAX(event_number), 0) + 1 AS next_event_number
		FROM events
		WHERE aggregate_id = $1
	`;
  const { rows } = await client.query(query, [aggregateId]);
  return Number(rows[0].next_event_number);
}

async function getEventsByAggregateId(
  aggregateId,
  options = {},
  client = pool,
) {
  const conditions = ["aggregate_id = $1"];
  const values = [aggregateId];
  let nextIndex = values.length + 1;

  if (options.afterEventNumber) {
    conditions.push(`event_number > $${nextIndex}`);
    values.push(options.afterEventNumber);
    nextIndex += 1;
  }

  if (options.atOrBeforeTimestamp) {
    conditions.push(`timestamp <= $${nextIndex}`);
    values.push(options.atOrBeforeTimestamp);
  }

  const query = `
		SELECT *
		FROM events
		WHERE ${conditions.join(" AND ")}
		ORDER BY event_number ASC
	`;

  const { rows } = await client.query(query, values);
  return rows;
}

async function getAllEvents(client = pool) {
  const query = `
		SELECT *
		FROM events
		ORDER BY timestamp ASC, event_number ASC
	`;
  const { rows } = await client.query(query);
  return rows;
}

async function countEvents(client = pool) {
  const { rows } = await client.query("SELECT COUNT(*) AS count FROM events");
  return Number(rows[0].count);
}

async function hasTransactionForAccount(
  accountId,
  transactionId,
  client = pool,
) {
  const query = `
    SELECT 1
    FROM events
    WHERE aggregate_id = $1
      AND event_data ->> 'transactionId' = $2
      AND event_type IN ('MoneyDeposited', 'MoneyWithdrawn')
    LIMIT 1
  `;

  const { rows } = await client.query(query, [accountId, transactionId]);
  return rows.length > 0;
}

module.exports = {
  appendEvent,
  getAllEvents,
  getEventsByAggregateId,
  countEvents,
  hasTransactionForAccount,
};
