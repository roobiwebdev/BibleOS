import "./styles.css";

import { TooltipProvider } from "@starter/ui/components/tooltip";
import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { PreferencesProvider } from "./lib/state/preferences";
import { StudyProvider } from "./lib/state/study-store";
import { router } from "./router";

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <PreferencesProvider>
        <StudyProvider>
          <TooltipProvider delayDuration={400}>
            <RouterProvider router={router} />
          </TooltipProvider>
        </StudyProvider>
      </PreferencesProvider>
    </StrictMode>,
  );
}
