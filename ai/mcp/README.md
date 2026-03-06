# MCP Servers

Всё про MCP (Model Context Protocol) — конфиги, документация и код серверов.

## Активная конфигурация

Активный конфиг MCP живёт в **корне проекта** — `.mcp.json`.
Это стандартное расположение, которое подхватывает AI-ассистент автоматически.

## Как добавить MCP-сервер

1. Добавь запись в `.mcp.json` в корне проекта:
   ```json
   {
     "mcpServers": {
       "my-server": {
         "command": "npx",
         "args": ["-y", "my-mcp-package"]
       }
     }
   }
   ```
2. Задокументируй сервер ниже в этом файле

## Зарегистрированные серверы

Для Codex Desktop хранятся глобально в `~/.codex/config.toml` (scope: user).
Для этого проекта локально задаются в `.mcp.json`.

| Сервер | Тип | Назначение | Scope |
|--------|-----|-----------|-------|
| **context7** | http | Актуальная документация библиотек при написании кода | global |
| **playwright** | stdio (`npx @playwright/mcp@latest`) | Браузерное e2e тестирование из чата | global |
| **codag_bible** | stdio (`node .run/codag/.../mcp-server.js`) | Кастомный MCP проекта Библия | global |
| **supabase** | встроен через Anthropic | Управление БД (таблицы, миграции, функции) | session |

### Детали подключения

**context7**
```bash
claude mcp add -s user -t http context7 https://mcp.context7.com/mcp \
  -H "CONTEXT7_API_KEY: $CONTEXT7_API_KEY"
```

**playwright**
```bash
claude mcp add -s user -t stdio playwright -- npx @playwright/mcp@latest
```

**codag_bible**
```bash
claude mcp add -s user -t stdio codag_bible -- node \
  "/Users/pavelantipov/Downloads/VS Code/Библия/.run/codag/frontend/out/mcp-server.js" \
  "/Users/pavelantipov/Downloads/VS Code/Библия"
```

**supabase** — для проекта подключается через `.mcp.json` с нужным `project_ref`.

## Где смотреть ключи (безопасно)

- Runtime ключи бэкенда: `.env.local` (корень репозитория, gitignored).
- Frontend ключи: `ops-web/.env.local` (gitignored).
- MCP-конфиг серверов: `.mcp.json` (проект) и `~/.codex/config.toml` (глобально).
- В документации хранить только placeholders, не реальные токены.

## Кастомные серверы

Код собственных MCP-серверов кладём в `servers/`.
