/**
 * Reproduction for @fastify/compress "premature close" error
 * in the onSend hook path (global: true).
 *
 * The bug: pump() in the onSend hook attaches end-of-stream listeners to the
 * compression stream. When a client disconnects before the response finishes,
 * Fastify tears down the stream. end-of-stream detects this as "premature close"
 * and the onEnd callback logs it as an error — even though client disconnection
 * is a normal, expected event that Fastify already handles.
 *
 * Run: node reproduce.js
 *
 * Expected: no errors logged (client disconnection is not a server error)
 * Actual: "premature close" errors logged at level 50 (error)
 */
const Fastify = require('fastify')
const fastifyCompress = require('@fastify/compress')
const net = require('net')
const { Readable, Writable } = require('stream')

async function reproduce () {
  let prematureCloseCount = 0

  const app = Fastify({
    logger: {
      level: 'error',
      stream: new Writable({
        write (chunk, encoding, callback) {
          if (chunk.toString().includes('premature close')) {
            prematureCloseCount++
          }
          callback()
        }
      })
    }
  })

  await app.register(fastifyCompress, {
    global: true,
    encodings: ['gzip'],
    threshold: 1024
  })

  // Streaming endpoint — simulates a database cursor or any async data source.
  // Each chunk is emitted with a small delay, which is realistic for DB queries,
  // SSE streams, or any I/O-bound data pipeline.
  app.get('/stream', async (request, reply) => {
    let chunks = 0
    const stream = new Readable({
      read () {
        if (chunks >= 20) {
          this.push(null)
          return
        }
        setTimeout(() => {
          this.push(JSON.stringify({ id: chunks, data: 'x'.repeat(1000) }) + '\n')
          chunks++
        }, 50)
      }
    })
    reply.type('text/plain')
    return stream
  })

  await app.listen({ port: 0 })
  const port = app.server.address().port

  console.log(`Node ${process.version} | @fastify/compress ${require('@fastify/compress/package.json').version}\n`)

  // Simulate clients that disconnect before the full response is sent.
  // This is common in production: load balancer timeouts, mobile clients
  // navigating away, browser tab closes, cancelled fetch() calls, etc.
  for (let i = 0; i < 50; i++) {
    await new Promise((resolve) => {
      const sock = net.connect(port, '127.0.0.1', () => {
        sock.write('GET /stream HTTP/1.1\r\nHost: localhost\r\nAccept-Encoding: gzip\r\n\r\n')
        // Disconnect after receiving partial response
        setTimeout(() => {
          sock.destroy()
          resolve()
        }, 100)
      })
      sock.on('error', () => resolve())
    })
  }

  // Allow pending callbacks to fire
  await new Promise((r) => setTimeout(r, 2000))
  await app.close()

  console.log(`\nPremature close errors: ${prematureCloseCount} / 50 requests`)
  if (prematureCloseCount > 0) {
    console.log('BUG CONFIRMED: client disconnects cause spurious error-level logs')
    process.exit(1)
  } else {
    console.log('No errors detected')
  }
}

reproduce().catch(console.error)
