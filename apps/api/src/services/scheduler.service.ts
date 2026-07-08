/**
 * Scheduler service - manages pg-boss cron jobs for polling
 */

import { getBoss } from '../queue.js';
import { JOB_QUEUES } from '@codegraph-cloud/shared';

export class SchedulerService {
  async scheduleSyncJob(projectId: string, commitSha: string | null, trigger: string): Promise<string> {
    const boss = await getBoss();
    const jobId = await boss.send(JOB_QUEUES.SYNC_REPO, {
      projectId,
      commitSha,
      trigger,
    });
    return jobId;
  }

  async scheduleIndexJob(projectId: string, syncJobId: string): Promise<string> {
    const boss = await getBoss();
    const jobId = await boss.send(JOB_QUEUES.INDEX_PROJECT, {
      projectId,
      syncJobId,
    });
    return jobId;
  }

  async setupPollingSchedule(projectId: string, intervalSec: number): Promise<void> {
    const boss = await getBoss();
    const scheduleName = `poll-${projectId}`;

    // Remove existing schedule if any
    await boss.removeSchedule(scheduleName);

    // Add new schedule with cron expression
    const cronExpr = this.intervalToCron(intervalSec);
    await boss.schedule(scheduleName, cronExpr, {
      projectId,
      trigger: 'poll',
    }, {
      queue: JOB_QUEUES.SYNC_REPO,
    });
  }

  async removePollingSchedule(projectId: string): Promise<void> {
    const boss = await getBoss();
    await boss.removeSchedule(`poll-${projectId}`);
  }

  /**
   * Convert interval in seconds to a simple cron expression
   */
  private intervalToCron(seconds: number): string {
    if (seconds < 60) seconds = 60;
    if (seconds >= 3600) {
      // Every N hours
      const hours = Math.floor(seconds / 3600);
      return `0 */${hours} * * *`;
    }
    if (seconds >= 60) {
      // Every N minutes
      const minutes = Math.floor(seconds / 60);
      return `*/${minutes} * * * *`;
    }
    // Default: every minute
    return '* * * * *';
  }
}

export const schedulerService = new SchedulerService();
