import type { DeviceBase, SessionId, UserSessionMetaData, UserSessionOperationContext } from './session';

/**
 * Hook called on user session read from external storage.
 *
 * @param subject			Subject.
 * @param sessionId			Session id.
 * @param context			Read user session operation context.
 * @param sessionMetaData	Session metadata that was retrieved from storage.
 *
 * @throws 	In case some anomalies are detected between read context and session metadata,
 * 			an exception should be thrown to stop read operation and mark session access as invalid.
 */
type ReadUserSessionHook<
	Device extends DeviceBase,
	Location,
	MetaData extends UserSessionMetaData<Device, Location> = UserSessionMetaData<Device, Location>
> = (subject: string, sessionId: SessionId, context: UserSessionOperationContext<Device, Location>, sessionMetaData: Readonly<MetaData>) => void;

export { ReadUserSessionHook };
