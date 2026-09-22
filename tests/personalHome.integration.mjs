// Run after npm run build: node --test tests/personalHome.integration.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { once } from 'node:events'
import { startPersonalFixture } from './fixtures/personalSupabase.mjs'

test('real API: authentication, scoping, child switching, no writes and logout', async t => {
  const fixture = await startPersonalFixture()
  const portProbe = createServer().listen(0, '127.0.0.1')
  await once(portProbe, 'listening')
  const port = portProbe.address().port
  await new Promise(resolve => portProbe.close(resolve))
  const app = spawn(process.execPath, ['.output/server/index.mjs'], { env: { ...process.env,
    HOST: '127.0.0.1', PORT: String(port),
    NUXT_PUBLIC_SUPABASE_URL: fixture.url, NUXT_PUBLIC_SUPABASE_KEY: 'fixture-public-key',
    NUXT_PERSONAL_HOME_SECRET: 'fixture-secret-only-at-least-thirty-two-characters'
  }, stdio: ['ignore', 'pipe', 'pipe'] })
  let logs = ''
  app.stdout.on('data', chunk => { logs += chunk })
  app.stderr.on('data', chunk => { logs += chunk })
  t.after(async () => { app.kill(); fixture.server.closeAllConnections(); await new Promise(resolve => fixture.server.close(resolve)) })
  const origin = `http://127.0.0.1:${port}`
  let started = false
  for (let i = 0; i < 100; i++) {
    try { const res = await fetch(`${origin}/api/personal-home`); if (res.status === 401) { started = true; break } } catch {}
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  assert.ok(started, logs)
  let cookie = ''
  const api = (path = '', options = {}) => fetch(`${origin}/api/personal-home${path}`, { ...options, headers: { cookie, origin, 'content-type': 'application/json', ...options.headers } })
  const credentials = { role: 'parent', seatNumber: '1', birthday: '20130514', idLast5: '12345', email: 'parent@example.test' }
  let response = await api('/session', { method: 'POST', body: JSON.stringify({ ...credentials, idLast5: '00000' }) })
  assert.equal(response.status, 401)
  assert.equal(response.headers.get('set-cookie'), null)
  response = await api('/session', { method: 'POST', body: JSON.stringify(credentials) })
  assert.equal(response.status, 200, await response.clone().text())
  cookie = response.headers.get('set-cookie').split(';')[0]
  assert.match(response.headers.get('set-cookie'), /HttpOnly/i)
  assert.match(response.headers.get('set-cookie'), /SameSite=Strict/i)
  response = await api()
  assert.equal(response.status, 200, await response.clone().text())
  assert.match(response.headers.get('cache-control'), /no-store/)
  let data = await response.json()
  assert.equal(data.student.id, 'child-a')
  assert.deepEqual(data.counts, { overdue: 1, pending: 1, submitted: 1 })
  assert.deepEqual(data.messages.map(m => m.id), ['msg-a'])
  assert.equal(data.leaves.length, 1)
  assert.ok(!JSON.stringify(data).includes('12345'))
  assert.equal((await api('?studentId=child-b')).status, 403)
  response = await api('/session', { method: 'POST', body: JSON.stringify({ ...credentials, seatNumber: '2', birthday: '20140514', idLast5: '23456' }) })
  assert.equal(response.status, 200)
  cookie = response.headers.get('set-cookie').split(';')[0]
  response = await api('?studentId=child-b')
  data = await response.json()
  assert.equal(data.children.length, 2)
  assert.deepEqual(data.messages.map(m => m.id), ['msg-c'])
  assert.equal(data.leaves.length, 0)
  assert.equal((await api('?studentId=child-a')).status, 200)
  assert.equal((await api('?studentId=child-c')).status, 403)
  response = await api('/session', { method: 'POST', body: JSON.stringify({ ...credentials, role: 'student' }) })
  cookie = response.headers.get('set-cookie').split(';')[0]
  data = await (await api()).json()
  assert.equal(data.role, 'student')
  assert.deepEqual(data.messages.map(m => m.id), ['msg-b'])
  assert.deepEqual(data.leaves, [])
  assert.equal(data.children.length, 1)
  assert.equal((await api('?studentId=child-b')).status, 403)
  assert.equal((await api('/logout', { method: 'POST', body: '{}', headers: { origin: 'https://unrelated.example' } })).status, 403)
  response = await api('/logout', { method: 'POST', body: '{}' })
  assert.equal(response.status, 200)
  assert.match(response.headers.get('set-cookie'), /Max-Age=0/i)
  cookie = ''
  assert.equal((await api()).status, 401)
  assert.ok(fixture.requests.every(r => r.method === 'GET'), 'Personal homepage must not write or mark messages read')
})
