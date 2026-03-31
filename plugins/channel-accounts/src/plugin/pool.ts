import * as E from "@/shared/error.ts";
import type { ChannelAccount } from "@/shared/types.ts";

type Waiter = (channel: ChannelAccount) => void;

const sameChannel = (left: ChannelAccount, right: ChannelAccount) =>
  left.address() === right.address();

export class ChannelAccountsPool {
  private readonly freeChannels: ChannelAccount[] = [];
  private readonly lockedChannels = new Map<string, ChannelAccount>();
  private readonly waiters: Waiter[] = [];

  constructor(channels: readonly ChannelAccount[] = []) {
    this.registerChannels(channels);
  }

  getChannels(): ChannelAccount[] {
    return [...this.freeChannels, ...this.lockedChannels.values()];
  }

  registerChannels(channels: readonly ChannelAccount[]): void {
    for (const channel of channels) {
      if (this.hasChannel(channel)) continue;
      this.enqueue(channel);
    }
  }

  hasAllocation(runId: string): boolean {
    return this.lockedChannels.has(runId);
  }

  async allocate(runId: string): Promise<ChannelAccount> {
    const existingChannel = this.lockedChannels.get(runId);
    if (existingChannel) return existingChannel;

    const freeChannel = this.freeChannels.pop();
    if (freeChannel) {
      this.lockedChannels.set(runId, freeChannel);
      return freeChannel;
    }

    return await new Promise((resolve) => {
      this.waiters.push((channel) => {
        this.lockedChannels.set(runId, channel);
        resolve(channel);
      });
    });
  }

  release(runId: string): void {
    const channel = this.lockedChannels.get(runId);
    if (!channel) throw new E.CHANNEL_NOT_ALLOCATED(runId);

    this.lockedChannels.delete(runId);
    this.enqueue(channel);
  }

  private hasChannel(candidate: ChannelAccount): boolean {
    return this.getChannels().some((channel) =>
      sameChannel(channel, candidate)
    );
  }

  private enqueue(channel: ChannelAccount): void {
    const waiter = this.waiters.shift();
    if (waiter) {
      waiter(channel);
      return;
    }

    this.freeChannels.push(channel);
  }
}
