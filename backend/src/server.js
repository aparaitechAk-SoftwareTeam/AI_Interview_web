import { app } from "./app.js";
import { connectDatabase } from "./config/database.js";
import { env } from "./config/env.js";

async function start() {
  await connectDatabase();
  app.listen(env.PORT, () => console.info(`Aparaitech API listening on ${env.PORT}`));
}
start().catch((error) => { console.error("API failed to start", { message: error.message }); process.exit(1); });
