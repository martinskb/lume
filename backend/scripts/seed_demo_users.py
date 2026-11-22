"""Cria alguns usuários de exemplo com sessões nos últimos 10 dias, para o ranking não
aparecer vazio na demonstração.

Uso:  uv run python -m scripts.seed_demo_users
Pode rodar de novo: quem já existe é pulado. São contas de exemplo, sem dono.
"""
import random
import secrets
import uuid
from collections import defaultdict
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import sessionmaker

from app.auth import hash_pin
from app.models import StudySession, User
from app.study.rules import goal_met, points_for_session, study_day

# apelidos com cara de gente de verdade (sem "_estuda", "_enem"…)
DEMO_NICKNAMES = ["Beatriz", "JoaoPedro", "Mariana", "Lucas", "Carolina", "Rafael"]
TOPICS = ["Cálculo", "Lógica de programação", "Redação ENEM", "SQL básico", "Leis de Newton"]
DAYS_BACK = 10


def seed_demo_users(session_factory: sessionmaker) -> None:
    now = datetime.now(UTC).replace(tzinfo=None)
    with session_factory() as db:
        for index, nickname in enumerate(DEMO_NICKNAMES):
            if db.scalar(select(User).where(User.nickname_lower == nickname.lower())):
                continue
            rng = random.Random(index)  # sempre os mesmos dados para o mesmo apelido
            user = User(
                nickname=nickname,
                nickname_lower=nickname.lower(),
                # PIN aleatório que ninguém conhece: a conta existe só para compor o ranking.
                pin_hash=hash_pin(secrets.token_hex(16)),
                in_ranking=True,
            )
            db.add(user)
            db.flush()
            scored_by_day: dict = defaultdict(int)  # o teto de 3 pontuadas vale por dia de Belém
            skip_chance = 0.1 + 0.1 * index  # uns são mais constantes que outros
            for back in range(DAYS_BACK, -1, -1):
                if back > 0 and rng.random() < skip_chance:
                    continue
                for n in range(rng.randint(1, 3)):
                    active = rng.choice([900, 1500, 1500, 1800, 2700])
                    ended = now - timedelta(days=back, minutes=5 + 50 * n)
                    day = study_day(ended)
                    points = points_for_session(active, scored_by_day[day])
                    scored_by_day[day] += points > 0
                    db.add(
                        StudySession(
                            client_id=str(uuid.uuid4()),
                            user_id=user.id,
                            topic=rng.choice(TOPICS),
                            goal_minutes=25,
                            started_at=ended - timedelta(seconds=active),
                            ended_at=ended,
                            active_seconds=active,
                            points=points,
                            goal_met=goal_met(active, 25),
                            day=day,
                        )
                    )
        db.commit()


if __name__ == "__main__":
    from app import models  # noqa: F401
    from app.db import Base, SessionLocal, engine

    Base.metadata.create_all(engine)
    seed_demo_users(SessionLocal)
    print("Usuários de exemplo:", ", ".join(DEMO_NICKNAMES))


def top_up_demo_users(session_factory: sessionmaker, through) -> None:
    """Uma sessão por dia para cada usuário de exemplo, de amanhã até `through` (inclusive).

    No dia `through` a sessão termina cedo (antes das 8h em Belém): assim, na manhã da
    apresentação, o ranking da semana nova já tem gente e as ofensivas continuam.
    """
    from datetime import date, time

    from app.study.rules import BELEM

    today = datetime.now(BELEM).date()
    with session_factory() as db:
        users = db.scalars(select(User).where(User.nickname_lower.in_([n.lower() for n in DEMO_NICKNAMES]))).all()
        for index, user in enumerate(users):
            day = today + timedelta(days=1)
            while day <= through:
                client_id = f"demo-topup-{user.id}-{day.isoformat()}"
                if not db.scalar(select(StudySession.id).where(StudySession.user_id == user.id, StudySession.client_id == client_id)):
                    hour = 6 if day == through else 18
                    local_end = datetime.combine(day, time(hour, 5 + index * 8), tzinfo=BELEM)
                    ended = local_end.astimezone(UTC).replace(tzinfo=None)
                    active = 1500 + index * 120
                    db.add(
                        StudySession(
                            client_id=client_id,
                            user_id=user.id,
                            topic=TOPICS[index % len(TOPICS)],
                            goal_minutes=25,
                            started_at=ended - timedelta(seconds=active),
                            ended_at=ended,
                            active_seconds=active,
                            points=points_for_session(active, 0),
                            goal_met=goal_met(active, 25),
                            day=day,
                        )
                    )
                day += timedelta(days=1)
        db.commit()
