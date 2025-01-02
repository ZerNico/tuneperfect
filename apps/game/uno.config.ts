import { defineConfig, presetIcons, presetUno } from "unocss";

export default defineConfig({
  presets: [presetUno(), presetIcons()],
  shortcuts: {
    "gradient-sing": "from-green-400 to-teal-600",
    "gradient-party": "from-pink-500 to-purple-600",
    "gradient-lobby": "from-yellow-400 to-orange-500",
    "gradient-settings": "from-cyan-400 to-blue-500",
  },
  theme: {
    fontFamily: {
      primary: `"Lato",${presetUno()?.theme?.fontFamily?.sans}`,
    },
    fontSize: {
      xs: ["0.67cqw", "1"],
      sm: ["0.78cqw", "1"],
      base: ["1cqw", "1.4cqw"],
      lg: ["1cqw", "1"],
      xl: ["1.11cqw", "1"],
      "2xl": ["1.33cqw", "1"],
      "3xl": ["1.67cqw", "1.2"],
      "4xl": ["2cqw", "1.2"],
      "5xl": ["2.67cqw", "1.2"],
      "6xl": ["3.33cqw", "1.2"],
      "7xl": ["4cqw", "1.2"],
      "8xl": ["5.33cqw", "1.2"],
      "9xl": ["7.33cqw", "1.2"],
    },
    borderRadius: {
      sm: "0.125cqw",
      DEFAULT: "0.25cqw",
      md: "0.375cqw",
      lg: "0.5cqw",
      xl: "0.75cqw",
      "2xl": "1cqw",
      "3xl": "1.5cqw",
    },
    colors: {
      cyan: {
        "50": "#eefdfd",
        "100": "#d3fafa",
        "200": "#adf2f4",
        "300": "#74e6ec",
        "400": "#36d1dc",
        "500": "#18b4c2",
        "600": "#1791a3",
        "700": "#1a7484",
        "800": "#1e5f6c",
        "900": "#1d4f5c",
        "950": "#0d343f",
      },
      blue: {
        "50": "#f1f5fd",
        "100": "#dfe9fa",
        "200": "#c5d9f8",
        "300": "#9ec0f2",
        "400": "#709fea",
        "500": "#5b86e5",
        "600": "#3960d7",
        "700": "#304dc5",
        "800": "#2d40a0",
        "900": "#29397f",
        "950": "#1d254e",
      },
      green: {
        "50": "#effef3",
        "100": "#d8ffe6",
        "200": "#b4fecf",
        "300": "#7afbab",
        "400": "#38ef7d",
        "500": "#0fd85b",
        "600": "#06b348",
        "700": "#098c3c",
        "800": "#0d6e33",
        "900": "#0d5a2d",
        "950": "#003316",
      },
      teal: {
        "50": "#f0fdfa",
        "100": "#cdfaf0",
        "200": "#9bf4e4",
        "300": "#61e7d3",
        "400": "#31d0bd",
        "500": "#18b4a4",
        "600": "#11998e",
        "700": "#11746d",
        "800": "#135c58",
        "900": "#144d49",
        "950": "#052e2d",
      },
      pink: {
        "50": "#fef1fb",
        "100": "#fee5f9",
        "200": "#ffcaf5",
        "300": "#ff9feb",
        "400": "#ff63da",
        "500": "#ff4dcd",
        "600": "#f012a7",
        "700": "#d10588",
        "800": "#ad076f",
        "900": "#8f0c5f",
        "950": "#580036",
      },
      purple: {
        "50": "#faf5ff",
        "100": "#f3e8ff",
        "200": "#e9d5ff",
        "300": "#d8b5fd",
        "400": "#c085fb",
        "500": "#ab5cf6",
        "600": "#9334e9",
        "700": "#7e23cd",
        "800": "#6b22a7",
        "900": "#581d86",
        "950": "#3b0863",
      },
      yellow: {
        "50": "#fefcec",
        "100": "#fcf4c9",
        "200": "#f9e78e",
        "300": "#f6d75c",
        "400": "#f3c22c",
        "500": "#eca314",
        "600": "#d17c0e",
        "700": "#ae590f",
        "800": "#8d4513",
        "900": "#743913",
        "950": "#431d05",
      },
      orange: {
        "50": "#fff8ed",
        "100": "#fff0d4",
        "200": "#ffdea8",
        "300": "#ffc570",
        "400": "#ffa037",
        "500": "#ff8008",
        "600": "#f06806",
        "700": "#c74e07",
        "800": "#9e3d0e",
        "900": "#7f350f",
        "950": "#451805",
      },
      error: "#F3696E",
      success: "#4ade80",
      warning: "#fbbf24",
      info: "#60a5fa",
    },
  },
});
