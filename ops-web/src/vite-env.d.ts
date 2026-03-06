/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ENABLE_WUUNU?: string;
  readonly VITE_WUUNU_WS?: string;
}

interface Window {
  __WUUNU_WS__?: string;
}
