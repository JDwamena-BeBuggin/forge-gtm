// Minimal Cloudflare Workers global types so tsc doesn't error on worker files.
// Full types are available via @cloudflare/workers-types if you install it.

declare class ScheduledEvent {
  readonly scheduledTime: number
  readonly cron: string
  waitUntil(promise: Promise<unknown>): void
}

declare class ExecutionContext {
  waitUntil(promise: Promise<unknown>): void
  passThroughOnException(): void
}

declare interface MessageBatch<T> {
  readonly queue: string
  readonly messages: Message<T>[]
}

declare interface Message<T> {
  readonly id: string
  readonly timestamp: Date
  readonly body: T
  ack(): void
  retry(): void
}
