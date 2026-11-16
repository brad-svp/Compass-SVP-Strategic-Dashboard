import app from "./app";
import { logger } from "./lib/logger";
import { seedFoundation } from "./lib/seedFoundation";
import { seedAccountability } from "./lib/seedAccountability";
import { seedCalendar } from "./lib/seedCalendar";
import { seedPurpose } from "./lib/purposeService";
import { seedCalendarPrograms } from "./lib/calendarProgramsService";
import { startBrainWorker } from "./lib/brain/indexer";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

seedFoundation().then(seedAccountability).then(seedCalendar).then(seedCalendarPrograms).then(seedPurpose).then(() => app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  startBrainWorker();
})).catch((err) => { logger.error({ err }, "Unable to initialize SVP Compass"); process.exit(1); });
