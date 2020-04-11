import {
	CancelScheduledUnactivatedAccountDeletion,
	ScheduleAccountEnabling,
	ScheduleActiveUserSessionDeletion,
	ScheduleUnactivatedAccountDeletion
} from '../../lib/types/schedulers';
import { AccountEntityMongo, ActiveUserSessionEntityMongo } from './mongo-entities';
// eslint-disable-next-line no-undef
import Timeout = NodeJS.Timeout;

enum SCHEDULING_OP {
	ENABLE_ACCOUNT,
	DELETE_ACTIVE_USER_SESSION,
	DELETE_UNACTIVATED_ACCOUNT,
	CANCEL_DELETION_OF_UNACTIVATED_ACCOUNT
}

const failures = new Map<number, boolean>();

const scheduledTasks = new Map<number, Timeout>();
let counter = 0;

function registerTask(task: (...args: any[]) => void, whenToExecute: Date): string {
	// eslint-disable-next-line no-plusplus
	const currentTaskId = counter++;
	scheduledTasks.set(
		currentTaskId,
		setTimeout(() => {
			scheduledTasks.delete(currentTaskId);
			task();
		}, whenToExecute.getTime() - new Date().getTime())
	);
	return String(currentTaskId);
}

const ScheduleAccountEnablingFromMongo: ScheduleAccountEnabling = async (accountId, whenToEnable) => {
	if (failures.get(SCHEDULING_OP.ENABLE_ACCOUNT)) {
		throw new Error('Scheduling account enabling was configured to fail');
	}

	return registerTask(() => {
		AccountEntityMongo.enable(accountId).catch(err => console.error('Error occured in scheduling account enabling', err));
	}, whenToEnable);
};

const ScheduleActiveUserSessionDeletionFromMongo: ScheduleActiveUserSessionDeletion = async (accountId, sessionTimestamp, whenToDelete) => {
	if (failures.get(SCHEDULING_OP.DELETE_ACTIVE_USER_SESSION)) {
		throw new Error('Scheduling delete active user session was configured to fail');
	}

	return registerTask(() => {
		ActiveUserSessionEntityMongo.delete(accountId, sessionTimestamp).catch(err =>
			console.error('Error occurred in scheduling delete active user session', err)
		);
	}, whenToDelete);
};

const ScheduleUnactivatedAccountDeletionFromMongo: ScheduleUnactivatedAccountDeletion = async (accountId, whenToDelete) => {
	if (failures.get(SCHEDULING_OP.DELETE_UNACTIVATED_ACCOUNT)) {
		throw new Error('Scheduling delete unactivated account was configured to fail');
	}

	return registerTask(
		() => AccountEntityMongo.delete(accountId).catch(err => console.error('Error occurred while scheduling unactivated account deletion', err)),
		whenToDelete
	);
};

const CancelScheduledUnactivatedAccountDeletionFromMongo: CancelScheduledUnactivatedAccountDeletion = async taskId => {
	if (failures.get(SCHEDULING_OP.CANCEL_DELETION_OF_UNACTIVATED_ACCOUNT)) {
		throw new Error('Canceling deletion of unactivated account was configured to fail');
	}

	const numericTaskId = Number(taskId);
	clearTimeout(scheduledTasks.get(numericTaskId)!);
	scheduledTasks.delete(numericTaskId);
};

function hasActiveTimers(): boolean {
	return scheduledTasks.size !== 0;
}

function failureWillBeGeneratedWhenScheduling(operation: SCHEDULING_OP, willBeGenerated = true): void {
	failures.set(operation, willBeGenerated);
}

function cleanUpSchedulers(): void {
	scheduledTasks.forEach(timeout => clearTimeout(timeout));
	scheduledTasks.clear();
	failures.clear();
}

export {
	ScheduleAccountEnablingFromMongo,
	ScheduleActiveUserSessionDeletionFromMongo,
	ScheduleUnactivatedAccountDeletionFromMongo,
	CancelScheduledUnactivatedAccountDeletionFromMongo,
	hasActiveTimers,
	failureWillBeGeneratedWhenScheduling,
	cleanUpSchedulers,
	SCHEDULING_OP
};
