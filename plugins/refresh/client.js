/* eslint-disable no-undef */

const options = {
  protocol: location.protocol.replace("http", "ws"),
  address: location.hostname,
  port: location.port,
};

if (__REFRESH_PLUGIN__) {
  Object.assign(options, __REFRESH_PLUGIN__);
}

let socket;
let timeout;

let latestHash;

function canApplyUpdates() {
  return module.hot.status() === "idle";
}

function isUpdateAvailable() {
  return latestHash !== __webpack_hash__;
}

const handlers = {
  async done({ hash, errors, warnings }) {
    console.log(`Build ${hash} done`);

    if (errors.length > 0) {
      console.error(`Build ${hash} produced errors`, errors);
    }

    if (warnings.length > 0) {
      console.warn(`Build ${hash} produced warnings`, warnings);
    }
  },
  async reload() {
    location.reload();
  },
  async replace({ hash }) {
    latestHash = hash;

    if (!isUpdateAvailable() || !canApplyUpdates()) {
      return;
    }

    try {
      await module.hot.check(true);

      if (!isUpdateAvailable()) {
        return;
      }

      this.replace({
        hash: __webpack_hash__,
      });
    } catch {
      location.reload();
    }
  },
};

function connect() {
  if (socket) {
    socket.close(1000);
  }

  socket = new WebSocket(
    `${options.protocol}//${options.address}:${options.port}`
  );

  socket.addEventListener("close", (event) => {
    if (timeout) {
      clearTimeout(timeout);
    }

    if (event.code === 1000) {
      return;
    }

    timeout = setTimeout(connect, 1000);
  });

  socket.addEventListener("message", (event) => {
    const [name, type, data] = JSON.parse(event.data);

    if (name !== options.name) {
      return;
    }

    const { [type]: handler } = handlers;

    if (handler) {
      handler(data);
    }
  });
}

connect();
