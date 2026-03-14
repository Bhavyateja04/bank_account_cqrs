require("dotenv").config();
const express = require("express");

const accountCommands = require("./routes/accountCommands");
const accountQueries = require("./routes/accountQueries");
const projections = require("./routes/projections");

const app = express();

app.use(express.json());

console.log("Routes loaded");
app.use("/api/accounts", accountCommands);
app.use("/api/accounts", accountQueries);
app.use("/api/projections", projections);

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.listen(process.env.API_PORT || 8080, () => {
  console.log("Server running on 8080");
});