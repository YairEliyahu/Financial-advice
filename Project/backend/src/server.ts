import 'dotenv/config';
import { createApp } from './app/createApp.js';

const port = Number(process.env.PORT ?? 4000);
const host = process.env.HOST ?? '0.0.0.0';

createApp().listen(port, host, () => {
  console.log(`Shadow Ledger API listening on http://${host}:${port}`);
});
