import HttpError from '../HttpError';

/**
 * 404 Not Found
 * The server has not found anything matching the Request-URI.
 * No indication is given of whether the condition is temporary or permanent.
 */
export class NotFoundError extends HttpError {

    constructor(message: string, cause?: Error) {
        super(404, message, cause);
    }
}
