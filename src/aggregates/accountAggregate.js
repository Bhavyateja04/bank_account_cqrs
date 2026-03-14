const OPEN_STATUS = "OPEN";
const CLOSED_STATUS = "CLOSED";

function createInitialState(accountId = null) {
  return {
    accountId,
    ownerName: null,
    balance: 0,
    currency: null,
    status: null,
    version: 0,
    lastUpdatedAt: null,
  };
}

function normalizeAmount(value) {
  return Number(Number(value).toFixed(4));
}

function applyEvent(state, event) {
  const nextState = {
    ...state,
    accountId: state.accountId || event.aggregate_id,
    version: event.event_number,
    lastUpdatedAt: event.timestamp,
  };

  switch (event.event_type) {
    case "AccountCreated": {
      return {
        ...nextState,
        ownerName: event.event_data.ownerName,
        balance: normalizeAmount(event.event_data.initialBalance || 0),
        currency: event.event_data.currency,
        status: OPEN_STATUS,
      };
    }
    case "MoneyDeposited": {
      return {
        ...nextState,
        balance: normalizeAmount(
          nextState.balance + Number(event.event_data.amount),
        ),
      };
    }
    case "MoneyWithdrawn": {
      return {
        ...nextState,
        balance: normalizeAmount(
          nextState.balance - Number(event.event_data.amount),
        ),
      };
    }
    case "AccountClosed": {
      return {
        ...nextState,
        status: CLOSED_STATUS,
      };
    }
    default:
      return nextState;
  }
}

function replayEvents(events, baseState = createInitialState()) {
  return events.reduce((state, event) => applyEvent(state, event), baseState);
}

module.exports = {
  OPEN_STATUS,
  CLOSED_STATUS,
  createInitialState,
  replayEvents,
  normalizeAmount,
};
