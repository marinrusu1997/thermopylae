import { CancelScheduledUnactivatedAccountDeletion, ScheduleActiveUserSessionDeletion, ScheduleUnactivatedAccountDeletion } from '../../lib/models/schedulers';
import { AccountEntityMongo, ActiveUserSessionEntityMongo } from './mongo-entities';

const ScheduleActiveUserSessionDeletionFromMongo: ScheduleActiveUserSessionDeletion = (sessionId, whenToDelete) => {
	setTimeout(() => ActiveUserSessionEntityMongo.delete(sessionId), whenToDelete.getTime() - new Date().getTime());
};

const ScheduleUnactivatedAccountDeletionFromMongo: ScheduleUnactivatedAccountDeletion = (accountId, whenToDelete) => {
	return String(setTimeout(() => AccountEntityMongo.delete(accountId), whenToDelete.getTime() - new Date().getTime()));
};

const CancelScheduledUnactivatedAccountDeletionFromMongo: CancelScheduledUnactivatedAccountDeletion = taskId => {
	clearTimeout(Number(taskId));
};

export { ScheduleActiveUserSessionDeletionFromMongo, ScheduleUnactivatedAccountDeletionFromMongo, CancelScheduledUnactivatedAccountDeletionFromMongo };
