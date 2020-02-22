export type ScheduleActiveUserSessionDeletion = (accountId: string, sessionTimestamp: number, whenToDelete: Date) => void;
export type ScheduleUnactivatedAccountDeletion = (accountId: string, whenToDelete: Date) => string; // implementor may choose it to be no op
export type CancelScheduledUnactivatedAccountDeletion = (taskId: string) => void; // implementor may choose it to be no op
