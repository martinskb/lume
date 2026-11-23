# Lume

**Aprenda qualquer coisa, um disco de cada vez.**

Lume é um aplicativo web (PWA) de estudo focado em constância. Cada tema que a pessoa está aprendendo vira um álbum na estante: o disco gira enquanto o cronômetro de foco corre, a ofensiva conta os dias seguidos e o acabamento do disco evolui de vinil a diamante conforme as horas de estudo. Opcionalmente, o Lume monta uma trilha com vídeos gratuitos do YouTube e exercícios de fixação gerados por IA.

- **Aplicativo:** https://lume-foco.vercel.app
- **API:** https://estudo-api-1k65.onrender.com

## Funcionalidades

| | |
|---|---|
| **Estante** | Temas organizados como álbuns, nas prateleiras *Aprendendo* e *Concluídos*. Capa com foto em duotone ou gerada automaticamente. |
| **Sessão de foco** | Toca-discos em tela cheia com cronômetro e meta (15, 25, 45, 60 min ou personalizada). Pausar, concluir e descartar na mesma tela; a sessão sobrevive a recarregar a página ou bloquear o celular. |
| **Constância** | Ofensiva de dias seguidos com proteções acumuláveis, pontos por sessão e meta semanal de dias. |
| **Níveis do disco** | Por tema: Vinil → Prata (1 h) → Ouro (5 h) → Platina (15 h) → Diamante (40 h). |
| **Trilhas** | A IA divide o tema em partes; cada parte recebe vídeos reais do YouTube e exercícios gerados a partir do conteúdo do vídeo. |
| **Assistente** | Dúvidas respondidas em streaming durante o foco ou a trilha, com suporte a fórmulas (KaTeX). |
| **Progresso e ranking** | Calendário de dias estudados, minutos por tema, histórico e ranking semanal opcional. |
| **Músicas para estudar** | Arquivos de áudio do próprio usuário, guardados apenas no aparelho. |

Tema claro e escuro conforme o sistema, layout próprio para celular e computador e instalação como aplicativo.

## Arquitetura

| Camada | Tecnologia | Hospedagem |
|---|---|---|
| Frontend | React 19, Vite, TypeScript, vite-plugin-pwa | Vercel |
| Backend | FastAPI, SQLAlchemy 2, Python 3.12 (uv) | Render |
| Banco de dados | PostgreSQL em produção; SQLite em desenvolvimento e testes | Neon |
| IA | Google Gemini, com troca automática de modelo ao esgotar a cota | — |
| Vídeos | YouTube Data API v3 (somente resultados reais de busca) | — |

```
backend/app/
  auth.py        autenticação por apelido + PIN, com bloqueio após tentativas
  topics/        estante: temas, capas e níveis do disco
  study/         sessões de foco, pontos e metas
  progress/      ofensiva e estatísticas
  trails/        geração de trilhas em segundo plano e catálogo
  exercises/     exercícios de fixação
  assistant/     assistente de dúvidas
  ranking/       ranking semanal
  profile/       perfil do usuário
  ai/            clientes do Gemini e do YouTube
backend/scripts/ utilitários de desenvolvimento e carga de dados

frontend/src/
  home/ topics/ timer/ trails/ progress/ ranking/ profile/ auth/
  api/           cliente HTTP com cache stale-while-revalidate
  local/         capas e músicas guardadas no aparelho (IndexedDB)
  vinyl/         disco, capa e toca-discos
  ui/            componentes compartilhados
  theme/         tokens de cor e estilos globais
```

## Desenvolvimento

Requisitos: Python 3.12+ com [uv](https://docs.astral.sh/uv/) e Node.js 20+.

**Modo local sem chaves** (IA e YouTube simulados, banco SQLite):

```bash
cd backend && uv sync && uv run python -m scripts.dev_fake   # API em http://localhost:8000
cd frontend && npm install && npm run dev                    # app em http://localhost:5173
```

**Com os serviços reais:** copie `backend/.env.example` para `backend/.env`, preencha as variáveis e rode `uv run uvicorn app.main:app --reload`.

| Variável | Descrição |
|---|---|
| `DATABASE_URL` | URL do PostgreSQL (em desenvolvimento, `sqlite:///./dev.db`) |
| `GEMINI_API_KEY` | Chave do Google AI Studio |
| `GEMINI_MODEL` | Modelos em ordem de preferência, separados por vírgula |
| `YOUTUBE_API_KEY` | Chave da YouTube Data API v3 |
| `CORS_ORIGINS` | Origens permitidas, separadas por vírgula |
| `NEW_TRAILS_PER_DAY` | Limite de trilhas novas por usuário por dia (padrão: 3) |
| `VITE_API_URL` *(frontend)* | Endereço da API |

### Testes

```bash
cd backend && uv run pytest -q
cd frontend && npx vitest run
```

### Scripts

| Comando (em `backend/`) | Descrição |
|---|---|
| `uv run python -m scripts.dev_fake` | Sobe a API com IA e YouTube simulados |
| `uv run python -m scripts.seed_catalog` | Gera os temas do catálogo a partir de `scripts/catalog_topics.txt` |
| `uv run python -m scripts.seed_demo_users` | Cria usuários de exemplo para o ranking |

## Deploy

- **Backend (Render):** Blueprint definido em [`render.yaml`](render.yaml), com as variáveis de ambiente configuradas no painel.
- **Frontend (Vercel):** raiz em `frontend/`, preset Vite e `VITE_API_URL` apontando para a API.
- Cada push na `main` publica as duas partes.
- O workflow [`keep-awake.yml`](.github/workflows/keep-awake.yml) consulta `/health` periodicamente para evitar a hibernação do plano gratuito do Render.

## Privacidade e segurança

- Coleta mínima de dados: apenas apelido e PIN, sem nome ou e-mail. Fotos de capa e músicas ficam somente no aparelho.
- Nenhum dado pessoal é enviado à IA, apenas o texto do tema, da pergunta e a URL do vídeo.
- Proteção contra prompt injection: conteúdo externo é delimitado por marcadores aleatórios, temas fora do propósito de estudo são recusados e respostas da IA não podem conter links nem HTML executável.
- Chaves de API ficam apenas no servidor; o cache local é apagado ao sair da conta.

## Roadmap

- Autenticação com senha e login opcional com Google.
- Exercícios gerados a partir de PDFs e slides do usuário.
- Publicação na Play Store como TWA.
