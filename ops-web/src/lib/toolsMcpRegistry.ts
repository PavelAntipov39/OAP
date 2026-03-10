/**
 * Registry of Tools and MCP Integration descriptions
 * Used for displaying tooltips with metadata in UI components
 */

export interface ToolMcpMetadata {
  name: string;
  description: string;
  filePath?: string; // Path to configuration or documentation file
  type: "tool" | "mcp" | "skill" | "rule";
  practicalTasks?: string[];
  impactInNumbers?: string;
  agentNames?: string[];
  status?: string; // For MCP: online, offline, reauth_required, active, etc.
}

export const TOOLS_MCP_DESCRIPTIONS: Record<string, ToolMcpMetadata> = {
  // Tools
  "QMD retrieval": {
    name: "QMD retrieval",
    type: "tool",
    description:
      "Ищет top-k релевантных фрагментов по spec/contracts/runbook и возвращает только подтверждающие выдержки.",
    filePath: "AGENTS.md#qmd-retrieval-policy",
    practicalTasks: [
      "Рефакторинг карточки персонажа",
      "Проверка архитектурных решений перед merge",
    ],
    agentNames: ["Разработчик", "Data Agent", "Продакт дизайнер", "Аналитик"],
  },

  // MCP Integrations
  Context7: {
    name: "Context7",
    type: "mcp",
    description:
      "Актуальная документация библиотек (React, MUI, TypeScript и др.) при написании кода. Требуется авторизация для доступа к актуальным документам.",
    filePath: ".mcp.json#Context7",
    practicalTasks: [
      "Подбор библиотеки React/MUI",
      "Проверка API-паттернов перед внедрением",
    ],
    impactInNumbers:
      "Ускоряет подготовку решения по библиотекам в среднем на 10-15 минут на задачу.",
    agentNames: ["Разработчик", "Data Agent", "Продакт дизайнер", "Аналитик"],
    status: "online",
  },

  Supabase: {
    name: "Supabase",
    type: "mcp",
    description:
      "Интеграция с Supabase для проверки контрактов RPC, структуры данных и управления БД. Используется для валидации структур данных профиля и контрактов при backend-интеграциях.",
    filePath: ".mcp.json#supabase",
    practicalTasks: [
      "Проверка контрактов RPC",
      "Проверка структуры данных профиля персонажа",
    ],
    impactInNumbers:
      "Снижает риск несовпадения UI и данных в интеграционных задачах.",
    agentNames: ["Разработчик", "Data Agent", "Ops Agent", "Аналитик"],
    status: "online",
  },

  QMD: {
    name: "QMD",
    type: "mcp",
    description:
      "Используется для retrieval по markdown-контексту (spec/contracts/runbook) с минимальным расходом токенов. Evidence-first подход для исследования требований.",
    filePath: ".mcp.json#qmd",
    agentNames: ["Разработчик", "Data Agent", "Ops Agent", "Продакт дизайнер", "Аналитик"],
    practicalTasks: [
      "Поиск релевантных фрагментов в AGENTS/spec/contracts",
      "Быстрый старт сложных задач",
    ],
    impactInNumbers:
      "Экономия контекстных токенов: ~20-35% на задачах с длинной документацией.",
    status: "online",
  },

  Netlify: {
    name: "Netlify",
    type: "mcp",
    description:
      "Автоматизирует деплой и проверку доступности production/preview окружений без ручной рутины. Подходит для быстрой проверки production-публикации.",
    filePath: ".mcp.json#netlify",
    practicalTasks: [
      "Smoke тест deploy flow",
      "Проверка production URL после релиза",
    ],
    impactInNumbers: "-25% времени на выпуск и проверку релизов.",
    agentNames: ["Разработчик", "Ops Agent", "Аналитик"],
    status: "online",
  },

  GitHub: {
    name: "GitHub",
    type: "mcp",
    description:
      "Интеграция для работы с репозиторием, комментариями ревью и быстрым доступом к изменениям без ручного переключения в внешние инструменты.",
    filePath: "ai/mcp/README.md",
    practicalTasks: [
      "Разбор PR и review-комментариев",
      "Проверка истории изменений перед merge",
    ],
    impactInNumbers:
      "Сокращает время на навигацию по review-контексту и diff при инженерных задачах.",
    agentNames: ["Ops Agent"],
    status: "online",
  },

  "Figma MCP": {
    name: "Figma MCP",
    type: "mcp",
    description:
      "Доступ к дизайн-контексту и параметрам макета для аккуратного переноса UI-решений из Figma в код и проверки дизайн-системы.",
    filePath: "ai/mcp/README.md",
    practicalTasks: [
      "Улучшение карточки агента",
      "Редизайн экранов по макету",
    ],
    impactInNumbers:
      "Снижает число итераций после дизайн-ревью и ускоряет точный перенос интерфейса в код.",
    agentNames: ["Продакт дизайнер", "Разработчик"],
    status: "online",
  },

  // Skills
  playwright: {
    name: "playwright",
    type: "skill",
    description:
      "Проверка пользовательских сценариев в реальном браузере после UI-изменений: навигация, открытие drawer, фильтры, smoke-тесты.",
    filePath: "docs/agents/registry.yaml#usedSkills.playwright",
    practicalTasks: [
      "Обновление Reader UI",
      "Проверка hash-routing",
      "Smoke тест deploy flow",
    ],
    agentNames: ["Разработчик", "Data Agent", "Ops Agent", "Продакт дизайнер", "Аналитик"],
  },

  doc: {
    name: "doc",
    type: "skill",
    description:
      "Работа со спецификациями и контрактами: извлечение требований, фиксация ограничений и согласование изменений.",
    filePath: ".specify/specs/001-oap/spec.md",
    practicalTasks: [
      "Рефакторинг карточки персонажа",
      "Обновление Reader UI",
    ],
    agentNames: ["Разработчик", "Data Agent", "Продакт дизайнер", "Аналитик"],
  },

  "gh-address-comments": {
    name: "gh-address-comments",
    type: "skill",
    description:
      "Системный разбор комментариев ревью и закрытие замечаний с проверкой регрессий.",
    filePath: "AGENTS.md#code-review-standard",
    practicalTasks: [
      "Обновление Reader UI",
      "Правки структуры модалки",
    ],
    agentNames: ["Разработчик", "Ops Agent"],
  },

  "figma-implement-design": {
    name: "figma-implement-design",
    type: "skill",
    description:
      "Точный перенос дизайн-макета в production UI с учетом компонентов, токенов и фактических ограничений текущего проекта.",
    filePath: "docs/agents/registry.yaml#availableSkills.figma-implement-design",
    practicalTasks: [
      "Улучшение карточки агента",
      "Обновление экранов по макету",
    ],
    impactInNumbers:
      "Уменьшает визуальные расхождения и сокращает число правок после дизайн-ревью.",
    agentNames: ["Продакт дизайнер", "Разработчик"],
  },

  "security-best-practices": {
    name: "security-best-practices",
    type: "skill",
    description:
      "Проверка решений на уязвимости доступа, небезопасные интеграции и конфигурационные риски до merge или релиза.",
    filePath: "AGENTS.md#code-review-standard",
    practicalTasks: [
      "Ревью форм и внешних ссылок",
      "Проверка инфраструктурных изменений",
    ],
    impactInNumbers:
      "Снижает риск критических security-регрессий в UI, ETL и инфраструктурных задачах.",
    agentNames: ["Разработчик", "Data Agent", "Ops Agent", "Продакт дизайнер", "Аналитик"],
  },

  spreadsheet: {
    name: "spreadsheet",
    type: "skill",
    description:
      "Анализ табличных отчетов качества, поиск аномалий и сравнение срезов данных между релизами и циклами.",
    filePath: "docs/agents/registry.yaml#usedSkills.spreadsheet",
    practicalTasks: [
      "Анализ QA-отчетов",
      "Сопоставление метрик и артефактов",
    ],
    impactInNumbers:
      "Ускоряет поиск drift и несоответствий в табличных данных без ручного просмотра сырых выгрузок.",
    agentNames: ["Data Agent", "Аналитик"],
  },

  sentry: {
    name: "sentry",
    type: "skill",
    description:
      "Разбор production-инцидентов и error-trace для быстрой локализации причин сбоев после релиза.",
    filePath: "docs/agents/registry.yaml#usedSkills.sentry",
    practicalTasks: [
      "Анализ инцидентов после релиза",
      "Проверка деградации production-флоу",
    ],
    impactInNumbers:
      "Снижает время root-cause анализа production-ошибок за счет готовых trace и issue-группировок.",
    agentNames: ["Ops Agent", "Аналитик"],
  },
};

const NORMALIZED_TOOL_MCP_DESCRIPTIONS = new Map(
  Object.entries(TOOLS_MCP_DESCRIPTIONS).map(([key, value]) => [key.toLowerCase(), value]),
);

/**
 * Get metadata for a tool/mcp/skill by name
 * Returns null if not found
 */
export function getToolMcpMetadata(name: string): ToolMcpMetadata | null {
  const exact = TOOLS_MCP_DESCRIPTIONS[name];
  if (exact) return exact;
  return NORMALIZED_TOOL_MCP_DESCRIPTIONS.get(String(name || "").trim().toLowerCase()) || null;
}

/**
 * Get description text for fallback (first line or full text)
 */
export function getToolMcpDescription(name: string): string {
  const metadata = getToolMcpMetadata(name);
  if (!metadata) return "Описание недоступно";
  return metadata.description;
}

/**
 * Format practical tasks as comma-separated list
 */
export function formatPracticalTasks(tasks?: string[]): string {
  if (!tasks || tasks.length === 0) return "";
  return tasks.join(", ");
}
