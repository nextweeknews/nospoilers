import React from "react";
import ReactDOM from "react-dom/client";
import { Theme } from "@radix-ui/themes";
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
      background: #ffffff;
    }
  `;
  document.head.appendChild(typographyStyleTag);
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  // This Theme setup keeps the existing cool-blue look while using Radix color scales and typography.
  <Theme
    accentColor="blue"
    grayColor="slate"
    radius="medium"
    scaling="100%"
    panelBackground="solid"
  >
    <App />
  </Theme>
);
