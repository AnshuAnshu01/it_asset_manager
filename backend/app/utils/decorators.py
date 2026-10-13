import functools
import inspect
import time
from typing import Callable, Any
from app.utils.logger import get_logger
from app.utils.exceptions import AuthenticationError, AuthorizationError

logger = get_logger()


def measure_execution_time(func: Callable) -> Callable:
    """Decorator to measure and log execution time of methods."""
    @functools.wraps(func)
    async def async_wrapper(*args, **kwargs) -> Any:
        start_time = time.perf_counter()
        try:
            return await func(*args, **kwargs)
        finally:
            elapsed = (time.perf_counter() - start_time) * 1000
            logger.debug(f"[Execution Time] {func.__qualname__} executed in {elapsed:.2f} ms")

    @functools.wraps(func)
    def sync_wrapper(*args, **kwargs) -> Any:
        start_time = time.perf_counter()
        try:
            return func(*args, **kwargs)
        finally:
            elapsed = (time.perf_counter() - start_time) * 1000
            logger.debug(f"[Execution Time] {func.__qualname__} executed in {elapsed:.2f} ms")

    if inspect.iscoroutinefunction(func):
        return async_wrapper
    return sync_wrapper


def log_activity(action_description: str = "") -> Callable:
    """Decorator to log business actions."""
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        async def async_wrapper(*args, **kwargs) -> Any:
            desc = action_description or func.__name__
            logger.info(f"[Activity] Action: {desc} initiated")
            result = await func(*args, **kwargs)
            logger.info(f"[Activity] Action: {desc} completed successfully")
            return result

        @functools.wraps(func)
        def sync_wrapper(*args, **kwargs) -> Any:
            desc = action_description or func.__name__
            logger.info(f"[Activity] Action: {desc} initiated")
            result = func(*args, **kwargs)
            logger.info(f"[Activity] Action: {desc} completed successfully")
            return result

        if inspect.iscoroutinefunction(func):
            return async_wrapper
        return sync_wrapper
    return decorator


def login_required(func: Callable) -> Callable:
    """Decorator to verify that a current user exists in the kwargs or args."""
    @functools.wraps(func)
    def wrapper(*args, **kwargs) -> Any:
        current_user = kwargs.get("current_user")
        if not current_user:
            for arg in args:
                if hasattr(arg, "role") and hasattr(arg, "id"):
                    current_user = arg
                    break
        if not current_user:
            raise AuthenticationError("Authentication required to access this resource")
        return func(*args, **kwargs)
    return wrapper


def admin_required(func: Callable) -> Callable:
    """Decorator to verify that user has ADMIN privileges."""
    @functools.wraps(func)
    def wrapper(*args, **kwargs) -> Any:
        current_user = kwargs.get("current_user")
        if not current_user:
            for arg in args:
                if hasattr(arg, "role") and hasattr(arg, "id"):
                    current_user = arg
                    break
        if not current_user or getattr(current_user, "role", "").upper() != "ADMIN":
            raise AuthorizationError("Admin privileges required for this action")
        return func(*args, **kwargs)
    return wrapper
