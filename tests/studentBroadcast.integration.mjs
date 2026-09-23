// Real Nitro endpoints against isolated fake PostgREST; no live Supabase writes.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { spawn } from 'node:child_process'
import { startPersonalFixture } from './fixtures/personalSupabase.mjs'
import { encodePersonalSession } from '../server/utils/personalHomeSession.js'

test('broadcast API: approval, active recipient, parent denial, revoke and stale session', async t => {
  const personal = await startPersonalFixture()
  const rows = []
  let fail = false
  const db = createServer(async (req, res) => {
    res.setHeader('content-type', 'application/json')
    if (fail) { res.writeHead(500); res.end('{}'); return }
    assert.equal(req.headers.apikey, 'fixture-service-key')
    const url = new URL(req.url, 'http://localhost')
    assert.equal(url.pathname, '/rest/v1/student_broadcast_devices')
    let text = ''; for await (const chunk of req) text += chunk
    const body = text ? JSON.parse(text) : null
    let selected = rows.filter(row => [...url.searchParams].every(([key, filter]) => {
      if (['select', 'order', 'limit'].includes(key)) return true
      const [op, ...rest] = filter.split('.'), value = rest.join('.')
      return op === 'eq' ? String(row[key]) === value : op === 'gt' ? row[key] != null && String(row[key]) > value : false
    }))
    if (req.method === 'POST') {
      const row = { id: randomUUID(), status: 'pending', created_at: new Date().toISOString(), ...body }
      rows.push(row); selected = [row]
    }
    if (req.method === 'PATCH') selected.forEach(row => Object.assign(row, body))
    if (url.searchParams.has('select')) selected = selected.map(row => Object.fromEntries(url.searchParams.get('select').split(',').map(key => [key, row[key]])))
    res.end(JSON.stringify(selected))
  })
  await new Promise(resolve => db.listen(0, '127.0.0.1', resolve))
  const probe = createServer(); await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve))
  const port = probe.address().port; await new Promise(resolve => probe.close(resolve))
  const secret = 'fixture-personal-secret-over-thirty-two-characters'
  const key = 'fixture-management-secret-over-thirty-two-characters'
  const app = spawn(process.execPath, ['.output/server/index.mjs'], { env: { ...process.env,
    HOST: '127.0.0.1', PORT: String(port), NUXT_PUBLIC_SUPABASE_URL: personal.url,
    NUXT_PUBLIC_SUPABASE_KEY: 'fixture-public-key', NUXT_PERSONAL_HOME_SECRET: secret,
    NUXT_STUDENT_BROADCAST_ADMIN_KEY: key, NUXT_STUDENT_BROADCAST_SERVICE_KEY: 'fixture-service-key',
    NUXT_STUDENT_BROADCAST_SUPABASE_URL: `http://127.0.0.1:${db.address().port}`
  }, stdio: 'ignore' })
  t.after(async () => { app.kill(); for (const server of [db, personal.server]) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)) } })
  const origin = `http://127.0.0.1:${port}`
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(`${origin}/api/personal-home`)).status === 401) break } catch {}
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  const session = (role, id = 'child-a', expires = Date.now() + 3600000) => `personal_home_session=${encodePersonalSession({ version: 1, role, studentIds: [id], expires }, secret)}`
  const student = session('student'), parent = session('parent')
  let device = ''
  const request = (path, body, cookie = student, headers = {}) => fetch(`${origin}/api/${path}`, {
    method: 'POST', headers: { origin, 'content-type': 'application/json', cookie: `${cookie}; ${device}`, ...headers }, body: JSON.stringify(body)
  })
  const receive = (body, cookie = student, headers = {}) => request('personal-home/broadcast', body, cookie, headers)
  const admin = (body, supplied = key) => request('student-broadcast-admin', body, '', { 'x-broadcast-key': supplied })
  assert.equal((await receive({ action: 'enroll', label: 'Parent phone' }, parent)).status, 403)
  assert.equal(rows.length, 0)
  assert.equal((await receive({ action: 'enroll', label: 'Phone' }, '')).status, 401)
  let response = await receive({ action: 'enroll', label: 'Student test phone' })
  assert.equal(response.status, 200, await response.clone().text())
  device = response.headers.get('set-cookie').split(';')[0]
  assert.match(response.headers.get('set-cookie'), /HttpOnly/)
  const { id } = await response.json()
  assert.equal((await receive({ action: 'start' })).status, 403)
  assert.equal((await admin({ action: 'list' }, 'wrong')).status, 403)
  assert.equal((await admin({ action: 'approve', id })).status, 400)
  assert.equal((await admin({ action: 'approve', id, confirmStudentOnly: true })).status, 200)
  assert.deepEqual(await (await admin({ action: 'send', id, text: 'Before listening' })).json(), { delivered: 0 })
  const started = await (await receive({ action: 'start' })).json()
  assert.ok(started.lease)
  assert.equal((await receive({ action: 'poll', lease: started.lease }, parent)).status, 403)
  assert.equal((await receive({ action: 'poll', lease: started.lease }, session('student', 'child-b'))).status, 403)
  assert.equal((await receive({ action: 'poll', lease: started.lease }, session('student', 'child-a', Date.now() + 90000))).status, 403)
  assert.equal((await receive({ action: 'poll', lease: started.lease }, student, { origin: 'https://evil.test' })).status, 403)
  assert.deepEqual(await (await admin({ action: 'send', id, text: '請帶課本' })).json(), { delivered: 1 })
  response = await receive({ action: 'poll', lease: started.lease })
  assert.equal((await response.json()).message.text, '請帶課本')
  rows[0].message_expires_at = new Date(Date.now() - 1000).toISOString()
  assert.equal((await (await receive({ action: 'poll', lease: started.lease })).json()).message, null)
  const restarted = await (await receive({ action: 'start' })).json()
  assert.equal((await receive({ action: 'poll', lease: started.lease })).status, 403)
  assert.equal((await (await receive({ action: 'poll', lease: restarted.lease })).json()).message, null)
  const list = await (await admin({ action: 'list' })).json()
  assert.equal(list[0].token_hash, undefined)
  assert.equal(list[0].lease_hash, undefined)
  fail = true
  assert.equal((await receive({ action: 'poll', lease: restarted.lease })).status, 503)
  fail = false
  await admin({ action: 'revoke', id })
  assert.equal((await receive({ action: 'poll', lease: restarted.lease })).status, 403)
  assert.deepEqual(await (await admin({ action: 'send', id, text: 'Revoked' })).json(), { delivered: 0 })
  await admin({ action: 'approve', id, confirmStudentOnly: true })
  const final = await (await receive({ action: 'start' })).json()
  await receive({ action: 'stop', lease: final.lease })
  assert.equal((await receive({ action: 'poll', lease: final.lease })).status, 403)
})
