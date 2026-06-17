import { renderManager } from "./manager.js";
import { renderOverlay } from "./overlay.js";
import "./styles.css";

const root = document.querySelector<HTMLElement>("#app");
if (root === null) {
  throw new Error("Missing app root");
}

const params = new URLSearchParams(window.location.search);
if (params.get("view") === "overlay") {
  renderOverlay(root);
} else {
  renderManager(root);
}
