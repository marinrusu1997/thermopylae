/**
 * Hook called when an error happens on email transporter.
 *
 * @param err Error that occurred.
 */
type OnTransportError = (err: Error) => void;

/** Hook called when email transporter is idle. */
type OnTransportIdle = () => void;

export type { OnTransportError, OnTransportIdle };
