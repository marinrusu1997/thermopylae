/** Error Codes used for `Exception` constructor */
const ErrorCodes = {
	INVALID_ARGUMENT: 'INVALID_ARGUMENT',
	INVALID_STEP: 'INVALID_STEP',
	INVALID_CONFIG: 'INVALID_CONFIG',
	INVALID_REQUEST: 'INVALID_REQUEST',
	INVALID_CONTEXT: 'INVALID_CONTEXT',

	ILLEGAL_ARGUMENT: 'ILLEGAL_ARGUMENT',

	NOT_INITIALIZED: 'NOT_INITIALIZED',
	NOT_ACTIVATED: 'NOT_ACTIVATED',
	NOT_DELIVERED: 'NOT_DELIVERED',
	NOT_FOUND: 'NOT_FOUND',
	NOT_SUPPORTED: 'NOT_SUPPORTED',

	RESOURCE_REQUIRED: 'RESOURCE_REQUIRED',

	ALREADY_INITIALIZED: 'ALREADY_INITIALIZED',
	ALREADY_REGISTERED: 'ALREADY_REGISTERED',

	CREATE_RESOURCE_FAILED: 'CREATE_SESSION_FAILED',
	READ_RESOURCE_FAILED: 'READ_RESOURCE_FAILED',
	UPDATE_RESOURCE_FAILED: 'UPDATE_RESOURCE_FAILED',
	DELETE_RESOURCE_FAILED: 'DELETE_RESOURCE_FAILED',

	CHECKING_FAILED: 'CHECKING_FAILED',
	REQUEST_FAILED: 'REQUEST_FAILED'
};

/** Default Error Messages for Error Codes */
const ErrorMessages = {
	INVALID_ARGUMENT: 'Invalid argument received',
	INVALID_STEP: 'Invalid step',
	INVALID_CONFIG: 'Provided configuration is not valid',
	INVALID_REQUEST: 'Request is not valid in current context',
	INVALID_CONTEXT: "Operation cann't be continued because of the invalid context",

	ILLEGAL_ARGUMENT: 'Provided argument is illegal',

	NOT_INITIALIZED: 'Needs to be initialized before usage',
	NOT_ACTIVATED: 'The resource is not activated',
	NOT_DELIVERED: 'Message was not delivered',
	NOT_FOUND: 'Resource not found',
	NOT_SUPPORTED: 'Operation is not supported',

	RESOURCE_REQUIRED: 'Additional resource is needed in order to be continue operation',

	ALREADY_INITIALIZED: 'Instance is already initialized',
	ALREADY_REGISTERED: 'Already registered',

	CREATE_RESOURCE_FAILED: "Resource can't be created",
	READ_RESOURCE_FAILED: "Resource can't be read",
	UPDATE_RESOURCE_FAILED: "Resource can't be udpated",
	DELETE_RESOURCE_FAILED: "Resource can't be deleted",

	CHECKING_FAILED: 'Checking  failed',
	REQUEST_FAILED: 'Request failed'
};

export { ErrorCodes, ErrorMessages };
