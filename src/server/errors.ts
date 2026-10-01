import { ErrorCode } from "../shared/constants";

/** An error the client should see: a machine code plus a message fit for the error banner. */
export class ServerError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string
  ) {
    super(message);
  }
}
