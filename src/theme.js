import { createTheme, rem } from "@mantine/core";

// Neutral ink scale (used for borders/text overrides where Mantine expects a colour token)
const ink = [
  "#fafaf8",
  "#f0efeb",
  "#dedcd5",
  "#c9c8c1",
  "#a6a49c",
  "#8b8a82",
  "#6b6a65",
  "#4d4c48",
  "#2a2a27",
  "#0d0d0c",
];

// Signal green - the single accent colour
const signal = [
  "#eef7f0",
  "#d3ecd9",
  "#a8dab8",
  "#7bc796",
  "#54b67a",
  "#389f63",
  "#1f8a4c",
  "#186f3d",
  "#12552e",
  "#0c3d20",
];

const amber = [
  "#fbf3e7",
  "#f2ddb8",
  "#e6c489",
  "#d9ab5c",
  "#cb9236",
  "#a15c07",
  "#8a4e06",
  "#734105",
  "#5c3404",
  "#452703",
];

const danger = [
  "#fbeceb",
  "#f2c9c6",
  "#e6a29d",
  "#d97a73",
  "#c85148",
  "#b3261e",
  "#961f19",
  "#7a1914",
  "#5e130f",
  "#420d0a",
];

const slate = [
  "#eef0f3",
  "#d3d8de",
  "#b3bcc6",
  "#8f9caa",
  "#6c7c8f",
  "#3d4a5c",
  "#333e4d",
  "#29323e",
  "#1f262f",
  "#161b21",
];

export const theme = createTheme({
  primaryColor: "signal",
  primaryShade: 5,

  fontFamily: "'Inter Variable', system-ui, sans-serif",
  fontFamilyMonospace:
    "'JetBrains Mono Variable', ui-monospace, 'SF Mono', Consolas, monospace",

  headings: {
    fontFamily: "'Space Grotesk Variable', system-ui, sans-serif",
    fontWeight: "500",
    sizes: {
      h1: { fontSize: rem(30), lineHeight: "1.15", fontWeight: "500" },
      h2: { fontSize: rem(20), lineHeight: "1.25", fontWeight: "500" },
      h3: { fontSize: rem(16), lineHeight: "1.3", fontWeight: "600" },
    },
  },

  defaultRadius: "sm",
  radius: {
    xs: rem(2),
    sm: rem(4),
    md: rem(6),
    lg: rem(8),
    xl: rem(12),
  },

  shadows: {
    xs: "none",
    sm: "none",
    md: "none",
    lg: "none",
    xl: "none",
  },

  colors: {
    ink,
    signal,
    amber,
    danger,
    slate,
  },

  black: "#0d0d0c",
  white: "#fafaf8",

  components: {
    Card: {
      defaultProps: {
        withBorder: true,
        shadow: "none",
        radius: "md",
      },
      styles: {
        root: {
          borderColor: "var(--line)",
        },
      },
    },

    Paper: {
      defaultProps: {
        withBorder: true,
        shadow: "none",
      },
      styles: {
        root: {
          borderColor: "var(--line)",
        },
      },
    },

    Button: {
      defaultProps: {
        radius: "sm",
      },
      styles: {
        root: {
          fontFamily: "'Space Grotesk Variable', system-ui, sans-serif",
          fontWeight: 500,
          letterSpacing: "0.01em",
        },
      },
    },

    Badge: {
      defaultProps: {
        radius: "xs",
        variant: "outline",
      },
      styles: {
        root: {
          fontWeight: 600,
          letterSpacing: "0.04em",
        },
      },
    },

    ThemeIcon: {
      defaultProps: {
        radius: "sm",
        variant: "light",
      },
    },

    ActionIcon: {
      defaultProps: {
        radius: "sm",
      },
    },

    TextInput: {
      defaultProps: { radius: "sm" },
      styles: { input: { borderColor: "var(--line)" } },
    },
    Textarea: {
      defaultProps: { radius: "sm" },
      styles: { input: { borderColor: "var(--line)" } },
    },
    NumberInput: {
      defaultProps: { radius: "sm" },
      styles: { input: { borderColor: "var(--line)" } },
    },
    Select: {
      defaultProps: { radius: "sm" },
      styles: { input: { borderColor: "var(--line)" } },
    },
    DateInput: {
      defaultProps: { radius: "sm" },
      styles: { input: { borderColor: "var(--line)" } },
    },

    Table: {
      defaultProps: {
        verticalSpacing: "sm",
        horizontalSpacing: "md",
      },
    },

    Tabs: {
      styles: {
        tab: {
          fontFamily: "'Space Grotesk Variable', system-ui, sans-serif",
          fontWeight: 500,
        },
      },
    },

    Drawer: {
      defaultProps: {
        shadow: "none",
        overlayProps: { backgroundOpacity: 0.35, blur: 1 },
      },
      styles: {
        content: { borderLeft: "1px solid var(--line)" },
        title: { fontFamily: "'Space Grotesk Variable', system-ui, sans-serif", fontWeight: 600 },
      },
    },

    Modal: {
      defaultProps: {
        shadow: "none",
        radius: "md",
        overlayProps: { backgroundOpacity: 0.35, blur: 1 },
      },
      styles: {
        content: { border: "1px solid var(--line)" },
        title: { fontFamily: "'Space Grotesk Variable', system-ui, sans-serif", fontWeight: 600 },
      },
    },

    Stepper: {
      styles: {
        stepLabel: {
          fontFamily: "'Space Grotesk Variable', system-ui, sans-serif",
          fontWeight: 500,
        },
      },
    },
  },
});
