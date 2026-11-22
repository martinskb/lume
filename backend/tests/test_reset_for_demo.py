from datetime import datetime

from sqlalchemy import func, select

from app.models import (
    Attempt, AuthToken, Event, Exercise, Part, PartDone, StudySession, Topic, Trail, User, UserTrail, Video,
)
from scripts.reset_for_demo import reset_for_demo


def test_reset_removes_people_and_keeps_trails(session_factory):
    with session_factory() as db:
        user = User(nickname="Kaio", nickname_lower="kaio", pin_hash="x")
        db.add(user)
        db.flush()
        mine = Trail(title="os vingadores", topic_norm="os vingadores", status="ready", created_by=user.id)
        catalog = Trail(title="Fotossíntese", topic_norm="fotossintese", status="ready", is_catalog=True)
        db.add_all([mine, catalog])
        db.flush()
        part = Part(trail_id=mine.id, order=1, title="Parte A")
        db.add(part)
        db.flush()
        video = Video(part_id=part.id, position=0, youtube_id="abc", title="Aula", channel="Canal", duration_s=60)
        exercise = Exercise(part_id=part.id, source="topic", question="?", options=["a", "b", "c", "d"], correct_index=0, explanation="")
        db.add_all([video, exercise])
        db.flush()
        now = datetime(2026, 11, 20, 12)
        db.add_all([
            AuthToken(token="t", user_id=user.id),
            Event(user_id=user.id, kind="x"),
            StudySession(client_id="c", user_id=user.id, topic="t", goal_minutes=25, started_at=now, ended_at=now,
                         active_seconds=60, points=0, goal_met=False, day=now.date()),
            Topic(user_id=user.id, title="Vingadores", title_norm="vingadores", trail_id=mine.id),
            UserTrail(user_id=user.id, trail_id=mine.id),
            PartDone(user_id=user.id, part_id=part.id),
            Attempt(user_id=user.id, exercise_id=exercise.id, choice=0, correct=True),
        ])
        db.commit()

    counts = reset_for_demo(session_factory)

    with session_factory() as db:
        for model in (User, AuthToken, Event, StudySession, Topic, UserTrail, PartDone, Attempt):
            assert db.scalar(select(func.count()).select_from(model)) == 0, model.__name__
        trails = db.scalars(select(Trail)).all()
        assert sorted(t.title for t in trails) == ["Fotossíntese", "os vingadores"]
        assert all(t.created_by is None for t in trails)
        assert db.scalar(select(func.count()).select_from(Part)) == 1
        assert db.scalar(select(func.count()).select_from(Video)) == 1
        assert db.scalar(select(func.count()).select_from(Exercise)) == 1
    assert counts["users"] == 1
