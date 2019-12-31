export type ScheduleActiveUserSessionDeletion = (sessionId: number, whenToDelete: Date) => void;
export type ScheduleUnactivatedAccountDeletion = (accountId: string, whenToDelete: Date) => string;
export type CancelScheduledUnactivatedAccountDeletion = (taskId: string) => void;
