import { Exception } from "@marin/lib.error";
import { Jwt, IIssuedJWTPayload } from "@marin/lib.jwt";
import { ISecurityQuestion, IFailedAuthAttempt, IModels, SecurityQuestionLanguage } from './models';
import IOptions = AuthService.IOptions;
import IAuthInput = AuthService.IAuthInput;
import IRegistrationInfo = AuthService.IRegistrationInfo;
import FORGOT_PASSWORD_STEP = AuthService.FORGOT_PASSWORD_STEP;
import IForgotPasswordVerifyIdentityInput = AuthService.IForgotPasswordVerifyIdentityInput;
import IForgotPasswordVerifySecurityQuestionsInput = AuthService.IForgotPasswordVerifySecurityQuestionsInput;
import IForgotPasswordChangePasswordInput = AuthService.IForgotPasswordChangePasswordInput;
import IForgotPasswordInitOutput = AuthService.IForgotPasswordInitOutput;
import IForgotPasswordVerifyIdentityOutput = AuthService.IForgotPasswordVerifyIdentityOutput;
import IForgotPasswordInitInput = AuthService.IForgotPasswordInitInput;
import IActiveSession = AuthService.IActiveSession;
import IChangePasswordInput = AuthService.IChangePasswordInput;
import ICredentials = AuthService.ICredentials;
import IAccessTokens = AuthService.IAccessTokens;
import IAuthOutput = AuthService.IAuthOutput;
import IRecoverAccountDataInput = AuthService.IRecoverAccountDataInput;

/** TODO remove JWT auth from dependencies when done with development */

/** TODO implement separate module for authentication or change lib.jwt-auth */
/** FIXME implement module responsible for breached passwords */
/** FIXME all input should be validated by Ajv before reaching service methods */
/** FIXME we need a global error handler which will send a generic error */
/** TODO log session lifecycle (timestamp, source IP, HTTP headers, GET and POST params, err code, msg, username) */
/** FIXME default lock account should invalidate all sessions, then lock account, then send unlock token via SMS to account owner */
/** FIXME add password validation from https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html, have max pswd len 160, dont restrict used chars, require different types */

/** Service responsible for authentication and session management */
declare class AuthService {
   /**
    * Configurable Auth Service
    *
    * @throws {Exception} When provided config is not valid
    * */
   constructor(opts: IOptions);

   /**
    * Authenticates the user using credentials provided by him.
    * Can employ two-factor authentication using TOTP token.
    *
    * The following steps are performed:
    *    - account details are loaded, if nothing found, send INVALID CREDENTIALS
    *    - invoke pre auth hook
    *    - load MFA pre sessions, and check for session with username and device id (compound primary key)
    *    - if found MFA pre session, skip password/pin check
    *    - check if password present, if so hash password, compare with stored one
    *    - otherwise check if PIN present, if so hash PIN, compare with stored one
    *    - if password is correct, load preferences for user, we are interested in MFA, and if MFA preference is set, set MFA required flag
    *    - otherwise if PIN is correct, MFA is required by default
    *    - if MFA is required, generate TOTP and create a MFA pre session in REDIS (default TTL 1h) (username, deviceId, hashed TOTP), send TOTP via SMS/email
    *    - in case of MFA pre session, verify TOTP signature and time, hash TOTP, then verify with stored one (to prevent TOTP attacks)
    *       - if TOTP is incorrect, notify user via email that suspicious activity detected at MFA step, suggest him to change password
    *    - if password/PIN and MFA are correct:
    *       - check compromised bit from account details:
    *          - if so, generate reset password token, store it in REDIS with TTL (default 10 min), and send it to user, done!
    *       - invoke post auth hook
    *    - if password/PIN are incorrect:
    *       - log this!!!
    *       - try to load unsuccessful login attempts for username (username, csv IP's, counter) from REDIS (default TTL 1h)
    *          - if not, create a new record (username, IP, 1)
    *       - if counter reached CAPTCHA threshold (default 5), require captcha
    *          - this has te be stateless (Google reCAPTCHA v3 API)
    *       - if CAPTCHA failed, increment counter, add IP to csv set
    *       - if CAPTCHA threshold reached (default 10)
    *          - invoke lock account procedure (should log this, invalidate all sessions, lock acc and send to user via SMS unlock token, then email ADMIN about this)
    *          - store csv IP's to REDIS blacklisted IP's
    *          - log record, then remove record (safe because account locked, won't reach this, next time when reach this branch record should be clean, no artifacts)
    *       - increment counter of unsuccessful attempts after checking thresholds, add IP to csv set
    *
    * @param   data           Data needed by authentication procedure
    *
    * @returns                Tokens which are used in order to interact with other services
    *                         Will return null if auth procedure completed, but no data needs to be sent to client (i.e not completed)
    * @throws {Exception | Error}      When one of the checks has been failed.
    *                                  When authentication fails due to server error.
    *
    * @access public
    */
   authenticate(data: IAuthInput): Promise<IAuthOutput>;

