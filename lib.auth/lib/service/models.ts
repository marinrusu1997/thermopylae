import Optional from 'optional-js';

interface IAuthSessionEntity {
    create: (id: string, session: string, ttl: number) => Promise<void>;
    readById: (id: string) => Promise<Optional<string>>;
    update: (id: string, session: string) => Promise<void>;
    delete: (id: string) => Promise<number>;
}

interface IAccountEntity {
    create: (account: IAccount) => Promise<IAccount>;
    read: (username: string) => Promise<Optional<IAccount>>;
    readById: (id: number) => Promise<IAccount | null>;
    update: (account: IAccount) => Promise<void>;
    delete: (id: number) => Promise<number>;
    activate: (id: number) => Promise<void>;
    changePassword: (id: number, password: string) => Promise<void>;
    changePIN: (id: number, pin: number) => Promise<void>;
    rehabilitate: (id: number, newPasswordHash: string) => Promise<void>;
    setLocked: (id: number, locked: boolean) => Promise<void>;
    setMFA: (id: number, required: boolean) => Promise<void>;
}

interface ISessionEntity {
    create: (session: ISession) => Promise<void>;
    read: (username: string) => Promise<Array<ISession>>;
    readById: (timestamp: number) => Promise<ISession | null>;
    deleteOne: (timestamp: number) => Promise<number>;
    deleteAll: (accountId: number) => Promise<number>;
}

interface IMfaSessionOperations {
    create: (session: IMFASession, ttl: number) => Promise<void>;
    read: (username: string, deviceId: string) => Promise<IMFASession | null>;
    updateTOTP: (username: string, deviceId: string, totp: string) => Promise<void>;
}

interface IAuthAccessPointOperations {
    create: (accessPoint: IAuthAccessPoint) => Promise<void>;
    read: (username: string) => Promise<Array<IAuthAccessPoint>>;
    delete: (id: number) => Promise<number>;
}

interface IBannedIpEntity {
    create: (username: string, ip: Array<string>, ttl: number) => Promise<void>;
    read: (username: string) => Promise<Array<string>>;
}

interface IRecaptchaOperations {
    create: (username: string, ttl: number) => Promise<void>;
    read: (username: string) => Promise<boolean | null>;
    delete: (username: string) => Promise<number>;
}

interface IResetPasswordSessionOperations {
    create: (username: string, token: string, ttl: number) => Promise<void>;
    read: (username: string) => Promise<string | null>;
    delete: (username: string) => Promise<number>;
}

interface IFailedAuthAttemptSessionOperations {
    create: (attempt: IFailedAuthAttempt, ttl: number) => Promise<void>;
    read: (username: string) => Promise<IFailedAuthAttempt | null>;
    update: (attempt: IFailedAuthAttempt) => Promise<void>;
    delete: (username: string) => Promise<IFailedAuthAttempt>;
}

interface IFailedAuthAttemptEntity {
    create: (attempt: IFailedAuthAttempt) => Promise<void>;
    read: (username: string, beginDate: number, endDate: number) => Promise<Array<IFailedAuthAttempt>>;
}

interface IActivateAccountSessionOperations {
    create: (accountId: number, info: IActivateAccount, ttl: number) => Promise<void>;
    read: (accountId: number) => Promise<IActivateAccount>;
    delete: (accountId: number) => Promise<void>;
}

interface IUnlockAccountSessionOperations {
    create: (token: string, accountId: number, ttl: number) => Promise<void>;
    read: (token: string) => Promise<number | null>;
    delete: (token: string) => Promise<void>;
}

interface IPersonOperations {
    create: (person: IPerson) => Promise<void>;
    read: (accountId: number) => Promise<IPerson>;
}

interface ISecurityQuestionsOperations {
    setQuestion: (accountId: number, question: string, answerHash: string) => Promise<number>;
    setAnswers: (accountId: number, answers: Map<number, string>) => Promise<void>;
    readQuestions: (authorId: number | string, lang?: SecurityQuestionLanguage) => Promise<Array<ISecurityQuestion>>;
    readAnswers: (accountId: number) => Promise<Map<number, string>>;
    readAnswer: (accountId: number, questionId: number) => Promise<string | null>;
}

interface IForgotPasswordSessionOperations {
    create: (session: IForgotPasswordSession, ttl: number) => Promise<void>;
    readById: (id: string) => Promise<IForgotPasswordSession | null>;
    update: (id: string, session: IForgotPasswordSession) => Promise<void>;
    delete: (id: string) => Promise<number>;
}

