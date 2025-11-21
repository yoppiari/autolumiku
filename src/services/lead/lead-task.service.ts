/**
 * Lead Task Service
 * Epic 6: Story 6.5 - Automated Follow-up Reminders and Task Management
 *
 * Manage follow-up tasks and reminders
 */

import { prisma } from '@/lib/prisma';
import { LeadTask, TaskType, TaskStatus, LeadPriority } from '@prisma/client';

export interface CreateTaskData {
  title: string;
  description?: string;
  type: TaskType;
  priority: LeadPriority;
  assignedTo: string;
  assignedToName?: string;
  dueDate: Date;
  reminderDate?: Date;
  notes?: string;
}

export interface UpdateTaskData {
  title?: string;
  description?: string;
  type?: TaskType;
  priority?: LeadPriority;
  assignedTo?: string;
  assignedToName?: string;
  dueDate?: Date;
  reminderDate?: Date;
  status?: TaskStatus;
  notes?: string;
}

export interface TaskFilters {
  assignedTo?: string;
  status?: TaskStatus;
  type?: TaskType;
  priority?: LeadPriority;
  dueDateFrom?: Date;
  dueDateTo?: Date;
}

export class LeadTaskService {
  /**
   * Create a new task
   */
  async createTask(
    leadId: string,
    tenantId: string,
    data: CreateTaskData
  ): Promise<LeadTask> {
    // Set reminder date if not provided (1 day before due date)
    if (!data.reminderDate) {
      const reminderDate = new Date(data.dueDate);
      reminderDate.setDate(reminderDate.getDate() - 1);
      data.reminderDate = reminderDate;
    }

    const task = await prisma.leadTask.create({
      data: {
        leadId,
        tenantId,
        ...data,
      },
    });

    return task;
  }

  /**
   * Get task by ID
   */
  async getTask(taskId: string, tenantId: string): Promise<LeadTask | null> {
    return prisma.leadTask.findFirst({
      where: { id: taskId, tenantId },
    });
  }

  /**
   * Get tasks for a lead
   */
  async getLeadTasks(
    leadId: string,
    tenantId: string,
    filters: TaskFilters = {}
  ): Promise<LeadTask[]> {
    const where: any = { leadId, tenantId };

    if (filters.assignedTo) where.assignedTo = filters.assignedTo;
    if (filters.status) where.status = filters.status;
    if (filters.type) where.type = filters.type;
    if (filters.priority) where.priority = filters.priority;

    if (filters.dueDateFrom || filters.dueDateTo) {
      where.dueDate = {};
      if (filters.dueDateFrom) where.dueDate.gte = filters.dueDateFrom;
      if (filters.dueDateTo) where.dueDate.lte = filters.dueDateTo;
    }

    return prisma.leadTask.findMany({
      where,
      orderBy: [
        { status: 'asc' },
        { priority: 'desc' },
        { dueDate: 'asc' },
      ],
    });
  }

  /**
   * Get tasks for a user
   */
  async getUserTasks(
    tenantId: string,
    userId: string,
    filters: TaskFilters = {}
  ): Promise<LeadTask[]> {
    const where: any = { tenantId, assignedTo: userId };

    if (filters.status) where.status = filters.status;
    if (filters.type) where.type = filters.type;
    if (filters.priority) where.priority = filters.priority;

    if (filters.dueDateFrom || filters.dueDateTo) {
      where.dueDate = {};
      if (filters.dueDateFrom) where.dueDate.gte = filters.dueDateFrom;
      if (filters.dueDateTo) where.dueDate.lte = filters.dueDateTo;
    }

    return prisma.leadTask.findMany({
      where,
      orderBy: [
        { status: 'asc' },
        { priority: 'desc' },
        { dueDate: 'asc' },
      ],
      include: {
        lead: true,
      },
    });
  }

  /**
   * Update task
   */
  async updateTask(
    taskId: string,
    tenantId: string,
    data: UpdateTaskData
  ): Promise<LeadTask> {
    return prisma.leadTask.update({
      where: { id: taskId, tenantId },
      data,
    });
  }

