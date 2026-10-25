import { coachRuntime } from "./bot.mjs";
import { startCoachWebServer } from "./coach-web-server.mjs";

startCoachWebServer(coachRuntime).catch(error => {
  console.error("Không mở được English Coach web:", error.message);
  process.exitCode = 1;
});
