/* Offline contract tests. No real accounts, uploads, payments or AI requests. */
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
function load(file, imports = {}, globals = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const context = { exports, module: { exports }, require: (name) => {
    if (name === 'server-only') return {};
    if (name in imports) return imports[name];
    if (name.startsWith('node:')) return require(name);
    throw new Error('Unmocked import: ' + name);
  }, console: { log() {}, error() {} }, URL, Request, Response, FormData, Blob, File, Buffer, AbortSignal, Date, setTimeout, process: { env: {} }, ...globals };
  vm.runInNewContext(code, context, { filename: file });
  return context.module.exports;
}
async function main() {
  let session = { user: null, profile: null };
  const media = { athlete_id: 'owner', original_front: 'owner/front.jpg', original_back: 'owner/back.jpg', video_path: 'owner/video.mp4', video_shared: true, updated_at: new Date().toISOString(), state: 'draft', job_id: null };
  let claims = 0;
  const db = { from: () => ({ upsert: async () => ({ error: null }) }), rpc: async () => { claims++; return { error: { code: 'P0001', message: 'Your photos are already being prepared.' } }; } };
  const imports = {
    'next/server': { after: () => { throw new Error('Must not dispatch on rejected request'); }, NextResponse: { json: (data, options) => Response.json(data, options) } },
    'next/cache': { revalidatePath() {} },
    '@/lib/auth': { getSessionUser: async () => session },
    '@/lib/config': { athleteIsAdult: () => true, athleteSportComplete: () => true },
    '@/lib/supabase/admin': { createAdminSupabase: () => db },
    '@/lib/athlete-media': { loadAthleteMedia: async () => media, mediaView: async () => ({}) },
    '@/lib/athlete-media-types': { MEDIA_BUCKET: 'athlete-media', VIDEO_BUCKET: 'athlete-videos' },
    '@/lib/photo': { isJpegBytes: () => false, isPngBytes: () => false },
    '@/lib/prepare-athlete-photos': { PHOTO_MODEL: 'test-model', prepareAthletePhotos() {} },
    '@/lib/rate-limit': { takeToken: () => true },
  };
  const api = load('app/api/athlete-media/route.ts', imports);
  const request = (body, origin = 'https://skinbid.test') => new Request('https://skinbid.test/api/athlete-media', { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  assert.equal((await api.GET()).status, 401);
  session = { user: { id: 'owner' }, profile: { role: 'brand' } };
  assert.equal((await api.POST(request({ action: 'upload' }))).status, 403);
  session.profile.role = 'athlete';
  assert.equal((await api.POST(request({}, 'https://attacker.test'))).status, 403);
  assert.equal((await api.POST(request({ action: 'generate', consent: false }))).status, 400);
  assert.equal((await api.POST(request({ action: 'generate', consent: true }))).status, 503);
  assert.equal(claims, 0, 'Missing API key must not create a paid job');
  assert.equal((await api.POST(request({ action: 'approve', consent: false }))).status, 400);
  assert.equal((await api.POST(request({ action: 'upload', kind: 'front', type: 'text/html', size: 100, consent: true }))).status, 400);
  assert.equal((await api.POST(request({ action: 'complete', kind: 'front', path: 'another-user/original/front.jpg', consent: true }))).status, 400);
  const enabled = load('app/api/athlete-media/route.ts', imports, { process: { env: { OPENROUTER_API_KEY: 'offline-test-only' } } });
  assert.equal((await enabled.POST(request({ action: 'generate', consent: true }))).status, 409);
  assert.equal(claims, 1);

  async function generation(failBack = false) {
    const writes = [], uploads = [], requests = [];
    const fakeDb = {
      storage: { from: () => ({ download: async () => ({ data: new Blob(['fixture'], { type: 'image/jpeg' }) }), upload: async (path) => { uploads.push(path); return { error: null }; } }) },
      from: (table) => ({ update: (value) => { writes.push({ table, value }); const chain = { eq: () => chain, then: (resolve) => resolve({ error: null }) }; return chain; } }),
    };
    const module = load('lib/prepare-athlete-photos.ts', {
      sharp: { default: () => { const chain = { autoOrient: () => chain, resize: (w, h, options) => { assert.equal(w, 1024); assert.equal(h, 1536); assert.equal(options.fit, 'contain'); return chain; }, jpeg: () => chain, toBuffer: async () => Buffer.from('normalized-fixture') }; return chain; } },
      '@/lib/supabase/admin': { createAdminSupabase: () => fakeDb }, '@/lib/athlete-media-types': { MEDIA_BUCKET: 'athlete-media' },
    }, { process: { env: { OPENROUTER_API_KEY: 'offline-test-only' } }, fetch: async (url, options) => {
      const body = JSON.parse(options.body);
      requests.push({ url, body });
      if (failBack && body.prompt.includes('back-view')) return new Response('{}', { status: 429 });
      return Response.json({ data: [{ b64_json: Buffer.from('fixture-output').toString('base64') }], usage: { total_tokens: 123 } });
    } });
    await module.prepareAthletePhotos({ ...media, job_id: 'job-test' });
    assert.equal(requests.length, 2);
    assert.ok(requests.every((r) => r.url === 'https://openrouter.ai/api/v1/images' && r.body.model === 'google/gemini-3.1-flash-image' && r.body.n === 1 && r.body.aspect_ratio === '2:3' && !r.body.provider.allow_fallbacks));
    assert.equal(requests[0].body.input_references.length, 2);
    assert.equal(requests[1].body.input_references.length, 3, 'Back uses generated front as a style reference');
    assert.ok(writes.every((w) => !('approved_front' in w.value)), 'Generation must never publish or approve automatically');
    assert.equal(writes.findLast((w) => w.table === 'athlete_media').value.state, failBack ? 'failed' : 'review');
    assert.equal(uploads.length, failBack ? 1 : 2, 'Partial successful outputs remain saved');
  }
  await generation(); await generation(true);
  const rectTests = fs.readFileSync('supabase/athlete-media.sql', 'utf8');
  assert.ok(rectTests.includes('for update') && rectTests.includes('>= 2') && rectTests.includes("status in ('live','closed')"));
  const proxy = fs.readFileSync('proxy.ts', 'utf8');
  assert.ok(proxy.indexOf('callback.pathname = "/auth/callback"') < proxy.indexOf('if (isWaitlistOnly())'));
  console.log('PASS: media auth, role, origin, consent, missing-key, upload validation, ownership, duplicate job, two-photo preparation, partial failure, approval separation and auth callback recovery contracts. SQL assertions are static, not live migration tests.');
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