   /**
    * Creates reset password session
    *
    * @param username   Account username
    *
    * @returns    Reset password token
    *
    * @private    Internal method. Invoked only from auth procedure.
    */
   createResetPasswordSession(username: string): Promise<string>;

   /**
    * Completes reset of user password, by checking if provided token is valid.
    * Assumes that previously all sessions were invalidated!
    * Changes compromised flag of the account to false (this can be done even if acc was not compromised)
    * If account was compromised, password needs to be reset.
    *
    * @param data      Account credentials
    * @param token     Reset password string
    *
    * @throws {Exception}  When no token found
    *                      When provided token is not correct
    *                      When new password does not pass validation requirements
    *
    * @access public
    */
   completeResetPassword(data: IAuthInput, token: string): Promise<IAccessTokens>;

   /**
    * Registers the user using provided by him registration info.
    * Registration info has to be validated with Ajv, before being provided to this method.
    * Password needs to be stored in hashed form.
    * Mark account as being non-activated, by storing in `activated` column false.
    * Store info in `accounts` and `person` tables.
    * Send to user an email which contains activation link (which contains account_id).
    *
    * @param      info     Required info about user
    *
    * @throws {Exception | Error}      When user input is not valid
    *                                  When user is registered already
    *                                  When an error occurs on data storing (treated as a SERVER INCORRECT_CREDENTIALS)
    * @access public
    */
   register(info: IRegistrationInfo): Promise<void>;

   /**
    * Activates account after registration, via link sent in email.
    * Sets the `activated` column to true for the account id.
    * Account id is the proof that the request is legitimate (i.e. after creating only creator knows account id)
    *
    * @param accountId  Id of the account which needs to be activated
    * @param token      Activate account token sent as query param via activation link
    *
    * @throws {Exception | Error}   When account id is not valid
    *                               When storage related operation fails (treated as SERVER INCORRECT_CREDENTIALS)
    * @access public
    */
   activateAccount(accountId: number,token: string): Promise<void>;

   /**
    * Sets MFA activation status.
    *
    * @param accountId  Id of the account where this op should be applied
    * @param activate   Flag which indicates whether MFA should be used
    *
    * @throws {Error}   When storage related operation fails (treated as SERVER INCORRECT_CREDENTIALS)
    *
    * @access protected
    */
   setMFAStatus(accountId: number, activate: boolean): Promise<void>;

   /**
    * Locks the user account. No more operations can be made using this account.
    *
    * Procedure looks as follows:
    *    - log account lock
    *    - all existing sessions are invalidated (run in sandbox)
    *    - account in storage is marked as locked, no operations with this account can be made, until is unlocked
    *    - unlock token is generated, hashed and stored in REDIS (default TTL 1 hour), along with username (run in sandbox)
    *       if this operation fails, try to unlock account manually (in sandbox)
    *       if manual unlock fails, send email to DBA with error log, so he can fix it,
    *       in both cases, rethrow error, it's pointless to schedule auto-removing and sending unlock token to client
    *    - schedule a worker to unlock user account after some delay (default 1 hour) (to mitigate fact that user may loose unlock token) (run in sandbox)
    *       - will change status in users table to unlocked
    *      if scheduling fails, only user will be able to unlock account using token or customer service
    *    - send original unlock token to user via `out-of-band` channel (email or SMS, SMS is preferred)
    *    - notify ADMIN about account lock via email
    *
    * @param   accountId      Account id which needs to be locked
    * @param   userEmail      Email where unlock token should be sent
    * @param   adminEmail     Email of the admin where locked account notification should be sent
    *
    * @throws {Error}   When storage related operations failed
    *
    * @access protected
    */
   lockAccount(accountId: number, userEmail: string, adminEmail: string): Promise<void>;

