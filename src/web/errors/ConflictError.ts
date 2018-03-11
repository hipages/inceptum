import HttpError from '../HttpError';

/**
 * 409 Conflict
 * The request could not be completed due to a conflict with the current state of the resource.
 * This code is only allowed in situations where it is expected that the user might be able to resolve
 * the conflict and resubmit the request.
 */
export class ConflictError extends HttpError {

    constructor(message: string, cause?: Error) {
        super(409, message, cause);
    }
}
