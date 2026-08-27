import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";
import "./analytics/analytics.css";
import "./analytics/trace.css";
import "./inspector/inspector.css";
import "./spatial/navigation.css";
import "./theme/black-gold.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
