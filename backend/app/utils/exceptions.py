class ITAssetManagerError(Exception):
    """Base exception for all domain errors."""
    def __init__(self, message: str = "IT Asset Management domain error", status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class InvalidAssetError(ITAssetManagerError):
    def __init__(self, message: str = "Invalid asset specification or operation"):
        super().__init__(message, status_code=400)


class InvalidTicketError(ITAssetManagerError):
    def __init__(self, message: str = "Invalid ticket specification or operation"):
        super().__init__(message, status_code=400)


class InvalidStatusTransitionError(ITAssetManagerError):
    def __init__(self, message: str = "Illegal ticket or asset status transition"):
        super().__init__(message, status_code=409)


class SLAConfigurationError(ITAssetManagerError):
    def __init__(self, message: str = "Invalid SLA configuration or calculation"):
        super().__init__(message, status_code=400)


class DatabaseConnectionError(ITAssetManagerError):
    def __init__(self, message: str = "Database connection or transaction failure"):
        super().__init__(message, status_code=500)


class AuthenticationError(ITAssetManagerError):
    def __init__(self, message: str = "Invalid credentials"):
        super().__init__(message, status_code=401)


class AuthorizationError(ITAssetManagerError):
    def __init__(self, message: str = "Permission denied"):
        super().__init__(message, status_code=403)


class ResourceNotFoundError(ITAssetManagerError):
    def __init__(self, message: str = "Resource not found"):
        super().__init__(message, status_code=404)
