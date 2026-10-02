import { mount } from "svelte";
import App from "./App.svelte";
// Fonts are bundled rather than pulled from Google, so they work offline and need no third party.
import "@fontsource/cinzel/600.css";
import "@fontsource/cinzel/800.css";
import "@fontsource/alegreya/400.css";
import "@fontsource/alegreya/400-italic.css";
import "@fontsource/alegreya/700.css";
import "./app.css";

const app = mount(App, { target: document.getElementById("app")! });

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js");
}

export default app;
