from sqlalchemy import func, select

from app.models import StudySession, User
from scripts.seed_demo_users import DEMO_NICKNAMES, seed_demo_users


def test_seed_demo_users_fills_ranking_and_is_rerunnable(client, auth_headers, session_factory):
    seed_demo_users(session_factory)
    seed_demo_users(session_factory)
    with session_factory() as db:
        users = db.scalars(select(User)).all()
        sessions = db.scalar(select(func.count()).select_from(StudySession))
    assert sorted(u.nickname for u in users) == sorted(DEMO_NICKNAMES)
    assert all(u.in_ranking for u in users)
    assert sessions >= len(DEMO_NICKNAMES) * 5
    top = client.get("/ranking", headers=auth_headers("ana")).json()["top"]
    assert len(top) == len(DEMO_NICKNAMES)
    assert all(row["week_points"] <= 30 * 7 for row in top)  # respeita o teto de 3 sessões/dia


def test_demo_users_cannot_be_logged_into_with_a_guessable_pin(client, session_factory):
    seed_demo_users(session_factory)
    for pin in ("0000", "1234"):
        assert client.post("/auth/enter", json={"nickname": DEMO_NICKNAMES[0], "pin": pin}).status_code == 401
