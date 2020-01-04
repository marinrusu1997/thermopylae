export type ScheduleActiveUserSessionDeletion = (accountId: string, sessionTimestamp: number, whenToDelete: Date) => void;
export type ScheduleUnactivatedAccountDeletion = (accountId: string, whenToDelete: Date) => string;
export type CancelScheduledUnactivatedAccountDeletion = (taskId: string) => void;
