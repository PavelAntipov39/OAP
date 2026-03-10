import { createTheme } from "@mui/material/styles";

function isWuunuDevFocusRelaxed(): boolean {
  return import.meta.env.DEV;
}

const disableModalFocusTrap = isWuunuDevFocusRelaxed();
const getAppRootContainer = () => document.getElementById("root") || document.body;

export const opsTheme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#1b5fa8",
      dark: "#144a85",
      light: "#eaf2ff",
    },
    secondary: {
      main: "#5f6384",
    },
    background: {
      default: "#f6f8fc",
      paper: "#ffffff",
    },
    divider: "rgba(15, 23, 42, 0.12)",
    text: {
      primary: "#101828",
      secondary: "#475467",
    },
  },
  typography: {
    fontFamily: "\"Google Sans\", \"Inter\", \"IBM Plex Sans\", \"Segoe UI\", Roboto, Arial, sans-serif",
    h5: {
      fontWeight: 700,
      letterSpacing: -0.2,
    },
    h6: {
      fontWeight: 700,
      letterSpacing: -0.15,
    },
    subtitle1: {
      fontWeight: 600,
    },
  },
  shape: {
    borderRadius: 14,
  },
  components: {
    MuiModal: {
      defaultProps: disableModalFocusTrap
        ? {
            disablePortal: true,
            container: getAppRootContainer,
            disableEnforceFocus: true,
            disableAutoFocus: true,
            disableRestoreFocus: true,
          }
        : undefined,
    },
    MuiDrawer: {
      defaultProps: disableModalFocusTrap
        ? {
            hideBackdrop: true,
            disablePortal: true,
            container: getAppRootContainer,
            disableEnforceFocus: true,
            disableAutoFocus: true,
            disableRestoreFocus: true,
          }
        : undefined,
    },
    MuiDialog: {
      defaultProps: disableModalFocusTrap
        ? {
            hideBackdrop: true,
            disablePortal: true,
            container: getAppRootContainer,
            disableEnforceFocus: true,
            disableAutoFocus: true,
            disableRestoreFocus: true,
          }
        : undefined,
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          boxShadow: "none",
          borderBottom: "1px solid rgba(15, 23, 42, 0.12)",
          backgroundColor: "rgba(255, 255, 255, 0.86)",
          backdropFilter: "blur(8px)",
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderColor: "rgba(15, 23, 42, 0.12)",
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: "none",
          borderRadius: 10,
          fontWeight: 600,
          WebkitUserSelect: "text",
          userSelect: "text",
        },
      },
    },
    MuiLink: {
      styleOverrides: {
        root: {
          "&.MuiLink-button": {
            WebkitUserSelect: "text",
            userSelect: "text",
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 10,
        },
      },
    },
  },
});
