import React from "react";
import ReactDOM from "react-dom/client";
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
      font-family: var(--ns-font-family-base);
    }
  `;
  document.head.appendChild(typographyStyleTag);
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <App />
);
