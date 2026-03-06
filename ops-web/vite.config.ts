import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { sentryVitePlugin } from "@sentry/vite-plugin";

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
