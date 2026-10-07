import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { startPersonalFixture } from './fixtures/personalSupabase.mjs'
import { dynamicTeacherPassword } from '../server/utils/teacherSession.js'

test('media upload, private listing, teacher edit, replacement and deletion', async t => {
  const personal = await startPersonalFixture()
  const rows = [], objects = new Map()
  const media = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1')
    res.setHeader('content-type', 'application/json')
    const json = (value, status = 200) => { res.writeHead(status); res.end(JSON.stringify(value)) }
    let raw = ''
    for await (const chunk of req) raw += chunk
    const body = raw && req.headers['content-type']?.startsWith('application/json') ? JSON.parse(raw) : null
    const storagePrefix = '/storage/v1/object/'
    if (url.pathname.startsWith(storagePrefix)) {
      const suffix = url.pathname.slice(storagePrefix.length)
      if (suffix.startsWith('upload/sign/private-message-media/')) {
        const path = suffix.slice('upload/sign/private-message-media/'.length)
        if (req.method === 'POST') return json({ url: `/object/upload/sign/private-message-media/${path}?token=test-upload` })
        if (req.method === 'PUT' && url.searchParams.get('token') === 'test-upload') {
          objects.set(path, { size: 4, content_type: 'image/png' })
          return json({ Key: path })
        }
      }
      if (suffix.startsWith('info/private-message-media/')) {
        const object = objects.get(suffix.slice('info/private-message-media/'.length))
        return object ? json(object) : json({ message: 'not found' }, 404)
      }
      if (suffix.startsWith('sign/private-message-media/')) {
        return json({ signedURL: `/object/${suffix}?token=test-view` })
      }
      if (suffix === 'private-message-media' && req.method === 'DELETE') {
        for (const path of body.prefixes) objects.delete(path)
        return json([])
      }
      return json({ message: 'unknown storage request' }, 404)
    }
    if (url.pathname !== '/rest/v1/private_message_media') return json({ message: 'unknown table' }, 404)
    let selected = rows.filter(row => [...url.searchParams].every(([key, filter]) => {
      if (['select', 'order', 'limit'].includes(key)) return true
      const [op, ...parts] = filter.split('.')
      const value = parts.join('.')
      return op === 'eq' && String(row[key]) === value
    }))
    if (req.method === 'POST') {
      const row = { created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...body }
      rows.push(row); selected = [row]
    }
    if (req.method === 'PATCH') selected.forEach(row => Object.assign(row, body))
    if (req.method === 'DELETE') for (const row of selected) rows.splice(rows.indexOf(row), 1)
    if (req.method === 'GET' && url.searchParams.has('limit')) selected = selected.slice(0, Number(url.searchParams.get('limit')))
    if (req.headers.accept?.includes('application/vnd.pgrst.object+json')) return selected.length ? json(selected[0]) : json({ code: 'PGRST116' }, 406)
    return json(selected)
  })
  await new Promise(resolve => media.listen(0, '127.0.0.1', resolve))
  const mediaUrl = `http://127.0.0.1:${media.address().port}`
  const probe = createServer()
  await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve))
  const port = probe.address().port
  await new Promise(resolve => probe.close(resolve))
  const app = spawn(process.execPath, ['.output/server/index.mjs'], { env: { ...process.env,
    HOST: '127.0.0.1', PORT: String(port), NUXT_PUBLIC_SUPABASE_URL: personal.url,
    NUXT_PUBLIC_SUPABASE_KEY: 'fixture-public-key', NUXT_PERSONAL_HOME_SECRET: 'fixture-personal-secret-over-thirty-two-characters',
    NUXT_STUDENT_BROADCAST_SUPABASE_URL: mediaUrl, NUXT_STUDENT_BROADCAST_SERVICE_KEY: 'fixture-service-key'
  }, stdio: 'ignore' })
  t.after(async () => {
    app.kill()
    for (const server of [media, personal.server]) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)) }
  })
  const origin = `http://127.0.0.1:${port}`
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(`${origin}/api/personal-home`)).status === 401) break } catch {}
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  let cookie = ''
  const post = body => fetch(`${origin}/api/personal-home/media`, { method: 'POST', headers: {
    cookie, origin, 'content-type': 'application/json' }, body: JSON.stringify(body) })
  const list = () => fetch(`${origin}/api/personal-home/media?studentId=child-a&chatType=學生`, { headers: { cookie } })
  let response = await fetch(`${origin}/api/personal-home/session`, { method: 'POST', headers: { origin, 'content-type': 'application/json' },
    body: JSON.stringify({ role: 'student', seatNumber: '1', birthday: '20130514', idLast5: '12345' }) })
  assert.equal(response.status, 200)
  cookie = response.headers.getSetCookie().find(value => value.startsWith('personal_home_session=')).split(';')[0]
  const client = createClient(mediaUrl, 'fixture-public-key', { auth: { persistSession: false } })
  response = await post({ action: 'prepare', studentId: 'child-a', chatType: '學生', type: 'image/png', size: 4, caption: '原圖' })
  assert.equal(response.status, 200, await response.clone().text())
  let upload = await response.json()
  assert.equal((await client.storage.from(upload.bucket).uploadToSignedUrl(upload.path, upload.token,
    new Blob(['abcd'], { type: 'image/png' }))).error, null)
  response = await post({ action: 'complete', ticket: upload.ticket })
  assert.equal(response.status, 200, await response.clone().text())
  const id = (await response.json()).media.id
  assert.equal((await (await list()).json()).media[0].caption, '原圖')
  assert.equal((await post({ action: 'delete', id })).status, 403)
  response = await fetch(`${origin}/api/teacher-session`, { method: 'POST', headers: { origin, 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'login', password: dynamicTeacherPassword() }) })
  cookie = response.headers.getSetCookie().find(value => value.startsWith('teacher_session=')).split(';')[0]
  response = await post({ action: 'edit', id, caption: '已由導師整理' })
  assert.equal(response.status, 200, await response.clone().text())
  response = await post({ action: 'prepare-replacement', id, type: 'image/png', size: 4 })
  assert.equal(response.status, 200, await response.clone().text())
  upload = await response.json()
  assert.equal((await client.storage.from(upload.bucket).uploadToSignedUrl(upload.path, upload.token,
    new Blob(['efgh'], { type: 'image/png' }))).error, null)
  response = await post({ action: 'complete', ticket: upload.ticket })
  assert.equal(response.status, 200, await response.clone().text())
  assert.equal((await (await list()).json()).media[0].caption, '已由導師整理')
  assert.equal(objects.size, 1)
  response = await post({ action: 'delete', id })
  assert.equal(response.status, 200, await response.clone().text())
  assert.equal((await (await list()).json()).media.length, 0)
  assert.equal(objects.size, 0)
  assert.equal(rows.length, 0)
})
