export type TaskId = string;

export type ScheduleAccountEnabling = (accountId: string, whenToEnable: Date) => Promise<TaskId>;
export type ScheduleActiveUserSessionDeletion = (accountId: string, sessionTimestamp: number, whenToDelete: Date) => Promise<TaskId>;
export type ScheduleUnactivatedAccountDeletion = (accountId: string, whenToDelete: Date) => Promise<TaskId>; // implementor may choose it to be no op

export type CancelScheduledUnactivatedAccountDeletion = (taskId: string) => Promise<void>; // implementor may choose it to be no op
