export class CircuitBreaker {
  private doRequestCount = 0;
  private lastResetDay = "";

  check(env: {
    DAILY_DO_BUDGET: string;
    WARN_THRESHOLD: string;
    DEGRADE_THRESHOLD: string;
  }): "ok" | "warn" | "degrade" {
    const today = new Date().toISOString().slice(0, 10);
    if (today !== this.lastResetDay) {
      this.doRequestCount = 0;
      this.lastResetDay = today;
    }

    const budget = parseInt(env.DAILY_DO_BUDGET) || 90_000;
    const ratio = this.doRequestCount / budget;

    if (ratio >= parseFloat(env.DEGRADE_THRESHOLD || "0.90")) return "degrade";
    if (ratio >= parseFloat(env.WARN_THRESHOLD || "0.70")) return "warn";
    return "ok";
  }

  incrementDoRequest() {
    this.doRequestCount++;
  }

  getStatus() {
    return {
      doRequestCount: this.doRequestCount,
      lastResetDay: this.lastResetDay,
    };
  }
}
