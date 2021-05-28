export type TaskId = string;

export type ScheduleAccountEnabling = (accountId: string, whenToEnable: Date) => Promise<TaskId>;

// @fixme this needs to be removed, we have nothing to do with sessions
export type ScheduleActiveUserSessionDeletion = (accountId: string, sessionTimestamp: number, whenToDelete: Date) => Promise<TaskId>;

// @fixme this WILL BE USELESS
export type ScheduleUnactivatedAccountDeletion = (accountId: string, whenToDelete: Date) => Promise<TaskId>; // implementor may choose it to be no op

// @fixme this WILL BE USELESS
export type CancelScheduledUnactivatedAccountDeletion = (taskId: string) => Promise<void>; // implementor may choose it to be no op
