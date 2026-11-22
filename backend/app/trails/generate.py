"""Geração de trilha em segundo plano: partes (IA) → vídeos (YouTube) → exercícios (IA)."""
import time
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta

from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session, sessionmaker

from app.ai.client import AIClient, AIError, QuizItem, TopicRejected
from app.ai.youtube import QuotaExceeded, VideoSearch
from app.db import utcnow
from app.events import log_event
from app.models import Exercise, Part, Trail, Video

VIDEOS_PER_PART = 3
QUESTIONS_PER_PART = 4
QUIZ_WORKERS = 6  # uma trilha tem até 6 partes: todas de uma vez
STALE_AFTER = timedelta(minutes=10)
RETRY_WAIT_S = 4  # o plano grátis do Gemini limita chamadas por minuto: espera antes de repetir

STEP_SPLIT = "dividindo o tema"
STEP_VIDEOS = "buscando aulas"
STEP_QUIZ = "criando exercícios"


def _retry_once[T](call: Callable[[], T]) -> T:
    try:
        return call()
    except TopicRejected:
        raise  # o tema não é de estudo: tentar de novo não muda a resposta
    except AIError:
        time.sleep(RETRY_WAIT_S)
        return call()


def _timed(db: Session, kind: str, trail_id: int, call: Callable):
    """Roda `call`, registra evento com latência (e falha, se houver) e devolve o resultado."""
    start = time.monotonic()
    ok = True
    try:
        return call()
    except Exception:
        ok = False
        raise
    finally:
        log_event(
            db, kind, ok=ok, latency_ms=int((time.monotonic() - start) * 1000), trail_id=trail_id
        )


def _add_exercises(db: Session, part_id: int, items: list[QuizItem], *, video_id: int | None = None):
    for item in items:
        db.add(
            Exercise(
                part_id=part_id,
                video_id=video_id,
                source="video" if video_id else "topic",
                question=item.question[:1000],
                options=item.options,
                correct_index=item.correct_index,
                explanation=item.explanation[:1000],
            )
        )


def _clear(db: Session, trail_id: int) -> None:
    part_ids = select(Part.id).where(Part.trail_id == trail_id)
    db.execute(delete(Exercise).where(Exercise.part_id.in_(part_ids)))
    db.execute(delete(Video).where(Video.part_id.in_(part_ids)))
    db.execute(delete(Part).where(Part.trail_id == trail_id))


def generate_trail(
    trail_id: int, ai: AIClient, yt: VideoSearch, session_factory: sessionmaker
) -> None:
    with session_factory() as db:
        trail = db.get(Trail, trail_id)
        if trail is None:
            return

        def set_step(step: str) -> None:
            trail.step = step
            db.commit()  # o frontend acompanha as etapas por polling

        try:
            _clear(db, trail_id)  # sobras de uma tentativa anterior que falhou
            set_step(STEP_SPLIT)
            titles = _timed(
                db,
                "trail_split",
                trail_id,
                lambda: _retry_once(lambda: ai.split_topic(trail.title, trail.level)),
            )
            parts = [Part(trail_id=trail_id, order=i, title=t) for i, t in enumerate(titles, 1)]
            db.add_all(parts)
            set_step(STEP_VIDEOS)

            def search_all() -> None:
                for part in parts:
                    # Curiosidade (cultura pop, atualidades) acha mais vídeos de reação com "aula":
                    # pedir "explicado" traz resumos e explicações.
                    suffix = "explicado" if trail.level == "livre" else "aula"
                    hits = yt.search(f"{trail.title} {part.title} {suffix}", VIDEOS_PER_PART)
                    for position, hit in enumerate(hits):
                        db.add(
                            Video(
                                part_id=part.id,
                                position=position,
                                youtube_id=hit.youtube_id,
                                title=hit.title,
                                channel=hit.channel,
                                duration_s=hit.duration_s,
                            )
                        )

            _timed(db, "trail_videos", trail_id, search_all)
            set_step(STEP_QUIZ)

            def quiz_all() -> None:
                # Em fila, 5 capítulos levavam minutos: pede todos ao mesmo tempo.
                # As threads só falam com a IA; quem grava no banco é esta thread.
                title, wanted = trail.title, [(p.id, p.title) for p in parts]

                def one(part_title: str) -> list[QuizItem] | None:
                    try:
                        return _retry_once(lambda: ai.topic_quiz(title, part_title, QUESTIONS_PER_PART))
                    except AIError:
                        return None  # a parte fica sem exercícios; a trilha continua valendo

                with ThreadPoolExecutor(max_workers=QUIZ_WORKERS) as pool:
                    results = list(pool.map(one, [t for _, t in wanted]))
                for (part_id, _), items in zip(wanted, results, strict=True):
                    if items:
                        _add_exercises(db, part_id, items)

            _timed(db, "trail_quiz", trail_id, quiz_all)
            trail.status, trail.step, trail.error = "ready", "", None
            db.commit()
        except Exception as exc:
            db.rollback()
            if isinstance(exc, TopicRejected):
                error = "tema"
            elif isinstance(exc, QuotaExceeded):
                error = "quota"
            else:
                error = "ai" if isinstance(exc, AIError) else "erro"
            _clear(db, trail_id)
            db.execute(
                update(Trail).where(Trail.id == trail_id).values(status="failed", step="", error=error)
            )
            log_event(db, "trail_failed", ok=False, trail_id=trail_id, error=error, detail=type(exc).__name__)
            db.commit()


def analyze_videos(
    trail_id: int, ai: AIClient, session_factory: sessionmaker, per_part: int = 1
) -> None:
    """Gera exercícios a partir do conteúdo dos primeiros `per_part` vídeos de cada parte.

    O plano grátis do Gemini aceita 8 h de vídeo por dia, então não analisamos todos.
    Se a análise falhar, os exercícios pelo assunto continuam valendo.
    A chamada à IA leva até 90 s: nenhuma sessão do banco fica aberta enquanto ela roda.
    """
    with session_factory() as db:
        pending: list[tuple[int, int, str, str]] = []
        parts = db.scalars(select(Part).where(Part.trail_id == trail_id).order_by(Part.order)).all()
        for part in parts:
            videos = db.scalars(
                select(Video)
                .where(Video.part_id == part.id)
                .order_by(Video.position, Video.id)
                .limit(per_part)
            ).all()
            pending += [
                (v.id, part.id, part.title, v.youtube_id) for v in videos if v.analysis == "pending"
            ]

    for video_id, part_id, part_title, youtube_id in pending:
        start = time.monotonic()
        try:
            items = ai.video_quiz(
                f"https://www.youtube.com/watch?v={youtube_id}", part_title, QUESTIONS_PER_PART
            )
        except Exception:
            items = None
        latency_ms = int((time.monotonic() - start) * 1000)
        with session_factory() as db:
            video = db.get(Video, video_id)
            if video is None:  # a trilha foi refeita enquanto a IA respondia
                continue
            if items:
                _add_exercises(db, part_id, items, video_id=video_id)
            video.analysis = "done" if items else "failed"
            log_event(
                db,
                "video_analysis",
                ok=bool(items),
                latency_ms=latency_ms,
                trail_id=trail_id,
                video_id=video_id,
            )
            db.commit()


def fail_orphaned_generating(db: Session) -> int:
    """Na subida do servidor, toda trilha em 'generating' ficou órfã (o processo que a
    gerava morreu): vira 'failed' para o aluno poder tentar de novo na hora."""
    result = db.execute(
        update(Trail).where(Trail.status == "generating").values(status="failed", step="", error="erro")
    )
    db.commit()
    return result.rowcount
