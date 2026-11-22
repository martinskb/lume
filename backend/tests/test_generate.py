import pytest
from sqlalchemy import select

from app.models import Event, Exercise, Part, Trail, Video
from app.trails.generate import analyze_videos, generate_trail
from tests.fakes import FakeAI, FakeVideos


@pytest.fixture
def ai():
    return FakeAI()


@pytest.fixture
def yt():
    return FakeVideos()


@pytest.fixture
def trail_id(session_factory):
    with session_factory() as db:
        trail = Trail(title="Funções do 1º grau", topic_norm="funcoes do 1o grau", level="vestibular")
        db.add(trail)
        db.commit()
        return trail.id


def load(session_factory, trail_id):
    with session_factory() as db:
        trail = db.get(Trail, trail_id)
        parts = db.scalars(select(Part).where(Part.trail_id == trail_id).order_by(Part.order)).all()
        ids = [p.id for p in parts]
        videos = db.scalars(select(Video).where(Video.part_id.in_(ids))).all()
        exercises = db.scalars(select(Exercise).where(Exercise.part_id.in_(ids))).all()
        return trail, parts, videos, exercises


def test_happy_path_ready(session_factory, trail_id, ai, yt):
    generate_trail(trail_id, ai, yt, session_factory)
    trail, parts, videos, exercises = load(session_factory, trail_id)
    assert trail.status == "ready" and trail.error is None
    assert [p.title for p in parts] == ["Parte A", "Parte B", "Parte C", "Parte D"]
    assert [p.order for p in parts] == [1, 2, 3, 4]
    assert len(videos) == 12
    assert len(exercises) == 16
    assert all(e.source == "topic" and len(e.options) == 4 for e in exercises)


def test_search_query_includes_topic_and_part(session_factory, trail_id, ai, yt):
    generate_trail(trail_id, ai, yt, session_factory)
    assert "Funções do 1º grau" in yt.queries[0] and "Parte A" in yt.queries[0]
    assert yt.queries[0].endswith(" aula")  # escola/faculdade: procura aula


def test_curiosity_search_asks_for_explanations_not_classes(session_factory, ai, yt):
    with session_factory() as db:
        trail = Trail(title="Cronologia da Marvel", topic_norm="cronologia da marvel", level="livre")
        db.add(trail)
        db.commit()
        trail_id = trail.id
    generate_trail(trail_id, ai, yt, session_factory)
    assert yt.queries[0].startswith("Cronologia da Marvel Parte A")
    assert yt.queries[0].endswith(" explicado")


def test_malformed_ai_json_retries_once(session_factory, trail_id, ai, yt):
    ai.split_failures = 1
    generate_trail(trail_id, ai, yt, session_factory)
    assert load(session_factory, trail_id)[0].status == "ready"


def test_malformed_ai_json_retries_then_fails(session_factory, trail_id, ai, yt):
    ai.split_failures = 2
    generate_trail(trail_id, ai, yt, session_factory)
    trail = load(session_factory, trail_id)[0]
    assert trail.status == "failed"
    assert trail.error == "ai"


def test_part_without_videos_still_ready(session_factory, trail_id, ai, yt):
    yt.empty_for = {"Parte B"}
    generate_trail(trail_id, ai, yt, session_factory)
    trail, parts, videos, _ = load(session_factory, trail_id)
    assert trail.status == "ready"
    part_b = next(p for p in parts if p.title == "Parte B")
    assert [v for v in videos if v.part_id == part_b.id] == []
    assert len(videos) == 9


def test_quota_marks_failed(session_factory, trail_id, ai, yt):
    yt.quota = True
    generate_trail(trail_id, ai, yt, session_factory)
    trail = load(session_factory, trail_id)[0]
    assert (trail.status, trail.error) == ("failed", "quota")


def test_generation_logs_events_with_latency(session_factory, trail_id, ai, yt):
    generate_trail(trail_id, ai, yt, session_factory)
    with session_factory() as db:
        events = db.scalars(select(Event).where(Event.kind.like("trail_%"))).all()
    assert {e.kind for e in events} >= {"trail_split", "trail_videos", "trail_quiz"}
    assert all(e.latency_ms is not None for e in events)


