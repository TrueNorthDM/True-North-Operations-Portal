// Copy every file from the cloud's storage to this server's (deploy/migrate/copy.sh,
// step 5), through both storage APIs: the buckets with their settings first, then
// each file with its content type. Run in a node:22 container on the host network.
// It only reads from the cloud.

const { CLOUD_SUPABASE_URL: C, CLOUD_SERVICE_KEY: CK, LOCAL_URL: L, LOCAL_SERVICE_KEY: LK } = process.env
const auth = (key, extra = {}) => ({ apikey: key, Authorization: `Bearer ${key}`, ...extra })
const enc = (path) => path.split('/').map(encodeURIComponent).join('/')

async function json(url, init = {}) {
  const r = await fetch(url, init)
  if (!r.ok) throw new Error(`${init.method ?? 'GET'} ${url}: ${r.status} ${await r.text()}`)
  return r.json()
}

// Every file in a bucket; folders come back with a null id and are walked into.
async function listAll(bucket, prefix = '', out = []) {
  for (let offset = 0; ; offset += 1000) {
    const items = await json(`${C}/storage/v1/object/list/${bucket}`, {
      method: 'POST',
      headers: auth(CK, { 'content-type': 'application/json' }),
      body: JSON.stringify({ prefix, limit: 1000, offset, sortBy: { column: 'name', order: 'asc' } }),
    })
    for (const it of items) {
      const path = prefix ? `${prefix}/${it.name}` : it.name
      if (it.id === null) await listAll(bucket, path, out)
      else out.push({ path, type: it.metadata?.mimetype ?? 'application/octet-stream', size: it.metadata?.size ?? 0 })
    }
    if (items.length < 1000) return out
  }
}

let failures = 0
const buckets = await json(`${C}/storage/v1/bucket`, { headers: auth(CK) })
for (const b of buckets) {
  const made = await fetch(`${L}/storage/v1/bucket`, {
    method: 'POST',
    headers: auth(LK, { 'content-type': 'application/json' }),
    body: JSON.stringify({ id: b.id, name: b.name, public: b.public, file_size_limit: b.file_size_limit, allowed_mime_types: b.allowed_mime_types }),
  })
  if (!made.ok && made.status !== 409 && made.status !== 400) throw new Error(`bucket ${b.id}: ${made.status} ${await made.text()}`)

  const files = await listAll(b.id)
  let bytes = 0
  for (const f of files) {
    try {
      const got = await fetch(`${C}/storage/v1/object/${b.id}/${enc(f.path)}`, { headers: auth(CK) })
      if (!got.ok) throw new Error(`download ${got.status}`)
      const body = Buffer.from(await got.arrayBuffer())
      const put = await fetch(`${L}/storage/v1/object/${b.id}/${enc(f.path)}`, {
        method: 'POST',
        headers: auth(LK, { 'content-type': f.type, 'x-upsert': 'true' }),
        body,
      })
      if (!put.ok) throw new Error(`upload ${put.status} ${await put.text()}`)
      bytes += body.length
    } catch (e) {
      failures++
      console.log(`   FAILED ${b.id}/${f.path}: ${e.message}`)
    }
  }
  console.log(`   ${b.id}: ${files.length} files, ${(bytes / 1048576).toFixed(1)} MB${b.public ? ' (public)' : ''}`)
}
if (failures) { console.log(`   ${failures} files failed`); process.exit(1) }