   /**
    * Unlocks the user account.
    * Removes unlock token from REDIS.
    * Optionally, if possible cancel task for auto remove unlock token.
    * If can't cancel task, anyway nothing wrong will happen, worker will detect that unlock token was already removed.
    *
    * @param   token       Unlock token
    *
    * @throws {Exception | Error}   When user account is not locked.
    *                               When unlock token is not valid.
    *                               When storage related operations fails (interpreted as SERVER INCORRECT_CREDENTIALS)
    * @access public
    */
   unlockAccount(token: string): Promise<void>;

   /**
    * Change the answers for security questions.
    * Changes for questions can be made selectively (i.e can be changed only for a few questions).
    * Same validation rules are applied as when answers are stored at user registration.
    * Requires CSRF to be sent, in order to prevent Cross-Site Request Forgery attacks.
    * Requires old answers for questions, in order to prevent attacks
    *    when hacker has access to user workstation or authenticated application session.
    * Answers will be transformed to case insensitive, then hashed, then stored.
    * Method can be invoked only by authenticated user.
    *
    * @param   accountId      Account id
    * @param   jwtIat         Time when JWT was issued
    * @param   csrf           User password in plain text
    * @param   oldAnswers     Old answers per question
    * @param   newAnswers     New answers per question
    *
    * @throws  {Exception | Error}  When user password is not valid
    *                               When old answers are not valid
    *                               When new answers does not respect accepted format (such as minimal length)
    *                               When answers storing fails (treated as a SERVER INCORRECT_CREDENTIALS)
    * @access protected
    */
   changeAnswersForSecurityQuestions(accountId: number, jwtIat: number, csrf: string,
                                     oldAnswers: Map<number, string>, newAnswers: Map<number, string>): Promise<void>;

   /**
    * Changes password of the user.
    *
    * @param   data     Data required by this procedure
    *
    * @throws {Exception | Error}   When CSRF token is incorrect
    *                               When answer to user defined security question is incorrect
    *                               When old password is incorrect
    *                               When new password does not meet password requirements
    *                               When storage related operation fails (treated as SERVER INCORRECT_CREDENTIALS, not an instanceof Exception)
    * @access private
    */
   changePassword(data: IChangePasswordInput): Promise<void>;

   /**
    * Requests the identity of the user, by checking if provided credentials are correct
    * and belong to issued JWT.
    *
    * @param   accountId      Account id for which credentials are provided
    * @param   credentials    User identity credentials
    *
    * @throws {Exception | Error}   When provided credentials are not belonging to given JWT
    *                               When credentials are not correct
    *                               When storage related operation fails
    *
    * @access protected
    */
   checkIdentity(accountId: number, credentials: ICredentials): Promise<void>;

   /**
    * Defines forgot password procedure which is split in 4 steps.
    * Context between each step is persisted into storage.
    *
    * @param   step        Current step
    * @param   data        Data required by current step
    * @param   sessionId   Id of the session required by steps, except INIT step
    *
    * @returns             Payload which needs to be sent to client, in order to be able to invoke next step
    * @throws {Exception | Error}   When some of the steps are failing (error code with message are attached)
    *                               When storage related operation fails (treated as SERVER INCORRECT_CREDENTIALS, can have explicit error code, or not be instanceof Exception)
    * @access public
    */
   forgotPassword(step: FORGOT_PASSWORD_STEP,
                  data: IForgotPasswordInitInput | IForgotPasswordVerifyIdentityInput | IForgotPasswordVerifySecurityQuestionsInput
                      | IForgotPasswordChangePasswordInput,
                  sessionId?: string)
   : Promise<IForgotPasswordInitOutput | IForgotPasswordVerifyIdentityOutput>;

