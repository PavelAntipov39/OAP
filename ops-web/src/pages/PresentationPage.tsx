import React from "react";
import {
  Box,
  Button,
  Chip,
  Grid,
  Link,
  Paper,
  Stack,
  Typography,
} from "@mui/material";

const highlights = [
  {
    title: "Запуск без кода",
    description:
      "Пользователь просит Codex развернуть OAP, вставляет готовый промт с описанием агентов и сразу получает рабочую панель.",
  },
  {
    title: "Понятный контроль",
    description:
      "Один взгляд на здоровье, стоимость и качество агентов вместо десятков инженерных метрик.",
  },
  {
    title: "Улучшение в один клик",
    description:
      "Каталог навыков + shadow trial: система сама проверяет эффект и предлагает безопасное подключение.",
  },
];

const roadmap = [
  "Phase 1: CLI `oap` + onboarding промт + упрощенный overview",
  "Phase 2: Langfuse self-hosted как optional observability engine",
  "Phase 3: Smithery-first marketplace и one-click skill trials",
  "Phase 4: Prompt Studio и community-профили агентов",
];

export function PresentationPage() {
  return (
    <Stack spacing={2.5} sx={{ pb: 4 }}>
      <Paper
        sx={{
          p: { xs: 2.5, md: 4 },
          border: "1px solid",
          borderColor: "divider",
          background:
            "linear-gradient(120deg, rgba(27,95,168,0.10) 0%, rgba(255,255,255,1) 46%, rgba(16,24,40,0.04) 100%)",
        }}
      >
        <Stack spacing={2.5}>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Chip color="primary" label="Open source" size="small" />
            <Chip color="primary" variant="outlined" label="Local-first" size="small" />
            <Chip color="primary" variant="outlined" label="Codex-native" size="small" />
          </Stack>

          <Box>
            <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: -0.4 }}>
              OAP: панель управления AI-агентами для вайбкодеров
            </Typography>
            <Typography variant="h6" color="text.secondary" sx={{ mt: 1.2, maxWidth: 980 }}>
              Пользователь не настраивает сложный стек вручную: он разворачивает сервис через Codex,
              добавляет своих агентов промтом и управляет ими через UI, CLI и Telegram.
            </Typography>
          </Box>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2}>
            <Button variant="contained" href="#/agents">
              Открыть Agents Hub
            </Button>
            <Button variant="outlined" href="#/agent-flow?agent=analyst-agent">
              Посмотреть Agent Flow
            </Button>
          </Stack>
        </Stack>
      </Paper>

      <Grid container spacing={2}>
        {highlights.map((item) => (
          <Grid key={item.title} item xs={12} md={4}>
            <Paper sx={{ p: 2.2, height: "100%", border: "1px solid", borderColor: "divider" }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                {item.title}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {item.description}
              </Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={2}>
        <Grid item xs={12} md={7}>
          <Paper sx={{ p: 2.4, border: "1px solid", borderColor: "divider", height: "100%" }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Что закрываем для пользователя
            </Typography>
            <Stack spacing={1.3} sx={{ mt: 1.5 }}>
              <Typography variant="body2" color="text.secondary">
                1. Непрозрачность: вместо черного ящика пользователь видит понятный статус и качество.
              </Typography>
              <Typography variant="body2" color="text.secondary">
                2. Непредсказуемые расходы: трекинг затрат на модели и стоимость за период.
              </Typography>
              <Typography variant="body2" color="text.secondary">
                3. Сложность улучшений: safe-режим для новых skills через shadow trial.
              </Typography>
              <Typography variant="body2" color="text.secondary">
                4. Высокий порог входа: onboarding через готовый промт и команду `oap`.
              </Typography>
            </Stack>
          </Paper>
        </Grid>

        <Grid item xs={12} md={5}>
          <Paper sx={{ p: 2.4, border: "1px solid", borderColor: "divider", height: "100%" }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Product Roadmap
            </Typography>
            <Stack spacing={1.1} sx={{ mt: 1.4 }}>
              {roadmap.map((step) => (
                <Typography key={step} variant="body2" color="text.secondary">
                  {step}
                </Typography>
              ))}
            </Stack>
          </Paper>
        </Grid>
      </Grid>

      <Paper sx={{ p: 2.4, border: "1px solid", borderColor: "divider" }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1.2} alignItems={{ md: "center" }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              GTM-позиционирование
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.8 }}>
              OAP = Vercel-подобный control center для AI-агентов: запуск через Codex, наблюдение через
              Langfuse, улучшения через marketplace навыков.
            </Typography>
          </Box>
          <Link href="#/docs" underline="hover" sx={{ fontWeight: 700 }}>
            Открыть документацию
          </Link>
        </Stack>
      </Paper>
    </Stack>
  );
}
