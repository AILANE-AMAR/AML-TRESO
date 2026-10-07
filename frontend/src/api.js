export async function api(url, opts) {
  const r = await fetch('/api' + url, opts)
  if (!r.ok) {
    let msg = r.statusText
    try { msg = (await r.json()).message || msg } catch {}
    throw new Error(msg)
  }
  return (r.headers.get('content-type') || '').includes('json') ? r.json() : null
}
export const post = (url, body) =>
  api(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
export const put = (url, body) =>
  api(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
export const upload = (url, file, extra = {}) => {
  const f = new FormData()
  f.append('file', file)
  Object.entries(extra).forEach(([k, v]) => f.append(k, v))
  return api(url, { method: 'POST', body: f })
}
export const euro = (n) => Number(n).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })
export const del = (url) => api(url, { method: 'DELETE' })