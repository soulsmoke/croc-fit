"""Custom exceptions for CrocFit API."""


class AppError(Exception):
    """Base application error."""

    def __init__(self, message: str, code: str, status_code: int = 500) -> None:
        """Initialise AppError with message, error code and HTTP status."""
        self.message = message
        self.code = code
        self.status_code = status_code
        super().__init__(message)


class NotFoundError(AppError):
    """Resource not found."""

    def __init__(self, resource: str, resource_id: str) -> None:
        """Raise when a resource cannot be found."""
        super().__init__(f"{resource} {resource_id} not found", "NOT_FOUND", 404)


class ValidationError(AppError):
    """Input validation failure."""

    def __init__(self, message: str) -> None:
        """Raise when input validation fails."""
        super().__init__(message, "VALIDATION_ERROR", 422)


class AuthError(AppError):
    """Authentication / authorisation failure."""

    def __init__(self, message: str = "Unauthorized") -> None:
        """Raise when authentication fails."""
        super().__init__(message, "AUTH_ERROR", 401)


class UploadError(AppError):
    """File upload validation failure."""

    def __init__(self, message: str) -> None:
        """Raise when file upload validation fails."""
        super().__init__(message, "UPLOAD_ERROR", 400)
