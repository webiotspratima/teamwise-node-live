"use strict";

require("dotenv").config();
const http = require("http");
const app = require("./app");
const { sequelize } = require("./models");
const reminderCron = require('./cron/send-reminders');
const createDefaultAdmin = require("./utils/createDefaultAdmin");
const PORT = process.env.PORT || 3000;

const server = http.createServer(app);

const { Server } = require("socket.io");
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.set("io", io);
require('./socket')(io);

// Start cron with socket instance
reminderCron(io);

sequelize
  .authenticate()
  .then(async () => {
    console.log("✅ DB connected");
    await sequelize.sync();
    await createDefaultAdmin();

    server.listen(PORT, () => {
      console.log(`🚀 Server running at http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ DB connection failed:", err);
  });
