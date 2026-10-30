import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'
import { taiwanCalendarDate } from '../app/utils/specialMessageSchedule.js'

test('student and teacher uploads stay in their private channel, with teacher editing and deletion', async t => {
  const rows = [], objects = new Map()
  const authTables = {
    students: [{ id: 'child-a', birthday: '20130514', id_last_5: '12345', id_number: null }],
    parents: [{ student_id: 'child-a', email: 'parent@example.test' }],
    parent_bindings: [],
    system_settings: [
      { setting_key: 'admin_password', setting_value: { type: 'custom', custom_pwd: 'fixture-teacher-password' } },
      { setting_key: 'special_message_dates', setting_value: { dates: [taiwanCalendarDate()] } }
    ]
  }
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
    const table = url.pathname.slice('/rest/v1/'.length)
    if (!url.pathname.startsWith('/rest/v1/') || (table !== 'private_message_media' && !authTables[table])) return json({ message: 'unknown table' }, 404)
    let selected = (table === 'private_message_media' ? rows : authTables[table]).filter(row => [...url.searchParams].every(([key, filter]) => {
      if (['select', 'order', 'limit', 'offset'].includes(key)) return true
      const [op, ...parts] = filter.split('.')
      const value = parts.join('.')
      if (op === 'eq') return String(row[key]) === value
      if (op === 'is' && value === 'null') return row[key] == null
      return false
    }))
    if (table === 'private_message_media' && req.method === 'POST') {
      const row = { created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...body }
      rows.push(row); selected = [row]
    }
    if (table === 'private_message_media' && req.method === 'PATCH') selected.forEach(row => Object.assign(row, body))
    if (table === 'private_message_media' && req.method === 'DELETE') for (const row of selected) rows.splice(rows.indexOf(row), 1)
    if (req.method === 'GET' && url.searchParams.has('limit')) {
      const offset = Number(url.searchParams.get('offset') || 0)
      selected = selected.slice(offset, offset + Number(url.searchParams.get('limit')))
    }
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
    HOST: '127.0.0.1', PORT: String(port), NUXT_PUBLIC_SUPABASE_URL: mediaUrl,
    NUXT_PUBLIC_SUPABASE_KEY: 'fixture-public-key', NUXT_PRIVATE_MEDIA_SECRET: '',
    NUXT_PRIVATE_MEDIA_SUPABASE_URL: '', NUXT_PRIVATE_MEDIA_SERVICE_KEY: '',
    NUXT_STUDENT_BROADCAST_SUPABASE_URL: mediaUrl,
    NUXT_STUDENT_BROADCAST_SERVICE_KEY: 'fixture-existing-service-key-over-thirty-two-characters'
  }, stdio: 'ignore' })
  t.after(async () => {
    app.kill()
    media.closeAllConnections(); await new Promise(resolve => media.close(resolve))
  })
  const origin = `http://127.0.0.1:${port}`
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(`${origin}/api/private-media/media?studentId=child-a&chatType=學生`)).status === 401) break } catch {}
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  let cookie = ''
  const post = body => fetch(`${origin}/api/private-media/media`, { method: 'POST', headers: {
    cookie, origin, 'content-type': 'application/json' }, body: JSON.stringify(body) })
  const list = (chatType = '學生') => fetch(`${origin}/api/private-media/media?studentId=child-a&chatType=${encodeURIComponent(chatType)}`, { headers: { cookie } })
  const login = body => fetch(`${origin}/api/private-media/session`, { method: 'POST', headers: { origin, 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'login', ...body }) })
  let response = await login({ role: 'student', authMethod: 'birthday-only', birthday: '20130514' })
  assert.equal(response.status, 200)
  assert.equal((await response.clone().json()).studentId, 'child-a')
  cookie = response.headers.getSetCookie().find(value => value.startsWith('private_media_session=')).split(';')[0]
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
  response = await login({ role: 'teacher', password: 'fixture-teacher-password', timezoneOffset: -480 })
  assert.equal(response.status, 200, await response.clone().text())
  cookie = response.headers.getSetCookie().find(value => value.startsWith('private_media_session=')).split(';')[0]
  const teacherCookie = cookie
  const unread = () => fetch(`${origin}/api/private-media/media?mode=unread-counts`, { headers: { cookie } })
  assert.equal((await (await unread()).json()).counts['child-a_學生'], 1)
  assert.equal((await post({ action: 'mark-read', studentId: 'child-a', chatType: '學生' })).status, 200)
  assert.equal((await (await unread()).json()).counts['child-a_學生'], undefined)
  response = await post({ action: 'prepare', studentId: 'child-a', chatType: '家長', type: 'image/png', size: 4, caption: '給家長的照片' })
  assert.equal(response.status, 200, await response.clone().text())
  const teacherUpload = await response.json()
  assert.equal((await client.storage.from(teacherUpload.bucket).uploadToSignedUrl(teacherUpload.path, teacherUpload.token,
    new Blob(['ijkl'], { type: 'image/png' }))).error, null)
  response = await post({ action: 'complete', ticket: teacherUpload.ticket })
  assert.equal(response.status, 200, await response.clone().text())
  const teacherMedia = (await response.json()).media
  assert.equal(teacherMedia.senderRole, '導師')
  assert.ok(rows.find(row => row.id === teacherMedia.id).read_at)
  assert.equal((await (await unread()).json()).counts['child-a_家長'], undefined)
  response = await login({ role: 'parent', studentId: 'child-a', authMethod: 'id', birthday: '20130514', idLast4: '2345' })
  assert.equal(response.status, 200, await response.clone().text())
  cookie = response.headers.getSetCookie().find(value => value.startsWith('private_media_session=')).split(';')[0]
  response = await list('家長')
  assert.equal(response.status, 200, await response.clone().text())
  assert.deepEqual((await response.json()).media.map(item => item.id), [teacherMedia.id])
  assert.equal((await list('學生')).status, 403)
  assert.equal((await post({ action: 'delete', id: teacherMedia.id })).status, 403)
  response = await post({ action: 'prepare', studentId: 'child-a', chatType: '家長', type: 'image/png', size: 4, caption: '家長回傳' })
  assert.equal(response.status, 200, await response.clone().text())
  const parentUpload = await response.json()
  assert.equal((await client.storage.from(parentUpload.bucket).uploadToSignedUrl(parentUpload.path, parentUpload.token,
    new Blob(['mnop'], { type: 'image/png' }))).error, null)
  response = await post({ action: 'complete', ticket: parentUpload.ticket })
  assert.equal(response.status, 200, await response.clone().text())
  const parentMedia = (await response.json()).media
  assert.equal(parentMedia.senderRole, '家長')
  assert.equal((await post({ action: 'delete', id: parentMedia.id })).status, 403)
  cookie = teacherCookie
  assert.equal((await (await unread()).json()).counts['child-a_家長'], 1)
  assert.equal((await post({ action: 'delete', id: parentMedia.id })).status, 200)
  assert.equal((await post({ action: 'delete', id: teacherMedia.id })).status, 200)
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
