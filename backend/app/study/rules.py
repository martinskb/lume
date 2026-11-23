"""Regras puras de pontuação e meta."""
from datetime import UTC, date, datetime
from zoneinfo import ZoneInfo

BELEM = ZoneInfo("America/Belem")

POINTS_PER_SESSION = 10
MIN_SCORED_SECONDS = 20 * 60
MAX_SCORED_PER_DAY = 3


def points_for_session(active_seconds: int, scored_today: int) -> int:
    if active_seconds >= MIN_SCORED_SECONDS and scored_today < MAX_SCORED_PER_DAY:
        return POINTS_PER_SESSION
    return 0


def goal_met(active_seconds: int, goal_minutes: int) -> bool:
    return active_seconds >= goal_minutes * 60


def study_day(ended_at: datetime) -> date:
    """Dia (em Belém) em que a sessão terminou. Datetime sem fuso é tratado como UTC."""
    if ended_at.tzinfo is None:
        ended_at = ended_at.replace(tzinfo=UTC)
    return ended_at.astimezone(BELEM).date()


def today_belem() -> date:
    return datetime.now(BELEM).date()
