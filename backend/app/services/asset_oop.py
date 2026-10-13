"""OOP-based Asset Management hierarchy demonstrating Inheritance, Encapsulation,
Polymorphism, and Composition as required by Section 4.
"""
from abc import ABC, abstractmethod
from datetime import date
from typing import Dict, Any


class Specification:
    """Composition component: Encapsulates hardware/technical specifications."""
    def __init__(self, details: Dict[str, Any] = None):
        self._details = details or {}

    def get_detail(self, key: str, default: Any = None) -> Any:
        return self._details.get(key, default)

    def set_detail(self, key: str, value: Any) -> None:
        self._details[key] = value

    def to_dict(self) -> Dict[str, Any]:
        return dict(self._details)


class BaseAssetOOP(ABC):
    """
    Base Asset Class demonstrating Encapsulation and Abstraction.
    """
    def __init__(
        self,
        asset_id: str,
        brand: str,
        model: str,
        serial_number: str,
        purchase_date: date,
        status: str = "AVAILABLE",
        specifications: Dict[str, Any] = None,
    ):
        self._asset_id = asset_id
        self._brand = brand
        self._model = model
        self.__serial_number = serial_number  # Private attribute (encapsulation)
        self._purchase_date = purchase_date
        self._status = status
        # Composition: Asset HAS-A Specification
        self._specs = Specification(specifications)

    @property
    def asset_id(self) -> str:
        return self._asset_id

    @property
    def brand(self) -> str:
        return self._brand

    @property
    def model(self) -> str:
        return self._model

    @property
    def serial_number(self) -> str:
        return self.__serial_number

    @property
    def status(self) -> str:
        return self._status

    @status.setter
    def status(self, new_status: str) -> None:
        valid_statuses = {"AVAILABLE", "ASSIGNED", "UNDER_REPAIR", "RETIRED", "LOST"}
        if new_status.upper() not in valid_statuses:
            raise ValueError(f"Invalid status {new_status}")
        self._status = new_status.upper()

    @property
    def specs(self) -> Specification:
        return self._specs

    @abstractmethod
    def get_maintenance_interval_days(self) -> int:
        """Polymorphic method implemented differently by each child asset."""
        pass

    @abstractmethod
    def run_diagnostics(self) -> Dict[str, str]:
        """Polymorphic diagnostic check."""
        pass

    def get_summary(self) -> Dict[str, Any]:
        """Polymorphic summary dict."""
        return {
            "asset_id": self._asset_id,
            "type": self.__class__.__name__,
            "brand": self._brand,
            "model": self._model,
            "status": self._status,
            "maintenance_interval_days": self.get_maintenance_interval_days(),
            "specs": self._specs.to_dict(),
        }


class Laptop(BaseAssetOOP):
    """Child class inheriting from BaseAssetOOP."""
    def __init__(self, asset_id: str, brand: str, model: str, serial_number: str,
                 purchase_date: date, ram_gb: int = 16, cpu: str = "i7", **kwargs):
        super().__init__(asset_id, brand, model, serial_number, purchase_date, **kwargs)
        self.specs.set_detail("ram_gb", ram_gb)
        self.specs.set_detail("cpu", cpu)

    def get_maintenance_interval_days(self) -> int:
        return 180  # Laptops checked every 6 months

    def run_diagnostics(self) -> Dict[str, str]:
        return {
            "battery_health": "95%",
            "thermal_status": "Normal",
            "os_health": "Optimal"
        }


class Monitor(BaseAssetOOP):
    def __init__(self, asset_id: str, brand: str, model: str, serial_number: str,
                 purchase_date: date, screen_size_inches: int = 27, **kwargs):
        super().__init__(asset_id, brand, model, serial_number, purchase_date, **kwargs)
        self.specs.set_detail("screen_size_inches", screen_size_inches)

    def get_maintenance_interval_days(self) -> int:
        return 365  # Monitors checked yearly

    def run_diagnostics(self) -> Dict[str, str]:
        return {"dead_pixels": "None", "backlight_status": "OK"}


class Keyboard(BaseAssetOOP):
    def get_maintenance_interval_days(self) -> int:
        return 365

    def run_diagnostics(self) -> Dict[str, str]:
        return {"key_switch_response": "100%", "cable_status": "Intact"}


class Mouse(BaseAssetOOP):
    def get_maintenance_interval_days(self) -> int:
        return 365

    def run_diagnostics(self) -> Dict[str, str]:
        return {"sensor_precision": "Optimal", "click_actuation": "Good"}


class Printer(BaseAssetOOP):
    def __init__(self, asset_id: str, brand: str, model: str, serial_number: str,
                 purchase_date: date, is_color: bool = True, **kwargs):
        super().__init__(asset_id, brand, model, serial_number, purchase_date, **kwargs)
        self.specs.set_detail("is_color", is_color)

    def get_maintenance_interval_days(self) -> int:
        return 90  # Printers need frequent maintenance

    def run_diagnostics(self) -> Dict[str, str]:
        return {"toner_level": "80%", "paper_roller_status": "Good"}


def create_asset_oop_instance(asset_type: str, **kwargs) -> BaseAssetOOP:
    """Factory function demonstrating polymorphism."""
    mapping = {
        "Laptop": Laptop,
        "Monitor": Monitor,
        "Keyboard": Keyboard,
        "Mouse": Mouse,
        "Printer": Printer,
    }
    asset_cls = mapping.get(asset_type, Laptop)
    return asset_cls(**kwargs)
