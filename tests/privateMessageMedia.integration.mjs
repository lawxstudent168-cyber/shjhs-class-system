import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { once } from 'node:events'
import { startPersonalFixture } from './fixtures/personalSupabase.mjs'
import { dynamicTeacherPassword } from '../server/utils/teacherSession.js'

test('media API enforces verified conversation role and teacher-only edits', async t => {
  const fixture = await startPersonalFixture()
  const probe = createServer().listen(0, '127.0.0.1')
  await once(probe, 'listening')
  const port = probe.address().port
  await new Promise(resolve => probe.close(resolve))
  const app = spawn(process.execPath, ['.output/server/index.mjs'], { env: { ...process.env,
    HOST: '127.0.0.1', PORT: String(port), NUXT_PUBLIC_SUPABASE_URL: fixture.url,
    NUXT_PUBLIC_SUPABASE_KEY: 'fixture-public-key', NUXT_PERSONAL_HOME_SECRET: 'fixture-personal-secret-over-thirty-two-characters',
    NUXT_STUDENT_BROADCAST_SUPABASE_URL: 'http://127.0.0.1:9', NUXT_STUDENT_BROADCAST_SERVICE_KEY: 'fixture-service-key'
  }, stdio: 'ignore' })
  t.after(async () => { app.kill(); fixture.server.closeAllConnections(); await new Promise(resolve => fixture.server.close(resolve)) })
  const origin = `http://127.0.0.1:${port}`
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(`${origin}/api/personal-home`)).status === 401) break } catch {}
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  let cookie = ''
  const get = query => fetch(`${origin}/api/personal-home/media?${new URLSearchParams(query)}`, { headers: { cookie } })
  const post = body => fetch(`${origin}/api/personal-home/media`, { method: 'POST', headers: {
    cookie, origin, 'content-type': 'application/json' }, body: JSON.stringify(body) })
  assert.equal((await get({ studentId: 'child-a', chatType: '學生' })).status, 401)
  assert.equal((await post({ action: 'delete', id: 'a0000000-0000-4000-8000-000000000000' })).status, 401)
  let response = await fetch(`${origin}/api/personal-home/session`, { method: 'POST', headers: { origin, 'content-type': 'application/json' },
    body: JSON.stringify({ role: 'student', seatNumber: '1', birthday: '20130514', idLast5: '12345' }) })
  assert.equal(response.status, 200)
  cookie = response.headers.getSetCookie().find(value => value.startsWith('personal_home_session=')).split(';')[0]
  assert.equal((await get({ studentId: 'child-b', chatType: '學生' })).status, 403)
  assert.equal((await get({ studentId: 'child-a', chatType: '家長' })).status, 403)
  assert.equal((await post({ action: 'edit', id: 'a0000000-0000-4000-8000-000000000000', caption: 'changed' })).status, 403)
  assert.equal((await post({ action: 'delete', id: 'a0000000-0000-4000-8000-000000000000' })).status, 403)
  assert.equal((await post({ action: 'prepare-replacement', id: 'a0000000-0000-4000-8000-000000000000', type: 'image/png', size: 12 })).status, 403)
  assert.equal((await post({ action: 'prepare', studentId: 'child-a', chatType: '家長', type: 'image/png', size: 12 })).status, 403)
  assert.equal((await post({ action: 'prepare', studentId: 'child-a', chatType: '學生', type: 'image/svg+xml', size: 12 })).status, 400)
  assert.equal((await post({ action: 'prepare', studentId: 'child-a', chatType: '學生', type: 'image/png', size: 12 })).status, 503,
    'Authorized upload reaches the intentionally unavailable fixture Storage')
  response = await fetch(`${origin}/api/personal-home/session`, { method: 'POST', headers: { origin, 'content-type': 'application/json', cookie },
    body: JSON.stringify({ role: 'parent', seatNumber: '1', birthday: '20130514', idLast5: '12345', email: 'parent@example.test' }) })
  cookie = response.headers.getSetCookie().find(value => value.startsWith('personal_home_session=')).split(';')[0]
  assert.equal((await get({ studentId: 'child-a', chatType: '學生' })).status, 403)
  assert.equal((await post({ action: 'delete', id: 'a0000000-0000-4000-8000-000000000000' })).status, 403)
  response = await fetch(`${origin}/api/teacher-session`, { method: 'POST', headers: { origin, 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'login', password: dynamicTeacherPassword() }) })
  assert.equal(response.status, 200)
  cookie = response.headers.getSetCookie().find(value => value.startsWith('teacher_session=')).split(';')[0]
  assert.equal((await post({ action: 'edit', id: 'a0000000-0000-4000-8000-000000000000', caption: 'changed' })).status, 503,
    'Teacher edit reaches the intentionally unavailable fixture database')
})
