import * as TransportStream from "winston-transport";

declare interface IAbstractLogsTransportManager {
    /**
     * This method will return a transport.
     * If no transports configured, null will be returned.
     * Implementations are permitted to not support system loggers support.
     *
     * @param   system     The name of the system/service
     */
    get: (system: string) => TransportStream | null;
}

export {
    IAbstractLogsTransportManager
}
