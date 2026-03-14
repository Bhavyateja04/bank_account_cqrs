const { v4: uuidv4 } = require("uuid");

const pool = require("../config/db");

async function getSnapshot(aggregateId, client = pool) {
  const query = `
		SELECT *
		FROM snapshots
		WHERE aggregate_id = $1
	`;
  const { rows } = await client.query(query, [aggregateId]);
  return rows[0] || null;
}

async function saveSnapshot({
  aggregateId,
  snapshotData,
  lastEventNumber,
  client = pool,
}) {
  const query = `
		INSERT INTO snapshots (
			snapshot_id,
			aggregate_id,
			snapshot_data,
			last_event_number,
			created_at
		)
		VALUES ($1, $2, $3, $4, NOW())
		ON CONFLICT (aggregate_id)
		DO UPDATE SET
			snapshot_id = EXCLUDED.snapshot_id,
			snapshot_data = EXCLUDED.snapshot_data,
			last_event_number = EXCLUDED.last_event_number,
			created_at = NOW()
		RETURNING *
	`;

  const values = [uuidv4(), aggregateId, snapshotData, lastEventNumber];
  const { rows } = await client.query(query, values);
  return rows[0];
}

function shouldCreateSnapshot(lastEventNumber) {
  return lastEventNumber > 0 && lastEventNumber % 50 === 0;
}

module.exports = {
  getSnapshot,
  saveSnapshot,
  shouldCreateSnapshot,
};
