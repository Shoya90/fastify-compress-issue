# @fastify/compress "premature close" reproduction

Reproduction for spurious `"premature close"` errors when using `@fastify/compress` with `global: true` and streaming responses.

## Setup

```bash
npm install
```

## Reproduce (automated)

```bash
node reproduce.js
```

This starts a Fastify server with a streaming endpoint, sends 50 requests that disconnect mid-stream, and counts the `"premature close"` errors logged at error level.

Expected output:

```
Premature close errors: 50 / 50 requests
BUG CONFIRMED: client disconnects cause spurious error-level logs
```

## Reproduce (manual)

```bash
node server.js
```

In another terminal:

```bash
curl -H 'Accept-Encoding: gzip' http://localhost:3000/stream --max-time 0.1
```

The server logs will show `{"level":50,"msg":"premature close"}`.

## Versions

- **Node.js:** 22.x
- **Fastify:** 5.3.2
- **@fastify/compress:** 8.3.1
