const HEARTBEAT_OFFLINE_AFTER_MS = 180_000;

const machines = new Map();

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/ws") {
      return handleWebSocket(request, env);
    }

    if (url.pathname === "/state") {
      return jsonResponse(buildState());
    }

    return new Response("Not found", { status: 404 });
  },
};

function handleWebSocket(request, env) {
  if (request.headers.get("upgrade")?.toLowerCase() !== "websocket") {
    return new Response("Expected WebSocket", { status: 426 });
  }

  const pair = new WebSocketPair();
  const [client, server] = Object.values(pair);
  const session = {
    authenticated: false,
    token: env.REMOTE_STATUS_BRIDGE_TOKEN ?? "",
  };

  server.accept();
  server.addEventListener("message", (event) => {
    handleSocketMessage(server, session, event.data);
  });
  server.addEventListener("close", () => {
    // The bridge keeps the last received snapshot until it ages out as offline.
  });
  server.addEventListener("error", () => {
    tryClose(server, 1011, "socket error");
  });

  return new Response(null, {
    status: 101,
    webSocket: client,
  });
}

function handleSocketMessage(socket, session, rawData) {
  const message = parseJson(rawData);
  if (!message || typeof message.type !== "string") {
    tryClose(socket, 1003, "invalid json");
    return;
  }

  if (!session.authenticated) {
    handleAuthMessage(socket, session, message);
    return;
  }

  if (message.type === "snapshot") {
    const snapshot = normalizeSnapshot(message);
    if (!snapshot) {
      tryClose(socket, 1003, "invalid snapshot");
      return;
    }

    const previous = machines.get(snapshot.machineId);
    machines.set(snapshot.machineId, {
      ...previous,
      ...snapshot,
      iconData: snapshot.iconData ?? previous?.iconData ?? null,
      lastReceivedAtMs: Date.now(),
    });
    return;
  }

  if (message.type === "ping") {
    socket.send(JSON.stringify({ type: "pong" }));
  }
}

function handleAuthMessage(socket, session, message) {
  if (message.type !== "auth") {
    tryClose(socket, 1008, "auth required");
    return;
  }

  const expectedToken = String(session.token).trim();
  const receivedToken = typeof message.token === "string" ? message.token.trim() : "";

  if (!expectedToken || receivedToken !== expectedToken) {
    socket.send(JSON.stringify({ type: "auth-failed" }));
    tryClose(socket, 1008, "auth failed");
    return;
  }

  session.authenticated = true;
  socket.send(JSON.stringify({ type: "auth-ok" }));
}

function normalizeSnapshot(message) {
  if (message.version !== 1) return null;
  if (typeof message.machineId !== "string" || !message.machineId.trim()) return null;
  if (typeof message.sampledAtMs !== "number" || !Number.isFinite(message.sampledAtMs)) return null;
  if (message.presence !== "active" && message.presence !== "afk") return null;
  if (typeof message.appName !== "string") return null;
  if (typeof message.iconHash !== "string") return null;
  if (message.iconData !== undefined && typeof message.iconData !== "string" && message.iconData !== null) {
    return null;
  }

  return {
    machineId: message.machineId.trim(),
    sampledAtMs: Math.trunc(message.sampledAtMs),
    presence: message.presence,
    appName: message.appName,
    iconHash: message.iconHash,
    iconData: message.iconData ?? null,
  };
}

function buildState() {
  const now = Date.now();
  return {
    updatedAtMs: now,
    machines: Array.from(machines.values())
      .map((machine) => ({
        ...machine,
        presence: now - machine.lastReceivedAtMs > HEARTBEAT_OFFLINE_AFTER_MS
          ? "offline"
          : machine.presence,
      }))
      .sort((left, right) => left.machineId.localeCompare(right.machineId)),
  };
}

function jsonResponse(payload) {
  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function parseJson(rawData) {
  try {
    return JSON.parse(typeof rawData === "string" ? rawData : new TextDecoder().decode(rawData));
  } catch {
    return null;
  }
}

function tryClose(socket, code, reason) {
  try {
    socket.close(code, reason);
  } catch {}
}