def test_video_analysis_adds_video_exercises_for_first_video_of_each_part(
    session_factory, trail_id, ai, yt
):
    generate_trail(trail_id, ai, yt, session_factory)
    analyze_videos(trail_id, ai, session_factory)
    _, parts, videos, exercises = load(session_factory, trail_id)
    assert sum(v.analysis == "done" for v in videos) == len(parts)
    from_video = [e for e in exercises if e.source == "video"]
    assert len(from_video) == 4 * len(parts)
    assert all(e.video_id is not None for e in from_video)
    url = next(c for c in ai.calls if c[0] == "video_quiz")[1]
    assert url.startswith("https://www.youtube.com/watch?v=vid")


def test_video_analysis_failure_keeps_topic_exercises(session_factory, trail_id, ai, yt):
    generate_trail(trail_id, ai, yt, session_factory)
    ai.video_quiz_fails = True
    analyze_videos(trail_id, ai, session_factory)
    _, parts, videos, exercises = load(session_factory, trail_id)
    assert sum(v.analysis == "failed" for v in videos) == len(parts)
    assert len(exercises) == 16 and all(e.source == "topic" for e in exercises)


def test_all_generating_trails_are_failed_on_startup(session_factory):
    # com um único processo, toda trilha "generating" na subida do servidor ficou órfã
    from datetime import timedelta

    from app.db import utcnow
    from app.trails.generate import fail_orphaned_generating

    with session_factory() as db:
        db.add(Trail(title="Velha", topic_norm="velha", started_at=utcnow() - timedelta(minutes=11)))
        db.add(Trail(title="Nova", topic_norm="nova", started_at=utcnow() - timedelta(minutes=2)))
        db.add(Trail(title="Pronta", topic_norm="pronta", status="ready"))
        db.commit()
        assert fail_orphaned_generating(db) == 2
        status = dict(db.execute(select(Trail.title, Trail.status)).all())
    assert status == {"Velha": "failed", "Nova": "failed", "Pronta": "ready"}


def test_retry_waits_before_second_attempt(session_factory, trail_id, ai, yt, monkeypatch):
    from app.trails import generate

    waits = []
    monkeypatch.setattr(generate, "RETRY_WAIT_S", 3)
    monkeypatch.setattr(generate.time, "sleep", waits.append)
    ai.split_failures = 1
    generate_trail(trail_id, ai, yt, session_factory)
    assert waits == [3]
    assert load(session_factory, trail_id)[0].status == "ready"


def test_failure_event_does_not_leak_error_text(session_factory, trail_id, ai, yt):
    yt.error = RuntimeError("500 for url https://x/videos?key=SEGREDO")
    generate_trail(trail_id, ai, yt, session_factory)
    with session_factory() as db:
        event = db.scalar(select(Event).where(Event.kind == "trail_failed"))
    assert "SEGREDO" not in str(event.data)
    assert event.data["detail"] == "RuntimeError"


def test_video_analysis_holds_no_db_session_during_ai_call(session_factory, trail_id, ai, yt):
    from contextlib import contextmanager

    generate_trail(trail_id, ai, yt, session_factory)

    class CountingFactory:
        open = 0

        @contextmanager
        def __call__(self):
            self.open += 1
            try:
                with session_factory() as db:
                    yield db
            finally:
                self.open -= 1

    factory = CountingFactory()
    seen = []
    original = ai.video_quiz
    ai.video_quiz = lambda *args: (seen.append(factory.open), original(*args))[1]
    analyze_videos(trail_id, ai, factory)
    assert seen == [0, 0, 0, 0]  # a chamada lenta à IA não segura conexão do banco
    assert sum(v.analysis == "done" for v in load(session_factory, trail_id)[2]) == 4


def test_part_quizzes_are_requested_in_parallel(session_factory, trail_id, yt):
    # Na demo, 5 capítulos em fila levaram 5,5 min e a tela desistiu antes de a trilha ficar pronta.
    import threading

    together = threading.Barrier(2, timeout=5)

    class ParallelAI(FakeAI):
        def topic_quiz(self, topic, part, n):
            together.wait()  # só passa se outro capítulo estiver sendo pedido ao mesmo tempo
            return super().topic_quiz(topic, part, n)

    generate_trail(trail_id, ParallelAI(), yt, session_factory)
    trail, parts, _, exercises = load(session_factory, trail_id)
    assert trail.status == "ready"
    assert {e.part_id for e in exercises} == {p.id for p in parts}
    for part in parts:  # cada capítulo recebe as próprias questões
        assert all(e.question.startswith(f"assunto {part.title}") for e in exercises if e.part_id == part.id)