   /**
    * Recover account sequence:
    *    - INIT step should be employed first
    *    - on INIT step, check in REDIS if we have key with username for recover account
    *       - if found, abort procedure by throwing Exception (generic failed to recover acc)
    *    - generate TOTP (default validity 5 min), store it in REDIS (default ttl same as TOTP validity), stop procedure
    *    - CHANGE_CREDENTIALS step should be employed second
    *    - we need to have in REDIS key for recover account for username,
    *       - if not abort procedure by throwing Exception (generic failed to recover acc)
    *    - check TOTP signature and validity, check equality with REDIS stored one
    *       - if not abort procedure by throwing Exception (generic failed to recover acc)
    *    - store new password and PIN
    *    - invalidate all sessions
    *    - send success to user (he must authenticate again)
    *
    * @param data    Data required by recover account sequence
    *
    * @throws {Exception | Error}   When invalid step provided
    *                               When invalid token provided
    *                               When storage related operation fails (treated as SERVER INCORRECT_CREDENTIALS, not an instanceof Exception)
    * @returns    Status for current step
    *
    * @access private
    */
   recoverAccount(data : IRecoverAccountDataInput): Promise<boolean>;

   /**
    * Logout the user, using decoded JWT Payload.
    * Only the session attached to used JWT is invalidated.
    * After JWT is invalidated, active sessions table from storage is updated
    * (i.e record with key equals to timestamp when token was issued is removed)
    *
    * @param  payload        JWT Payload. Has to be compliant with format required by `lib.jwt-auth`
    *
    * @throws {Error}         When revoke operation from `lib.jwt-auth` fails (treated as a SERVER INCORRECT_CREDENTIALS)
    * @access protected
    */
   logout(payload: IIssuedJWTPayload): Promise<void>;

   /**
    * Logout the user from all connected devices.
    * All sessions are invalidated (i.e all jwt tokens are blacklisted)
    * All sessions for that username are removed from active sessions table.
    *
    * @param   accountId
    *
    * @throws {Error}         When purge operation from `lib.jwt-auth` fails (treated as a SERVER INCORRECT_CREDENTIALS)
    * @access protected
    */
   logoutFromAllDevices(accountId: number): Promise<void>;

   /**
    * Returns security questions mapped to their id's from the storage.
    * Usually used before register procedure,
    * in order to be able to map answers to questions for specific user in after registration info is gathered.
    *
    * @param lang    Language of the questions
    *
    * @throws {Error}      When storage related operations failed (treated as a SERVER INCORRECT_CREDENTIALS)
    *
    * @access public
    */
   getSecurityQuestions(lang: SecurityQuestionLanguage): Promise<Array<ISecurityQuestion>>;

   /**
    * Retrieves all current active sessions of the user from the persistent storage.
    *
    * @param username      Username for which search will be made
    *
    * @throws {Error}      When storage related operations failed (treated as a SERVER INCORRECT_CREDENTIALS)
    *
    * @access protected
    */
   getActiveSessions(username: string): Promise<IActiveSession>;

   /**
    * Retrieves login attempts of the user from the persistent storage.
    *
    * @param   username    Username for which search will be made
    * @param   month       Month for witch attempts should be returned (from 0 to 11)
    * @param   year        Year for that month
    *
    * @throws {Error}      When storage related operations failed (treated as a SERVER INCORRECT_CREDENTIALS)
    *
    * @access protected restricted
    */
   getFailedLoginAttempts(username: string, month: number, year: number): Promise<IFailedAuthAttempt>;
}

declare namespace AuthService {

   import IJWTAuthOpts = Jwt.IJWTAuthOpts;
   import ISignVerifyOpts = Jwt.ISignVerifyOpts;

   /** User credentials */
   interface ICredentials {
      /** Plain text username (i.e. user input) */
      username: string;
      /** Plain text password (i.e. user input) */
      password: string;
      /** Plain PIN */
      PIN?: string;
   }

   /** Tokens used in order to access protected resources and make operations with them */
   interface IAccessTokens {
      /** Authorization token */
      auth: string;
      /** CSRF token for inputs */
      csrf: string;
   }

