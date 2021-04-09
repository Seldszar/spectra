import type { EntryWrapper } from "@seldszar/yael";

import { createApp, App } from "vue";

const entryWrapper: EntryWrapper<App> = (App, { target }) => {
  const app = createApp(App);

  if (target === "browser") {
    const rootContainer = document.getElementById("root");

    if (rootContainer) {
      app.mount(rootContainer);
    }
  }

  return app;
};

export default entryWrapper;
