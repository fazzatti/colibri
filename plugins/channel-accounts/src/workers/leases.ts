import * as ERROR from "@/shared/error.ts";
import type { ChannelAccountsWorkerState } from "@/workers/types.ts";

interface Channel {
  readonly address: string;
  state: ChannelAccountsWorkerState["state"];
  error?: Error;
}
interface Waiter {
  readonly id: string;
  readonly resolve: (address: string) => void;
  readonly reject: (error: Error) => void;
}

/** Account ownership, separate from Convee's transport capacity and task queue. */
export class ChannelWorkerLeases {
  private readonly channels: Channel[];
  private readonly active = new Map<string, Channel>();
  private readonly waiting: Waiter[] = [];
  private closed = false;
  constructor(
    addresses: readonly string[],
    private readonly maxPending: number,
  ) {
    this.channels = addresses.map((address) => ({
      address,
      state: "available",
    }));
  }
  assertOpen(): void {
    if (this.closed) throw new ERROR.CHANNEL_WORKERS_CLOSED();
  }
  async acquire(id: string): Promise<string> {
    this.assertOpen();
    if (this.active.size + this.waiting.length >= this.maxPending) {
      throw new ERROR.CHANNEL_WORKER_CAPACITY(this.maxPending);
    }
    const channel = this.channels.find((channel) =>
      channel.state === "available"
    );
    if (channel) {
      this.active.set(id, channel);
      channel.state = "busy";
      return channel.address;
    }
    if (
      this.channels.every((
        channel,
      ) => (channel.state === "quarantined" || channel.state === "unavailable"))
    ) {
      throw new ERROR.CHANNELS_UNAVAILABLE();
    }
    return await new Promise<string>((resolve, reject) =>
      this.waiting.push({ id, resolve, reject })
    );
  }
  release(id: string, error?: Error, quarantine = true): void {
    const channel = this.active.get(id);
    if (!channel) return;
    this.active.delete(id);
    if (error) {
      channel.state = quarantine ? "quarantined" : "unavailable";
      channel.error = error;
    }
    if (channel.state === "busy") {
      const waiter = this.waiting.shift();
      if (waiter) {
        this.active.set(waiter.id, channel);
        waiter.resolve(channel.address);
      } else {
        channel.state = "available";
      }
    }
    if (
      this.channels.every((
        channel,
      ) => (channel.state === "quarantined" || channel.state === "unavailable"))
    ) {
      this.rejectWaiting(new ERROR.CHANNELS_UNAVAILABLE());
    }
  }
  snapshot(): ChannelAccountsWorkerState[] {
    return this.channels.map((channel) => ({ ...channel }));
  }
  close(): void {
    this.closed = true;
    this.rejectWaiting(new ERROR.CHANNEL_WORKERS_CLOSED());
  }
  interrupt(): void {
    this.close();
    for (const channel of this.active.values()) {
      channel.state = "quarantined";
      channel.error = new ERROR.CHANNEL_WORKERS_CLOSED();
    }
  }
  private rejectWaiting(error: Error): void {
    for (const waiter of this.waiting.splice(0)) waiter.reject(error);
  }
}
