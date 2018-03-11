import HttpError from '../HttpError';

/**
 * 422 Unprocessable Entity
 * The 422 (Unprocessable Entity) status code means the server understands the content type of the request entity
 * (hence a 415(Unsupported Media Type) status code is inappropriate), and the syntax of the request entity is correct
 * (thus a 400 (Bad Request) status code is inappropriate) but was unable to process the contained instructions.
 */
export class UnprocessableEntityError extends HttpError {

    constructor(message: string, cause?: Error) {
        super(422, message, cause);
    }
}
