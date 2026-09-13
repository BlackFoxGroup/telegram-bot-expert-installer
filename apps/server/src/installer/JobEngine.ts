import { EventEmitter } from "node:events";
import type { JobEvent, JobStatus, JobStep } from "@expert/shared";
import { INSTALL_STEPS } from "@expert/shared";

export class JobEngine extends EventEmitter {
  steps: JobStep[] = INSTALL_STEPS.map((s) => ({ id: s.id, title: s.title, status: "pending" }));
  status: JobStatus = "idle";
  jobId = "";

  start(jobId: string): void {
    this.jobId = jobId;
    this.status = "running";
    this.steps = INSTALL_STEPS.map((s) => ({ id: s.id, title: s.title, status: "pending" }));
    this.emit("event", this.snapshot("نصب شروع شد"));
  }

  async run(id: string, fn: () => Promise<string | void>): Promise<void> {
    const step = this.steps.find((s) => s.id === id);
    if (!step) return;
    step.status = "running";
    this.emit("event", this.snapshot(step.title));
    try {
      const detail = await fn();
      step.status = "done";
      step.detail = detail || "";
      this.emit("event", this.snapshot(step.title));
    } catch (e) {
      step.status = "failed";
      step.detail = e instanceof Error ? e.message : String(e);
      this.status = "failed";
      this.emit("event", this.snapshot(step.detail, id));
      throw e;
    }
  }

  skip(id: string, reason: string): void {
    const step = this.steps.find((s) => s.id === id);
    if (!step) return;
    step.status = "skipped";
    step.detail = reason;
    this.emit("event", this.snapshot(reason));
  }

  succeed(): void {
    this.status = "success";
    this.emit("event", this.snapshot("نصب تمام شد"));
  }

  snapshot(message: string, failedStep?: string): JobEvent {
    return { jobId: this.jobId, status: this.status, steps: this.steps, message, failedStep };
  }
}
