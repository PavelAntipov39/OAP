import React from "react";
import ReactDOM from "react-dom/client";
import { CssBaseline, ThemeProvider } from "@mui/material";
import * as Sentry from "@sentry/react";

import { App } from "./ui/App";
import { opsTheme } from "./ui/theme";

function keepWuunuWidgetInteractive(): void {
  const clearFlags = () => {
    const nodes = document.querySelectorAll("wuunu-widget");
    nodes.forEach((node) => {
      node.removeAttribute("aria-hidden");
      node.removeAttribute("inert");
    });
  };

  clearFlags();
  const observer = new MutationObserver(() => {
    clearFlags();
  });
  observer.observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["aria-hidden", "inert"],
  });

  window.addEventListener(
    "beforeunload",
    () => {
      observer.disconnect();
    },
    { once: true },
  );
}

function bootstrapWuunuForDev(): void {
  if (!import.meta.env.DEV) return;
  keepWuunuWidgetInteractive();

  const enabledRaw = String(import.meta.env.VITE_ENABLE_WUUNU || "").trim().toLowerCase();
  const enabled = enabledRaw === "true" || enabledRaw === "1";
  if (!enabled) return;

  const endpoint = String(import.meta.env.VITE_WUUNU_WS || "").trim();
  if (!endpoint) {
    console.warn("[WUUNU] VITE_WUUNU_WS is missing. Widget bootstrap skipped.");
    return;
  }

  if (document.getElementById("wuunu-widget-script")) return;

  window.__WUUNU_WS__ = endpoint;
  const script = document.createElement("script");
  script.id = "wuunu-widget-script";
  script.src = "https://cdn.jsdelivr.net/npm/@wuunu/widget@0.1.21";
  script.defer = true;
  script.crossOrigin = "anonymous";
  script.onerror = () => {
    console.warn("[WUUNU] Failed to load widget script from CDN.");
  };
  document.head.appendChild(script);
}

bootstrapWuunuForDev();

const sentryDsn = String(import.meta.env.VITE_SENTRY_DSN || "").trim();
const sentryEnabled = sentryDsn.length > 0;
const tracesSampleRate = Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE || "0.1");

Sentry.init({
  dsn: sentryDsn || undefined,
  enabled: sentryEnabled,
  integrations: sentryEnabled ? [Sentry.browserTracingIntegration()] : [],
  tracesSampleRate: Number.isFinite(tracesSampleRate) && tracesSampleRate >= 0 ? tracesSampleRate : 0.1,
  environment: String(import.meta.env.MODE || "development"),
  release: String(import.meta.env.VITE_APP_RELEASE || "ops-web@local"),
  sendDefaultPii: false,
});

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider theme={opsTheme}>
      <CssBaseline />
      <Sentry.ErrorBoundary fallback={<div>Произошла ошибка интерфейса.</div>}>
        <App />
      </Sentry.ErrorBoundary>
    </ThemeProvider>
  </React.StrictMode>,
);
