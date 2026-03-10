import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { sentryVitePlugin } from "@sentry/vite-plugin";

function buildManualChunks(id: string): string | undefined {
  if (id.indexOf("src/generated/agents-manifest.json") !== -1) {
    return "agents-manifest-data";
  }
  if (id.indexOf("src/generated/agent-latest-cycle-analyst.json") !== -1 || id.indexOf("src/generated/agent-benchmark-summary.json") !== -1) {
    return "agents-metrics-data";
  }
  if (id.indexOf("src/generated/oap-kb-raw-logs.json") !== -1) {
    return "raw-logs-data";
  }
  if (id.indexOf("src/generated/oap-kb-index.json") !== -1) {
    return "kb-index-data";
  }
  if (id.indexOf("src/generated/oap-kb-search-index.json") !== -1) {
    return "kb-search-data";
  }
  if (id.indexOf("src/generated/docs-index.json") !== -1) {
    return "docs-index-data";
  }
  if (id.indexOf("src/generated/search-index.json") !== -1) {
    return "docs-search-data";
  }
  if (id.indexOf("src/generated/c4-manifest.json") !== -1 || id.indexOf("src/generated/bpmn-manifest.json") !== -1) {
    return "architecture-data";
  }
  if (id.indexOf("node_modules") === -1) {
    return undefined;
  }
  if (id.indexOf("react-markdown") !== -1 || id.indexOf("remark-") !== -1 || id.indexOf("rehype-") !== -1) {
    return "markdown";
  }
  if (id.indexOf("@mui/") !== -1 || id.indexOf("@emotion/") !== -1) {
    return "mui";
  }
  return undefined;
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  const sentryAuthToken = env.SENTRY_AUTH_TOKEN;
  const sentryOrg = env.SENTRY_ORG;
  const sentryProject = env.SENTRY_PROJECT;
  const sentryRelease = env.VITE_APP_RELEASE || env.SENTRY_RELEASE;
  const sentryUploadEnabled = Boolean(sentryAuthToken && sentryOrg && sentryProject);

  return {
    base: "./",
    plugins: [
      react(),
      ...(sentryUploadEnabled
        ? [
            sentryVitePlugin({
              authToken: sentryAuthToken,
              org: sentryOrg,
              project: sentryProject,
              telemetry: false,
              ...(sentryRelease ? { release: { name: sentryRelease } } : {}),
              sourcemaps: {
                assets: "./dist/**",
                filesToDeleteAfterUpload: ["dist/**/*.map"],
              },
            }),
          ]
        : []),
    ],
    build: {
      outDir: "dist",
      sourcemap: sentryUploadEnabled ? "hidden" : false,
      rollupOptions: {
        output: {
          manualChunks: buildManualChunks,
        },
      },
    },
    server: {
      host: true,
      port: 4174,
      strictPort: true,
    },
    preview: {
      host: true,
      port: 4174,
      strictPort: true,
    },
  };
});
