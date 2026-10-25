from typing import Any

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import ValidationError


class AppError(Exception):
    """Base for errors that map to the standard error envelope."""

    code = "error"
    status = 500

    def __init__(self, message: str, details: Any = None) -> None:
        super().__init__(message)
        self.message = message
        self.details = details


class NotFound(AppError):
    code = "not_found"
    status = 404


class InvalidFilter(AppError):
    code = "invalid_filter"
    status = 400


class UnknownCommand(AppError):
    code = "unknown_command"
    status = 404


class UnknownCompute(AppError):
    code = "unknown_compute"
    status = 404


class InvalidAssumptions(AppError):
    code = "invalid_assumptions"
    status = 422


class Unauthorized(AppError):
    code = "unauthorized"
    status = 401


class JobFinished(AppError):
    code = "job_finished"
    status = 409


class NotImplementedYet(AppError):
    code = "not_implemented"
    status = 501


class InvalidInput(AppError):
    code = "validation_error"
    status = 422

    @classmethod
    def from_pydantic(cls, exc: ValidationError) -> "InvalidInput":
        details = exc.errors(include_url=False, include_context=False, include_input=False)
        message = "; ".join(f"{'.'.join(map(str, e['loc']))}: {e['msg']}" for e in details)
        return cls(message or "Validation failed", details)


def error_response(status: int, code: str, message: str, details: Any = None) -> JSONResponse:
    """Build the standard `{"error": {...}}` response."""
    body: dict[str, Any] = {"code": code, "message": message}
    if details is not None:
        body["details"] = details
    return JSONResponse(status_code=status, content={"error": jsonable_encoder(body)})


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app_error(_: Request, exc: AppError) -> JSONResponse:
        return error_response(exc.status, exc.code, exc.message, exc.details)

    @app.exception_handler(RequestValidationError)
    async def _validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
        return error_response(422, "validation_error", "Request validation failed", exc.errors())
