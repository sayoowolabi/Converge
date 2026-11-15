import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import App from "./App";
import { StoreProvider } from "./state/store";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/explore.css";
import "./styles/screens.css";
import "./styles/workspace.css";
import "./styles/analytics.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <StoreProvider>
        <App />
      </StoreProvider>
    </BrowserRouter>
  </StrictMode>,
);
