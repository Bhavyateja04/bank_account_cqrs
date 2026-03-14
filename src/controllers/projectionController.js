const projector = require("../services/projector");

function handleError(res, error) {
  return res.status(error.statusCode || 500).json({
    error: error.message || "Internal server error",
  });
}

async function rebuild(req, res) {
  try {
    const result = await projector.rebuildProjections();
    return res.status(202).json({
      message: "Projection rebuild initiated.",
      ...result,
    });
  } catch (error) {
    return handleError(res, error);
  }
}

async function status(req, res) {
  try {
    const result = await projector.getProjectionStatus();
    return res.json(result);
  } catch (error) {
    return handleError(res, error);
  }
}

module.exports = {
  rebuild,
  status,
};
