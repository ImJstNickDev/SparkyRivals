import cron from 'node-cron';
import { remotePushConfig } from '../utils/remotePushConfig.js';
import { processRemotePush } from './remotePushService.js';
import { log } from '../config/logging.js';
let running = false;
export function scheduleRemotePush() {
  if (!remotePushConfig().enabled) return;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      await processRemotePush();
    } catch {
      log('warn', '[Push] Worker failed; retry next scheduled tick');
    } finally {
      running = false;
    }
  };
  cron.schedule('*/30 * * * * *', () => {
    void run();
  });
  void run();
}
