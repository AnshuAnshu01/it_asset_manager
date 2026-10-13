import re
from typing import Tuple, List

VALID_ROLES = {"ADMIN", "SUPPORT", "EMPLOYEE"}
VALID_ASSET_STATUSES = {"AVAILABLE", "ASSIGNED", "UNDER_REPAIR", "RETIRED", "LOST"}
VALID_CATEGORIES = {"Hardware", "Software", "Network", "Access", "Other"}
VALID_PRIORITIES = {"LOW", "MEDIUM", "HIGH", "CRITICAL"}
VALID_TICKET_STATUSES = {"OPEN", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "CLOSED"}

EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$")
SERIAL_REGEX = re.compile(r"^[A-Z0-9-]{4,20}$", re.IGNORECASE)

CATEGORY_PATTERNS = {
    "Hardware": [
        r"\b(laptop|monitor|screen|keyboard|mouse|printer|hardware|battery|charger|ram|disk|hard\s*drive|motherboard|fan|overheating|not\s*starting|won'?t\s*turn\s*on|power)\b"
    ],
    "Software": [
        r"\b(software|windows|os|linux|mac|excel|office|teams|slack|zoom|install|update|upgrade|crash|crashing|bug|glitch|blue\s*screen|bsod|application)\b"
    ],
    "Network": [
        r"\b(network|wifi|wi-fi|internet|ethernet|vpn|lan|dns|ip|connection|disconnecting|offline|slow\s*internet|router)\b"
    ],
    "Access": [
        r"\b(access|password|reset|login|permission|account|locked|unlock|credentials|mfa|2fa|sso|authorized|denied)\b"
    ],
}

PRIORITY_PATTERNS = {
    "CRITICAL": [
        r"\b(critical|urgent|emergency|production|down|outage|entire\s*team|data\s*loss|security\s*breach|immediately)\b"
    ],
    "HIGH": [
        r"\b(high|blocking|broken|cannot\s*work|not\s*starting|dead|unusable|failed|cannot\s*boot)\b"
    ],
    "MEDIUM": [
        r"\b(medium|slow|intermittent|glitch|warning|needs\s*replacement|performance)\b"
    ],
    "LOW": [
        r"\b(low|query|inquiry|minor|cosmetic|request|info|question|how\s*to)\b"
    ],
}


def validate_password(password: str) -> bool:
    pattern = (
        r"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)"
        r"(?=.*[^A-Za-z0-9]).{8,16}$"
    )
    return bool(re.match(pattern, password))


def validate_role(role: str) -> bool:
    return role.upper() in VALID_ROLES


def validate_email(email: str) -> bool:
    if not email:
        return False
    return bool(EMAIL_REGEX.match(email.strip()))


def validate_serial_number(serial: str) -> bool:
    if not serial:
        return False
    return bool(SERIAL_REGEX.match(serial.strip()))


def classify_ticket(title: str, description: str) -> Tuple[str, str]:
    combined_text = f"{title or ''} {description or ''}".lower()

    matched_categories: List[Tuple[str, int]] = []
    for category, patterns in CATEGORY_PATTERNS.items():
        matches = [re.findall(p, combined_text, re.IGNORECASE) for p in patterns]
        match_count = sum(len(m) for m in matches)
        if match_count > 0:
            matched_categories.append((category, match_count))

    if matched_categories:
        sorted_categories = sorted(matched_categories, key=lambda x: x[1], reverse=True)
        detected_category = sorted_categories[0][0]
    else:
        detected_category = "Other"

    detected_priority = "MEDIUM"
    for priority in ["CRITICAL", "HIGH", "LOW"]:
        patterns = PRIORITY_PATTERNS[priority]
        matches = list(filter(lambda p: bool(re.search(p, combined_text, re.IGNORECASE)), patterns))
        if matches:
            detected_priority = priority
            break

    return detected_category, detected_priority
