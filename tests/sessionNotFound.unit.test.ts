import assert from "node:assert/strict";
import { once } from "node:events";
import type { Server } from "node:http";
import test from "node:test";
import { BaseMcpServer } from "../src/core/BaseMcpServer.js";

// MCP Streamable HTTP: a request carrying an unknown session ID gets 404, which
// tells the client to re-initialize (e.g. after the server restarted).
test("HTTP requests with an unknown session ID get 404, a missing one 400", async () => {
  const mcpServer = new BaseMcpServer("session-not-found-test", []);

  try {
    await mcpServer.startHttpServer(0, "127.0.0.1");
    const httpServer = (mcpServer as unknown as { httpServer: Server }).httpServer;
    if (!httpServer.listening) await once(httpServer, "listening");
    const address = httpServer.address();
    assert(address && typeof address !== "string");
    const endpoint = `http://127.0.0.1:${address.port}/mcp`;

    const headers = {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    };
    const toolsList = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} });
    const unknownSession = { ...headers, "mcp-session-id": "00000000-0000-0000-0000-000000000000" };

    const unknownPost = await fetch(endpoint, { method: "POST", headers: unknownSession, body: toolsList });
    assert.equal(unknownPost.status, 404);
    assert.equal((await unknownPost.json()).error.message, "Session not found");

    for (const method of ["GET", "DELETE"]) {
      const response = await fetch(endpoint, { method, headers: unknownSession });
      assert.equal(response.status, 404, method);
      await response.body?.cancel();
    }

    const missingPost = await fetch(endpoint, { method: "POST", headers, body: toolsList });
    assert.equal(missingPost.status, 400);
    await missingPost.body?.cancel();

    const missingGet = await fetch(endpoint, { method: "GET", headers });
    assert.equal(missingGet.status, 400);
    await missingGet.body?.cancel();
  } finally {
    await mcpServer.stopHttpServer();
  }
});
