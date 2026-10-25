export class AgentError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

/** A tool failed in a way the agent or job runner should report, not crash on. */
export class ToolError extends AgentError {}

export class MissingKeyError extends AgentError {
  constructor(variable: string) {
    super("missing_key", `${variable} is not set`);
  }
}

export class CallbackError extends AgentError {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super("callback_failed", message);
  }
}
