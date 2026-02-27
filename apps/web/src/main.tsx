import React from "react";
import ReactDOM from "react-dom/client";
import { Theme } from "@radix-ui/themes";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import "@radix-ui/themes/styles.css";
import { typographyTokens } from "@nospoilers/ui";
import { App } from "./App";

const typographyStyleTagId = "nospoilers-web-typography";

if (!document.getElementById(typographyStyleTagId)) {
  const typographyStyleTag = document.createElement("style");
  typographyStyleTag.id = typographyStyleTagId;
  typographyStyleTag.textContent = `
    :root {
      --ns-font-family-base: ${typographyTokens.family};
    }

    html,
    body,
    #root {
      margin: 0;
      min-height: 100%;
      font-family: var(--ns-font-family-base);
      /* Use Radix background tokens so the page surface follows light/dark mode automatically. */
      background: var(--color-background);
      color: var(--gray-12);
    }
  `;
  document.head.appendChild(typographyStyleTag);
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  // next-themes applies either a `light` or `dark` class to the document root based on user/system preference.
  // Radix Theme then inherits that class so its color scales and semantic tokens switch modes in sync.
  <NextThemesProvider attribute="class" defaultTheme="system" enableSystem>
    <Theme
      appearance="inherit"
      // Use a vibrant green accent globally so primary Radix components share the same visual identity.
      accentColor="grass"
      grayColor="slate"
      radius="medium"
      scaling="100%"
      panelBackground="solid"
    >
      <App />
    </Theme>
  </NextThemesProvider>
);
