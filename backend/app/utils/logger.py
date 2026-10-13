import logging
import sys
from pathlib import Path
from app.config import LOG_LEVEL


class AppLoggerSingleton:
    """Singleton pattern implementation for application-wide logging."""
    _instance = None
    _logger = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(AppLoggerSingleton, cls).__new__(cls)
            cls._instance._setup_logger()
        return cls._instance

    def _setup_logger(self):
        self._logger = logging.getLogger("it_asset_manager")
        level = getattr(logging, LOG_LEVEL.upper(), logging.INFO)
        self._logger.setLevel(level)

        if not self._logger.handlers:
            log_format = logging.Formatter(
                "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
                datefmt="%Y-%m-%d %H:%M:%S",
            )

            # Console handler
            console_handler = logging.StreamHandler(sys.stdout)
            console_handler.setFormatter(log_format)
            self._logger.addHandler(console_handler)

            # Optional file handler in logs directory
            logs_dir = Path("logs")
            try:
                logs_dir.mkdir(exist_ok=True)
                file_handler = logging.FileHandler(logs_dir / "app.log", encoding="utf-8")
                file_handler.setFormatter(log_format)
                self._logger.addHandler(file_handler)
            except Exception:
                pass  # Fall back to console only if directory permission denied

    @property
    def logger(self) -> logging.Logger:
        return self._logger


def get_logger() -> logging.Logger:
    """Helper to fetch the singleton logger."""
    return AppLoggerSingleton().logger