   /** The steps involved in authentication sequence */
   const enum AUTH_STEP {
      MFA = "MFA",
      RESET_PASSWORD = "RESET_PASSWORD",
      COMPLETED = "COMPLETED"
   }

   /** Information required by authentication procedure */
   interface IAuthInput extends ICredentials {
      /** TOTP token used for completing two-factor authentication */
      TOTP?: string;
      /** IP from where request has been made */
      IP: string;
      /** Device from where the request has been made */
      device: string;
      /** Location from where request has been made */
      location: string;
      /** Recaptcha code when too many failed auth attempts */
      recaptcha?: string;
   }

   /** Defines an active session of the user */
   interface IActiveSession {
      /** When active session has began (equals with `iat` from jwt payload) (UNIX timestamp in seconds) */
      timestamp: number;
      /** To which username this session belongs */
      username: string;
      /** Device from where login was made */
      device: string;
      /** Location from where login was made */
      location: string;
      /** IP from where login REQUEST was made */
      ip: string;
      /** Flag which indicates if MFA was used */
      mfa?: boolean;
   }

   /** Output data produced by authentication sequence */
   interface IAuthOutput {
      /** Next step which needs to be performed in the authentication sequence */
      nextStep: AUTH_STEP;
      /** Output from the current step */
      payload?: IAccessTokens;
   }

   /** Information required from user in order to be registered */
   interface IRegistrationInfo extends ICredentials {
      /* Account related fields */
      /** Plain PIN */
      PIN: string;
      /** User email (main) */
      email: string;
      /** User telephone (main) */
      telephone: string;
      /** User role */
      role: string;
      /** Flag which indicates whether MFA should be used for auth */
      useMFA: boolean;

      /* Security related fields */
      userQuestion: ISecurityQuestion;
      /** Questions ids used for security purposes along with their responses (stored in case insensitive) */
      answersToSecurityQuestions: Map<number, string>;

      /* Person related fields */
      /** Birthday ISO 8601 format YYYY-MM-DD */
      birthday: string;
   }

   /** Information required from user in order to change his password */
   interface IChangePasswordInput {
      /** Account id of the user */
      accountId: number;
      /** Timestamp when token was issued */
      jwtIat: number;
      /** Plain text old password */
      oldPassword: string;
      /** Plain text new password */
      newPassword: string;
      /** CSRF token */
      csrf: string;
      /** Answer to user defined security question */
      userQuestion: ISecurityQuestion;
   }

   /** The steps involved in the forgot password sequence */
   const enum FORGOT_PASSWORD_STEP {
      CREATE_SESSION = 'CREATE_SESSION',
      VERIFY_IDENTITY = "VERIFY_IDENTITY",
      VERIFY_SECURITY_QUESTIONS = "VERIFY_SECURITY_QUESTIONS",
      CHANGE_PASSWORD = "CHANGE_PASSWORD"
   }

   /** Data required in order to create forgot password procedure */
   interface IForgotPasswordInitInput {
      /** Username for which forgot password procedure needs to be created */
      username: string;
      /** IP from Request has been made */
      IP: string;
   }

   /** Payload which needs to be sent to client after INIT step completed */
   interface IForgotPasswordInitOutput {
      /** Id of the forgot password session (not hashed) */
      sessionId: string;
   }

   /** Identity data required by forgot password sequence */
   interface IForgotPasswordVerifyIdentityInput {
      /** User identity */
      identity: {
         firstName: string;
         lastName: string;
         birthday: string;
         lastFourOfSSN: string;
         zipCode: string;
         streetNo: number;
      };

      /** The language in which canned questions should be returned to client */
      language: SecurityQuestionLanguage;
   }

   /** Payload which needs to be sent to client after VERIFY_IDENTITY step completed */
   interface IForgotPasswordVerifyIdentityOutput {
      /** Questions for which answers needs to be sent */
      questions: Array<ISecurityQuestion>;
   }

   /** Answers to security questions required by forgot password sequence */
   interface IForgotPasswordVerifySecurityQuestionsInput {
      /** Answers to questions sent before */
      answers: Map<number, string>;
   }

   /** New password required by forgot password sequence */
   interface IForgotPasswordChangePasswordInput {
      /** New password as plain text */
      password: string;
   }

