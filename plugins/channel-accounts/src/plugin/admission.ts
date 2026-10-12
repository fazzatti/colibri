import { concurrent } from "convee";
import type { ChannelAccountsPool } from "@/plugin/pool.ts";
import type {
  ChannelAccount,
  CreateChannelAccountsPluginArgs,
} from "@/shared/types.ts";

type LeaseRequest = {
  runId: string;
  ready: PromiseWithResolvers<ChannelAccount>;
  released: PromiseWithResolvers<void>;
};

/** Keep Convee's admission slot alive until the owning pipeline finalizes. */
export class ChannelAccountsAdmission {
  private readonly pending = new Map<
    string,
    {
      ready: Promise<ChannelAccount>;
      release: () => void;
      finished: Promise<void>;
    }
  >();
  private readonly schedule: (request: LeaseRequest) => Promise<void>;

  constructor(
    pool: ChannelAccountsPool,
    options: CreateChannelAccountsPluginArgs,
  ) {
    this.schedule = concurrent({
      // Omitted limits preserve the existing plugin's open admission. Account
      // availability remains independent and can grow through registration.
      concurrency: options.concurrency ?? Number.MAX_SAFE_INTEGER,
      maxPending: options.maxPending ?? Number.MAX_SAFE_INTEGER,
      capacityScope: "shared",
      tasks: {
        lease: async (request: LeaseRequest) => {
          request.ready.resolve(await pool.allocate(request.runId));
          await request.released.promise;
          pool.release(request.runId);
        },
      },
      split: ({ lease }, request: LeaseRequest) =>
        [lease.job(request)] as const,
      join: () => undefined,
    });
  }

  acquire(runId: string): Promise<ChannelAccount> {
    const existing = this.pending.get(runId);
    if (existing) return existing.ready;
    const ready = Promise.withResolvers<ChannelAccount>();
    const released = Promise.withResolvers<void>();
    const finished = this.schedule({ runId, ready, released }).catch(
      ready.reject,
    );
    this.pending.set(runId, {
      ready: ready.promise,
      release: released.resolve,
      finished,
    });
    return ready.promise;
  }

  release(runId: string): void | Promise<void> {
    const request = this.pending.get(runId);
    // Earlier input hooks may fail before this plugin ever requests a slot.
    if (!request) return;
    request.release();
    return request.finished.then(() => {
      this.pending.delete(runId);
    });
  }
}
