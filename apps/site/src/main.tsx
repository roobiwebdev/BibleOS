import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";

import { App } from "./app";
import "./styles.css";

const root = document.getElementById("root");
if (root) {
  const app = (
    <StrictMode>
      <App />
    </StrictMode>
  );
  // The build prerenders the page into #root; the dev server starts empty.
  if (root.firstElementChild) hydrateRoot(root, app);
  else createRoot(root).render(app);
}
