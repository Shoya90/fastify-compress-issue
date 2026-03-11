/**
 * Simple server to manually observe the "premature close" error.
 *
 * Start: node server.js
 * Test:  curl -H 'Accept-Encoding: gzip' http://localhost:3000/stream --max-time 0.1
 *
 * The --max-time flag makes curl abort early, triggering the bug.
 * Watch the server logs for "premature close" at error level.
 */
const Fastify = require('fastify')
const fastifyCompress = require('@fastify/compress')
const { Readable } = require('stream')

async function start () {
  const app = Fastify({ logger: true })

  await app.register(fastifyCompress, {
    global: true,
    encodings: ['gzip'],
    threshold: 1024
  })

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

  await app.listen({ port: 3000 })
}

start()