interface IRecoverAccountSessionOperations {
    create: (username: string, session: IRecoverAccountSession) => Promise<void>;
    read: (username: string) => Promise<IRecoverAccountSession | null>;
}

/** Config used by AuthService in order to access the data from a persistent storage */
interface IModels {
    account: IAccountEntity;
    session: ISessionEntity;
    authSession: IAuthSession;
    mfaSession: IMfaSessionOperations; /** TODO remove */
    authAccessPoint: IAuthAccessPointOperations;
    bannedIP: IBannedIpEntity;
    recaptcha: IRecaptchaOperations;
    resetPasswordSession: IResetPasswordSessionOperations;
    failedAuthAttemptSession: IFailedAuthAttemptSessionOperations;
    failedAuthAttempt: IFailedAuthAttemptEntity;
    activateAccountSession: IActivateAccountSessionOperations;
    unlockAccountSession: IUnlockAccountSessionOperations;
    person: IPersonOperations;
    securityQuestions: ISecurityQuestionsOperations;
    forgotPasswordSession: IForgotPasswordSessionOperations;
    recoverAccountSession: IRecoverAccountSessionOperations;
}

/** Describes account entity */
interface IAccount {
    id?: number;
    username: string;
    password: string;
    pin: string;
    salt: string;
	email: string;
	telephone: string;
	role: string;
    activated: boolean;
    locked: boolean;
    compromised: boolean;
    mfa: boolean;
}

/** Describes MFA session entity */
interface IMFASession {
    username: string;
    deviceId: string;
    totp: string;
}

/** Describes session of authentication procedure */
interface IAuthSession {
    id: string;
}

/** Describes established session entity */
interface ISession {
    /** When active session has began (equals with `iat` from jwt payload) (UNIX timestamp in seconds) */
    timestamp: number;
    /** To which username this session belongs */
    accountId: number;
    /** IP from where login REQUEST was made */
    ip: string;
    /** Device from where login was made */
    device: string;
    /** Location from where login was made */
    location: string;
    /** CSRF token */
    csrf: string;
    /** Flag which indicates if MFA was used */
    mfa?: boolean;
}

/** Describes an entry point from where authentication has been made */
interface IAuthAccessPoint {
    id?: number;
    username: string;
    device: string;
    ip: string;
}

const enum SecurityQuestionLanguage {
    EN,
    RO
}

/** Secret question format exchanged between client and server */
interface ISecurityQuestion {
    /** Id of stored question */
    id?: number;
    /** Textual representation of the question */
    text: string;
    /** Textual representation of the answer */
    answer?: string;
    /** Hashed representation of the answer */
    answerHash?: string;
    /** Id of the author of the question */
    authorId?: number;
    /** Language of the question */
    lang: SecurityQuestionLanguage;
}

/** Describes an activate account session */
interface IActivateAccount {
    /** Activate account token */
    token: string;
    /** Delete account task id */
    taskId: string;
}

/** Describes an auth attempt that has been failed */
interface IFailedAuthAttempt {
    /** Username used for login */
    username: string;
    /** When attempt was made (UNIX timestamp in seconds) */
    timestamp: number;
    /** Device from where attempt was made */
    device: string;
    /** Location from where attempt was made */
    location: string;
    /** IP from where REQUEST was made */
    ip: string;
    /** How many failed attempts were before */
    counter: number;
}

/** Describes a person entity */
interface IPerson {
    /** Person ID */
    id?: number;
    /** To which account this person belongs */
    accountId: number;
    firstName: string;
    lastName: string;
    ssn: string;
    zipCode: string;
    address: {
        cityName: string;
        streetName: string;
        streetNo: number;
        blockNo: number;
        apartmentNo: number;
    };
    /** Birthday ISO 8601 format YYYY-MM-DD */
    birthday: string;
    /* FIXME add more fields depending on app business logic */
}

/** Describes a forgot password session */
interface IForgotPasswordSession {
    /** Forgot session token */
    id: string;
    /** Username for which password has been forgotten */
    accountId: number;
    /** Account email */
    email: string;
    /** IP from where Request has been made */
    ip: string;
    /** Identity step has been passed */
    identityStep: boolean;
    /** Questions sent after identity step */
    questions: Array<number>;
    /** Answers to security questions step has been passed */
    answersStep: boolean;
    /** How many times answers were tried to be guessed */
    guessCounter: number;
}

/** Describes a recover account session */
interface IRecoverAccountSession {
    token: string;
    totp: number;
}

export {
    IModels,
    IAccount,
    SecurityQuestionLanguage,
    ISecurityQuestion,
    IFailedAuthAttempt
}