   /** The steps involved in the recover account sequence */
   const enum RECOVER_ACCOUNT_STEP {
      INIT = "INIT",
      CHANGE_CREDENTIALS = "CHANGE_CREDENTIALS"
   }

   /** Information required by recover account sequence */
   interface IRecoverAccountDataInput {
      /** Step which needs to take place */
      step: RECOVER_ACCOUNT_STEP,
      /** Data required by this step */
      payload: {
         /** Recover account token */
         token?: string;
         /** New credentials after successful recovery */
         credentials: ICredentials;
      };
   }

   /** Config used in order to interact with `lib.jwt-auth` */
   interface IOptionsJwt {
      /** Configured instance of the Jwt manager */
      instance: Jwt,
      /** Issuer of the token (usually it's the application or domain of the app ) */
      issuer: string;
      /** Defines expiration for tokens without roles */
      expiration?: number;
      /**
       * Defines expiration for tokens per user roles.
       * If missing assuming @all expiration was configured in Jwt manager instance for issuing */
      rolesExpiration?: Map<string, number>
   }

   /** Config used for email sending */
   interface IOptionsEmail {
      /** Email of the admin */
      admin: string;
   }

   /** Secrets used by the service */
   interface IOptionsSecrets {
      /** Used to sign TOTP */
      totp: string;
      /** Google Recaptcha v3 secret key */
      recaptcha: string;
      /** Pepper used for password hashing */
      pepper: string;
   }

   /** TTL used for different temporary stored information */
   interface IOptionsTTL {
      /** How many minutes failed auth attempt session should be kept */
      failedAuthAttemptSession?: number;
      /** How many minutes banned IP's should be kept */
      bannedIP?: number;
      /** How many minutes reset password token should be kept */
      resetPasswordToken?: number;
      /** How many seconds MFA session TOTP token should be kept */
      totp?: number;
      /** How many minutes unlock account session should be kept */
      unlockAccount?: number;
      /** How many minutes identity token should be kept */
      identityToken?: number;
      /** How many minutes forgot password session should be kept */
      forgotPasswordSession?: number;
      /** How many minutes keep recaptcha flag */
      recaptcha?: number;
      /** How many minutes activate account token should be kept */
      activateAccountSession?: number;
   }

   /** Defines hard limits used by different operations */
   interface IOptionsThresholds {
      /** Max amount of guesses in forgot password procedure */
      forgotPasswordGuesses?: number;
      /** When CAPTCHA should be used */
      captcha?: number;
      /** When account should be locked, and IP's banned */
      failedAuthAttempts?: number;
      /** When password should be considered as breached (value of breach counter from API) */
      breachPassword?: number;
   }

   /** Defines size for tokens and other lengths */
   interface IOptionsSizes {
      /** How long salt used for password hashing should be (in bytes) */
      salt?: number;
      /** How long tokens should be (in bytes) */
      token?: number;
   }

   /** Operations which are schedules by Auth Service */
   interface IOptionsSchedulers {
      session: {
         delete: (id: number, when: number) => Promise<string>;
      }
      account: {
         delete: (id: number) => Promise<string>;
         cancel: (taskId: string) => Promise<void>;
      }
   }

   /** Options used to configure auth service */
   interface IOptions {
      /** Config used in order to interact with `lib.jwt-auth` */
      jwt: IOptionsJwt;
      /** Config used for email sending */
      email: IOptionsEmail;
      /** Secrets used by the service */
      secrets: IOptionsSecrets;
      /** TTL used for different temporary stored information */
      ttl?: IOptionsTTL;
      /** Defines hard limits used by different operations */
      thresholds?: IOptionsThresholds;
      /** Defines size for tokens and other lengths */
      size?: IOptionsSizes;
      /** Operations which are schedules by Auth Service */
      schedulers: IOptionsSchedulers;
      /** Persistent storage accessors, so auth service can be aware of underlying storage and models */
      models: IModels;
   }
}

/**
 * Unlocks user account, by turning off locked flag.
 * If unlock fails, email DBA about failure, don't rethrow error
 *
 * @param   username    Account which needs to be unlocked
 */
declare function unlockAccountInternal(username: string): Promise<void>;

export { AuthService };
