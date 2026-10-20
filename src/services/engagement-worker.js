export class EngagementWorker {
  constructor({ reminders, featured, intervalMs = 60_000, logger = console, setIntervalFn = setInterval, clearIntervalFn = clearInterval } = {}) {
    this.reminders = reminders; this.featured = featured; this.intervalMs = intervalMs; this.logger = logger; this.setIntervalFn = setIntervalFn; this.clearIntervalFn = clearIntervalFn; this.timer = null;
  }

  async runOnce() {
    await this.reminders?.runOnce?.().catch(error => this.logger.error?.('Event reminder worker failed:', error));
    await this.featured?.expireDue?.().catch(error => this.logger.error?.('Featured expiry worker failed:', error));
    await this.featured?.autoSelectEmptyAll?.().catch(error => this.logger.error?.('Automatic Featured selection failed:', error));
  }

  async start() {
    if (this.timer != null) return;
    await this.runOnce();
    this.timer = this.setIntervalFn(() => this.runOnce(), this.intervalMs);
  }

  stop() { if (this.timer == null) return; this.clearIntervalFn(this.timer); this.timer = null; }
}