  /**
   * Complete task
   */
  async completeTask(
    taskId: string,
    tenantId: string,
    userId: string,
    notes?: string
  ): Promise<LeadTask> {
    return prisma.leadTask.update({
      where: { id: taskId, tenantId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        completedBy: userId,
        notes,
      },
    });
  }

  /**
   * Cancel task
   */
  async cancelTask(
    taskId: string,
    tenantId: string,
    userId: string,
    reason?: string
  ): Promise<LeadTask> {
    return prisma.leadTask.update({
      where: { id: taskId, tenantId },
      data: {
        status: 'CANCELLED',
        notes: reason,
      },
    });
  }

  /**
   * Get overdue tasks
   */
  async getOverdueTasks(tenantId: string, userId?: string): Promise<LeadTask[]> {
    const where: any = {
      tenantId,
      status: { in: ['PENDING', 'IN_PROGRESS'] },
      dueDate: { lt: new Date() },
    };

    if (userId) {
      where.assignedTo = userId;
    }

    return prisma.leadTask.findMany({
      where,
      orderBy: { dueDate: 'asc' },
      include: {
        lead: true,
      },
    });
  }

  /**
   * Get tasks due today
   */
  async getTasksDueToday(tenantId: string, userId?: string): Promise<LeadTask[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const where: any = {
      tenantId,
      status: { in: ['PENDING', 'IN_PROGRESS'] },
      dueDate: {
        gte: today,
        lt: tomorrow,
      },
    };

    if (userId) {
      where.assignedTo = userId;
    }

    return prisma.leadTask.findMany({
      where,
      orderBy: { dueDate: 'asc' },
      include: {
        lead: true,
      },
    });
  }

  /**
   * Get upcoming tasks
   */
  async getUpcomingTasks(
    tenantId: string,
    days: number = 7,
    userId?: string
  ): Promise<LeadTask[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const future = new Date(today);
    future.setDate(future.getDate() + days);

    const where: any = {
      tenantId,
      status: { in: ['PENDING', 'IN_PROGRESS'] },
      dueDate: {
        gte: today,
        lt: future,
      },
    };

    if (userId) {
      where.assignedTo = userId;
    }

    return prisma.leadTask.findMany({
      where,
      orderBy: { dueDate: 'asc' },
      include: {
        lead: true,
      },
    });
  }

  /**
   * Get task statistics for user
   */
  async getUserTaskStats(
    tenantId: string,
    userId: string
  ): Promise<{
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
    overdue: number;
    dueToday: number;
  }> {
    const [all, overdue, dueToday] = await Promise.all([
      prisma.leadTask.findMany({
        where: { tenantId, assignedTo: userId },
      }),
      this.getOverdueTasks(tenantId, userId),
      this.getTasksDueToday(tenantId, userId),
    ]);

    return {
      total: all.length,
      pending: all.filter((t) => t.status === 'PENDING').length,
      inProgress: all.filter((t) => t.status === 'IN_PROGRESS').length,
      completed: all.filter((t) => t.status === 'COMPLETED').length,
      overdue: overdue.length,
      dueToday: dueToday.length,
    };
  }

  /**
   * Auto-schedule next follow-up task
   */
  async scheduleNextFollowUp(
    leadId: string,
    tenantId: string,
    assignedTo: string,
    assignedToName: string,
    daysFromNow: number = 3
  ): Promise<LeadTask> {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + daysFromNow);

    return this.createTask(leadId, tenantId, {
      title: 'Follow up dengan customer',
      description: 'Scheduled follow-up task',
      type: 'FOLLOW_UP',
      priority: 'MEDIUM',
      assignedTo,
      assignedToName,
      dueDate,
    });
  }

  /**
   * Mark overdue tasks
   */
  async markOverdueTasks(tenantId: string): Promise<number> {
    const result = await prisma.leadTask.updateMany({
      where: {
        tenantId,
        status: { in: ['PENDING', 'IN_PROGRESS'] },
        dueDate: { lt: new Date() },
      },
      data: {
        status: 'OVERDUE',
      },
    });

    return result.count;
  }
}

export const leadTaskService = new LeadTaskService();
