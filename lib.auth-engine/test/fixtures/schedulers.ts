import { CancelScheduledUnactivatedAccountDeletion, ScheduleActiveUserSessionDeletion, ScheduleUnactivatedAccountDeletion } from '../../lib/types/schedulers';
import { AccountEntityMongo, ActiveUserSessionEntityMongo } from './mongo-entities';
// eslint-disable-next-line no-undef
import Timeout = NodeJS.Timeout;

enum SCHEDULING_OP {
	DELETE_ACTIVE_USER_SESSION,
	DELETE_UNACTIVATED_ACCOUNT,
	CANCEL_DELETION_OF_UNACTIVATED_ACCOUNT
}

const failures = new Map<number, boolean>();

const timeouts = new Map<number, Timeout>();
let counter = 0;

const ScheduleActiveUserSessionDeletionFromMongo: ScheduleActiveUserSessionDeletion = (accountId, sessionTimestamp, whenToDelete) => {
	if (failures.get(SCHEDULING_OP.DELETE_ACTIVE_USER_SESSION)) {
		throw new Error('Scheduling delete active user session was configured to fail');
	}

	setTimeout(() => {
		ActiveUserSessionEntityMongo.delete(accountId, sessionTimestamp).catch(err =>
			console.error('Error occurred in scheduling delete active user session', err)
		);
	}, whenToDelete.getTime() - new Date().getTime());
};

const ScheduleUnactivatedAccountDeletionFromMongo: ScheduleUnactivatedAccountDeletion = (accountId, whenToDelete) => {
	if (failures.get(SCHEDULING_OP.DELETE_UNACTIVATED_ACCOUNT)) {
		throw new Error('Scheduling delete unactivated account was configured to fail');
	}

	// eslint-disable-next-line no-plusplus
	const currentTaskId = counter++;
	timeouts.set(
		currentTaskId,
		setTimeout(() => {
			timeouts.delete(currentTaskId);
			return AccountEntityMongo.delete(accountId);
		}, whenToDelete.getTime() - new Date().getTime())
	);
	return String(currentTaskId);
};

const CancelScheduledUnactivatedAccountDeletionFromMongo: CancelScheduledUnactivatedAccountDeletion = taskId => {
	if (failures.get(SCHEDULING_OP.CANCEL_DELETION_OF_UNACTIVATED_ACCOUNT)) {
		throw new Error('Canceling deletion of unactivated account was configured to fail');
	}

	const numericTaskId = Number(taskId);
	clearTimeout(timeouts.get(numericTaskId)!);
	timeouts.delete(numericTaskId);
};

function hasActiveTimers(): boolean {
	return timeouts.size !== 0;
}

function failureWillBeGeneratedWhenScheduling(operation: SCHEDULING_OP, willBeGenerated = true): void {
	failures.set(operation, willBeGenerated);
}

function cleanUpSchedulers(): void {
	timeouts.forEach(timeout => clearTimeout(timeout));
	timeouts.clear();
	failures.clear();
}

export {
	ScheduleActiveUserSessionDeletionFromMongo,
	ScheduleUnactivatedAccountDeletionFromMongo,
	CancelScheduledUnactivatedAccountDeletionFromMongo,
	hasActiveTimers,
	failureWillBeGeneratedWhenScheduling,
	cleanUpSchedulers,
	SCHEDULING_OP
};
