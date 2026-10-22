export class EngagementWorker {
  constructor({ featured, intervalMs = 60_000, logger = console, setIntervalFn = setInterval, clearIntervalFn = clearInterval } = {}) {
    this.featured = featured; this.intervalMs = intervalMs; this.logger = logger; this.setIntervalFn = setIntervalFn; this.clearIntervalFn = clearIntervalFn; this.timer = null;
  }

  async runOnce() {
    if(this.running)return this.running;
    this.running=(async()=>{
      await this.featured?.expireDue?.().catch(error => this.logger.error?.('Featured expiry worker failed:', error));
      await this.featured?.rotateDueHousesAll?.().catch(error => this.logger.error?.('Weekly Featured selection failed:', error));
    })();
    try{return await this.running;}finally{this.running=null;}
  }

  async start() {
    if (this.timer != null || this.starting) return;
    this.starting=true;
    await this.runOnce();
    this.starting=false;
    this.timer = this.setIntervalFn(() => this.runOnce(), this.intervalMs);
  }

  stop() { if (this.timer == null) return; this.clearIntervalFn(this.timer); this.timer = null; }
}
