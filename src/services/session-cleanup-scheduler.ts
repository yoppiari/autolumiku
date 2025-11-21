/**
 * Session Cleanup Scheduler
 * Periodically cleans up expired sessions using cron
 */

import cron from 'node-cron';
import { sessionManagementService } from './session-management.service';
import { createLogger, format, transports } from 'winston';

const logger = createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.json()
  ),
  transports: [
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.simple()
      )
    })
  ]
});

export class SessionCleanupScheduler {
  private cronJob?: cron.ScheduledTask;
  private isRunning = false;

  /**
   * Start the cleanup scheduler
   * Runs every hour by default
   */
  start(cronExpression: string = '0 * * * *'): void {
    if (this.isRunning) {
      logger.warn('Session cleanup scheduler is already running');
      return;
    }

    logger.info(`Starting session cleanup scheduler with cron: ${cronExpression}`);

    this.cronJob = cron.schedule(cronExpression, async () => {
      try {
        logger.info('Running scheduled session cleanup...');
        await sessionManagementService.cleanupExpiredSessions();
        logger.info('Scheduled session cleanup completed successfully');
      } catch (error) {
        logger.error('Scheduled session cleanup failed:', error);
      }
    });

    this.isRunning = true;
    logger.info('Session cleanup scheduler started successfully');
  }

  /**
   * Stop the cleanup scheduler
   */
  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.isRunning = false;
      logger.info('Session cleanup scheduler stopped');
    }
  }

  /**
   * Get scheduler status
   */
  getStatus(): { isRunning: boolean; nextRun?: Date } {
    return {
      isRunning: this.isRunning,
      nextRun: this.cronJob ? new Date(Date.now() + 3600000) : undefined // Approximate next run
    };
  }

  /**
   * Trigger cleanup immediately (for testing or manual trigger)
   */
  async triggerNow(): Promise<void> {
    logger.info('Manually triggering session cleanup...');
    await sessionManagementService.cleanupExpiredSessions();
    logger.info('Manual session cleanup completed');
  }
}

// Export singleton instance
export const sessionCleanupScheduler = new SessionCleanupScheduler();

// Auto-start scheduler if not in test environment
if (process.env.NODE_ENV !== 'test') {
  sessionCleanupScheduler.start();
  logger.info('Session cleanup scheduler auto-started');
}
