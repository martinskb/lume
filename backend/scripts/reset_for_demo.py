"""Limpa o banco para a apresentação: apaga as contas e tudo delas, mantém as trilhas.

Apaga: contas, logins, sessões de estudo, temas, inscrições em trilhas, faixas ouvidas,
respostas de exercícios e eventos. Mantém: todas as trilhas (catálogo e as criadas),
com faixas, vídeos e exercícios — gerar de novo gasta cota do Gemini e do YouTube.

Uso (SEM VOLTA — pede confirmação):  uv run python -m scripts.reset_for_demo
Depois, para o ranking não ficar vazio:  uv run python -m scripts.seed_demo_users
"""
from sqlalchemy import delete, func, select, update
from sqlalchemy.orm import sessionmaker

from app.models import Attempt, AuthToken, Event, PartDone, StudySession, Topic, Trail, User, UserTrail

# ordem: quem aponta para a conta sai antes da conta
_PEOPLE_TABLES = [Attempt, PartDone, UserTrail, Topic, StudySession, AuthToken, Event]


def reset_for_demo(session_factory: sessionmaker) -> dict[str, int]:
    with session_factory() as db:
        counts = {"users": db.scalar(select(func.count()).select_from(User)) or 0}
        for model in _PEOPLE_TABLES:
            counts[model.__tablename__] = db.execute(delete(model)).rowcount
        db.execute(update(Trail).values(created_by=None))  # a trilha fica, sem dono
        db.execute(delete(User))
        db.commit()
        return counts


if __name__ == "__main__":
    from app.db import SessionLocal, engine

    host = engine.url.host or engine.url.database
    answer = input(f"Apagar TODAS as contas e dados de {host}? Digite APAGAR para confirmar: ")
    if answer.strip() != "APAGAR":
        raise SystemExit("Nada foi apagado.")
    print("Apagado:", reset_for_demo(SessionLocal))
