// Actual Nitro APIs with isolated, stateful fake PostgREST; no production writes.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { spawn } from 'node:child_process'
import { startPersonalFixture } from './fixtures/personalSupabase.mjs'
import { dynamicTeacherPassword } from '../server/utils/teacherSession.js'

test('student inbox: automatic binding, offline delivery, role isolation, rotation, expiry and retry deduplication', async t => {
  const personal = await startPersonalFixture()
  const tables = {
    students: [
      { id: 'child-a', seat_number: 1, real_name: '測試小安' },
      { id: 'child-b', seat_number: 2, real_name: '測試小晴' },
      { id: 'child-c', seat_number: 3, real_name: '測試其他' }
    ],
    student_broadcast_clients: [], student_broadcast_inbox: []
  }
  let fail = false
  const db = createServer(async (req, res) => {
    res.setHeader('content-type', 'application/json')
    if (fail) { res.writeHead(500); res.end('{}'); return }
    assert.equal(req.headers.apikey, 'fixture-service-key')
    const url = new URL(req.url, 'http://localhost')
    const table = tables[url.pathname.replace('/rest/v1/', '')]
    if (!table) { res.writeHead(404); res.end('{}'); return }
    let raw = ''; for await (const chunk of req) raw += chunk
    const body = raw ? JSON.parse(raw) : null
    let selected = table.filter(row => [...url.searchParams].every(([key, filter]) => {
      if (['select', 'order', 'limit', 'offset', 'on_conflict'].includes(key)) return true
      const [op, ...rest] = filter.split('.'), value = rest.join('.')
      if (op === 'eq') return String(row[key]) === value
      if (op === 'gt') return row[key] != null && String(row[key]) > value
      if (op === 'is') return value === 'null' && row[key] == null
      if (op === 'in') return value.slice(1, -1).split(',').includes(String(row[key]))
      throw Error('Unsupported filter ' + filter)
    }))
    if (req.method === 'POST') {
      selected = []
      for (const item of Array.isArray(body) ? body : [body]) {
        if (url.searchParams.has('on_conflict') && table.some(row => row.broadcast_id === item.broadcast_id && row.student_id === item.student_id)) continue
        const row = { id: randomUUID(), created_at: new Date().toISOString(), disabled_at: null, read_at: null, ...item }
        table.push(row); selected.push(row)
      }
    }
    if (req.method === 'PATCH') selected.forEach(row => Object.assign(row, body))
    const order = url.searchParams.get('order')
    if (order) selected = [...selected].sort((a,b) => {
      for (const spec of order.split(',')) { const [key, dir] = spec.split('.'); if (a[key] !== b[key]) return (a[key] < b[key] ? -1 : 1) * (dir === 'desc' ? -1 : 1) }
      return 0
    })
    const offset = Number(url.searchParams.get('offset') || 0), limit = Number(url.searchParams.get('limit') || 10000)
    selected = selected.slice(offset, offset + limit)
    if (url.searchParams.has('select')) selected = selected.map(row => Object.fromEntries(url.searchParams.get('select').split(',').map(key => [key, row[key]])))
    res.end(JSON.stringify(selected))
  })
  await new Promise(resolve => db.listen(0, '127.0.0.1', resolve))
  const probe = createServer(); await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve))
  const port = probe.address().port; await new Promise(resolve => probe.close(resolve))
  const app = spawn(process.execPath, ['.output/server/index.mjs'], { env: { ...process.env,
    HOST: '127.0.0.1', PORT: String(port), NUXT_PUBLIC_SUPABASE_URL: personal.url,
    NUXT_PUBLIC_SUPABASE_KEY: 'fixture-public-key', NUXT_PERSONAL_HOME_SECRET: 'fixture-personal-secret-over-thirty-two-characters',
    NUXT_STUDENT_BROADCAST_SERVICE_KEY: 'fixture-service-key',
    NUXT_STUDENT_BROADCAST_SUPABASE_URL: `http://127.0.0.1:${db.address().port}`
  }, stdio: 'ignore' })
  t.after(async () => { app.kill(); for (const server of [db, personal.server]) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)) } })
  const origin = `http://127.0.0.1:${port}`
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(`${origin}/api/personal-home`)).status === 401) break } catch {}
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  function browser() {
    const cookies = new Map()
    return {
      cookies,
      async request(path, body, headers = {}) {
        const response = await fetch(`${origin}/api/${path}`, {
          method: 'POST', headers: { origin, 'content-type': 'application/json', cookie: [...cookies].map(([key,value]) => key+'='+value).join('; '), ...headers }, body: JSON.stringify(body)
        })
        for (const cookie of response.headers.getSetCookie()) {
          const part = cookie.split(';')[0], split = part.indexOf('='), name = part.slice(0, split), value = part.slice(split + 1)
          if (/Max-Age=0/i.test(cookie)) cookies.delete(name)
          else cookies.set(name, value)
        }
        return response
      }
    }
  }
  const teacher = browser(), a = browser(), b = browser(), secondA = browser(), anonymous = browser()
  const inbox = (client, extra = {}) => client.request('personal-home/broadcast', { action: 'inbox', ...extra })
  const login = (client, role = 'student', child = 'a') => client.request('personal-home/session', {
    role, seatNumber: child === 'a' ? '1' : '2', birthday: child === 'a' ? '20130514' : '20140514',
    idLast5: child === 'a' ? '12345' : '23456', email: 'parent@example.test'
  })
  const admin = body => teacher.request('student-broadcast-admin', body)
  assert.equal((await admin({ action: 'list' })).status, 401)
  assert.equal((await inbox(anonymous)).status, 401)
  assert.equal((await teacher.request('teacher-session', { action: 'login', password: dynamicTeacherPassword() })).status, 200)
  const requestId = randomUUID(), send = { action: 'send', studentIds: ['child-a'], text: '離線時先發送', requestId }
  assert.equal((await admin(send)).status, 200)
  assert.equal(tables.student_broadcast_inbox.length, 1)
  await admin(send)
  assert.equal(tables.student_broadcast_inbox.length, 1, 'A retry must not duplicate the message')
  const loggedIn = await login(a)
  assert.equal(loggedIn.status, 200)
  assert.equal((await loggedIn.json()).broadcastBound, true)
  assert.ok(loggedIn.headers.getSetCookie().some(c => c.startsWith('student_broadcast_browser=') && /HttpOnly/.test(c) && /Max-Age=7776000/.test(c)))
  let data = await (await inbox(a)).json()
  assert.equal(data.student.real_name, '測試小安')
  assert.equal(data.messages[0].text, send.text)
  assert.ok(!JSON.stringify(data).includes('token_hash'))
  // Browser binding survives expiration/removal of the shorter personal-home session.
  a.cookies.delete('personal_home_session')
  assert.equal((await inbox(a)).status, 200)
  await login(b, 'student', 'b')
  assert.equal((await (await inbox(b, { studentId: 'child-a' })).json()).messages.length, 0)
  await b.request('personal-home/broadcast', { action: 'ack', ids: [data.messages[0].id] })
  assert.equal((await (await inbox(a)).json()).messages.length, 1, 'B cannot acknowledge A messages')
  await login(secondA)
  assert.equal((await (await inbox(secondA)).json()).messages.length, 1)
  await secondA.request('personal-home/broadcast', { action: 'ack', ids: [data.messages[0].id] })
  assert.equal((await (await inbox(a)).json()).messages.length, 0, 'Read state is per student across browsers')
  const list = await (await admin({ action: 'list' })).json()
  assert.equal(list[0].browsers, 2)
  assert.equal(list[0].seat_number, 1)
  assert.ok(list[0].lastSeen)
  assert.equal((await admin({ ...send, requestId: randomUUID(), studentIds: ['unknown'] })).status, 400)
  assert.equal((await a.request('personal-home/broadcast', { action: 'enroll' })).status, 400, 'Old approval API is retired')
  assert.equal((await a.request('personal-home/broadcast', { action: 'inbox' }, { origin: 'https://evil.test' })).status, 403)
  await admin({ action: 'send', all: true, requestId: randomUUID(), text: '全班通知' })
  assert.equal((await (await inbox(a)).json()).messages.length, 1)
  assert.equal((await (await inbox(b)).json()).messages.length, 1)
  const oldA = a.cookies.get('student_broadcast_browser')
  await login(a, 'parent')
  assert.equal(a.cookies.has('student_broadcast_browser'), false)
  assert.equal((await inbox(a)).status, 403)
  const replay = browser(); replay.cookies.set('student_broadcast_browser', oldA)
  assert.equal((await inbox(replay)).status, 401, 'Parent login revokes former browser credential')
  assert.equal((await a.request('student-broadcast-admin', { action: 'list' })).status, 401)
  // Switching students revokes the old credential and never transfers another inbox.
  const oldB = b.cookies.get('student_broadcast_browser')
  await login(b, 'student', 'a')
  assert.equal((await (await inbox(b)).json()).student.id, 'child-a')
  replay.cookies.set('student_broadcast_browser', oldB)
  assert.equal((await inbox(replay)).status, 401)
  for (const message of tables.student_broadcast_inbox) message.expires_at = new Date(Date.now() - 1000).toISOString()
  assert.equal((await (await inbox(b)).json()).messages.length, 0)
  fail = true
  assert.equal((await inbox(b)).status, 503)
  fail = false
  await b.request('personal-home/broadcast', { action: 'disconnect' })
  assert.equal((await inbox(b)).status, 401, 'Disconnect does not silently rebind from personal session')
  await secondA.request('personal-home/logout', {})
  assert.equal((await inbox(secondA)).status, 401)
  // Whole-class lookup must not truncate at the database default page size.
  for (let i = 0; i < 1001; i++) tables.students.push({ id: 'extra-'+i, seat_number: i+4, real_name: 'Fixture '+i })
  assert.equal((await (await admin({ action: 'list' })).json()).length, 1004)
  assert.equal((await (await admin({ action: 'send', all: true, requestId: randomUUID(), text: '完整名單' })).json()).queued, 1004)
})
