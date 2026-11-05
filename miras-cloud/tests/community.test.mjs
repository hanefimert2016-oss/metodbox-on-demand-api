import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker.mjs';

const stored=new Map();
const original=globalThis.fetch;
const publicBase='https://miras-test.example';
const env={MIRAS_GITHUB_TOKEN:'test-token',MIRAS_SESSION_SECRET:'test-hmac-secret-keep-private',MIRAS_PUBLIC_URL:publicBase};
const call=(path,method='GET',body=null,token='')=>worker.fetch(new Request(publicBase+path,{method,headers:{...(token?{authorization:'Bearer '+token}:{}),...(body instanceof FormData?{}:body?{'content-type':'application/json'}:{})},body:body instanceof FormData?body:body?JSON.stringify(body):undefined}),env);

function githubMock(req,options={}){
 const method=options.method||(typeof req==='string'?'GET':req.method);
 const u=new URL(typeof req==='string'?req:req.url);let p=decodeURIComponent(u.pathname.split('/contents/')[1]||'');
 if(!p)return new Response('not found',{status:404});
 if(method==='GET'){
  const record=stored.get(p);if(!record)return new Response('not found',{status:404});
  return Response.json({sha:record.sha,content:record.content});
 }
 if(method==='PUT'){
  return Promise.resolve(JSON.parse(options.body)).then(body=>{
   const record=stored.get(p);if((record&&record.sha!==body.sha)||(!record&&body.sha))return Response.json({message:'conflict'},{status:409});
   const sha='sha'+(stored.size+1)+'_'+Date.now();stored.set(p,{sha,content:body.content});
   return Response.json({content:{sha},commit:{sha}});
  });
 }
 return new Response('not found',{status:404});
}

test('persistent signup/login and per-user saved library',async()=>{
 globalThis.fetch=githubMock;
 try{
  let r=await call('/api/auth/register','POST',{username:'culturist',password:'securepass123',displayName:'Culture Fan'});
  assert.equal(r.status,201);const value=await r.json();assert.ok(value.token);assert.equal(value.user.username,'culturist');
 }finally{globalThis.fetch=original}
});

test('persistent likes and comments synchronize across users',async()=>{
 globalThis.fetch=githubMock;
 try{
  const rr=await call('/api/auth/login','POST',{username:'culturist',password:'securepass123'});assert.equal(rr.status,200);
  const data=await rr.json();const token=data.token;
  let r=await call('/api/videos/bosphorus/like','POST',{},token);assert.equal(r.status,200);assert.deepEqual(await r.json(),{likes:1,liked:true});
  r=await call('/api/videos/bosphorus/comment','POST',{text:'Beautiful Istanbul!'},token);assert.equal(r.status,201);assert.equal((await r.json()).comments.length,1);
  r=await call('/api/videos/bosphorus/social');const social=await r.json();assert.equal(social.likes,1);assert.equal(social.comments[0].username,'culturist');
  r=await call('/api/videos/bosphorus/save','POST',{},token);assert.equal(r.status,200);assert.ok((await r.json()).saved.includes('bosphorus'));
  r=await call('/api/library','GET',null,token);assert.equal((await r.json()).videos[0].id,'bosphorus');
  r=await call('/api/videos/bosphorus/like','POST',{},token);assert.equal((await r.json()).likes,0);
 }finally{globalThis.fetch=original}
});

test('uploaded MP4 becomes a globally addressable catalog video',async()=>{
 globalThis.fetch=githubMock;
 try{
  const r=await call('/api/auth/login','POST',{username:'culturist',password:'securepass123'});const {token}=await r.json();
  const bytes=new Uint8Array(256);bytes.set([0,0,0,24,102,116,121,112],0);
  const form=new FormData();form.append('video',new File([bytes],'my-culture.mp4',{type:'video/mp4'}));form.append('title','My Istanbul story');form.append('description','A culture video');form.append('category','places');
  const res=await call('/api/upload','POST',form,token);assert.equal(res.status,201,await res.clone().text());
  const {video}=await res.json();assert.ok(video.share_url.startsWith(publicBase+'/watch/'));assert.equal(video.creator,'culturist');assert.ok(video.video_url.startsWith(publicBase+'/media/'));
  const list=await call('/api/videos');const v=(await list.json()).videos.find(x=>x.id===video.id);assert.equal(v.title.en,'My Istanbul story');
  const watch=await call('/watch/'+video.id);assert.equal(watch.status,200);assert.match(await watch.text(),/My Istanbul story/);
 }finally{globalThis.fetch=original}
});
