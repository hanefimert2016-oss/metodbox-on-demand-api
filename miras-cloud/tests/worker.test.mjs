import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker.mjs';

const env = {GITHUB_TOKEN:'', SESSION_SECRET:'test-only-do-not-use-production', PUBLIC_BASE_URL:'https://miras.example'};
const get = (path, headers={}) => worker.fetch(new Request('https://miras.example'+path,{headers}),env);

test('curated videos include real licensed source, stable share URL and languages',async()=>{
 const r=await get('/api/videos'); assert.equal(r.status,200);
 const body=await r.json();assert.ok(body.videos.length>=6);
 for(const v of body.videos){assert.ok(v.video_url.startsWith('https://commons.wikimedia.org/'));assert.ok(v.source_url.includes('commons.wikimedia.org/wiki/File:'));assert.ok(v.license);assert.ok(v.creator);assert.ok(v.share_url.endsWith('/watch/'+v.id));assert.ok(v.title.en&&v.title.tr)}
});

test('private features fail closed when not configured',async()=>{
 const r=await worker.fetch(new Request('https://miras.example/api/auth/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:'testuser',password:'0123456789',displayName:'Test'})}),env);
 assert.equal(r.status,503);
});

test('share landing returns video HTML and correct absolute canonical URL',async()=>{
 const r=await get('/watch/bosphorus');assert.equal(r.status,200);
 const html=await r.text();assert.match(html,/<video/);assert.match(html,/og:video/);assert.match(html,/commons\.wikimedia\.org/);
 assert.match(html,/https:\/\/miras.example\/watch\/bosphorus/);
});

test('input is validated; unknown videos are 404',async()=>{
 const r=await get('/api/videos/does-not-exist');assert.equal(r.status,404);
 const social=await get('/api/videos/bosphorus/social');assert.equal(social.status,200);
 const body=await social.json();assert.equal(body.likes,0);assert.deepEqual(body.comments,[]);
});
