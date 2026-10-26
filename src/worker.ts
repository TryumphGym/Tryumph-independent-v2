import server from "./server";
import { finishRecordedClass } from "./lib/recordings.server";
export default {
  fetch: server.fetch,
  async scheduled() {
    const { runMaintenance } = await import("./lib/maintenance.server");
    await runMaintenance();
  },
  async queue(batch: {
    messages: {
      body: { egressId: string };
      ack: () => void;
      retry: (options?: { delaySeconds: number }) => void;
    }[];
  }) {
    for (const message of batch.messages) {
      try {
        await finishRecordedClass(message.body.egressId);
        message.ack();
      } catch (error) {
        console.error("Recording import will retry", error);
        message.retry({ delaySeconds: 120 });
      }
    }
  },
};
