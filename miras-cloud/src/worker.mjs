import {CURATED} from './curated.mjs';

const REPO='hanefimert2016-oss/Metodbox-secret-system';
const BRANCH='frame-video-storage';
const LIMIT=12*1024*1024;
const TE=new TextEncoder();
const TD=new TextDecoder();
const USER_RE=/^[a-z0-9_]{3,24}$/;
const VIDEO_RE=/^[a-z0-9-]{3,80}$/;
const CORS={'access-control-allow-origin':'*','access-control-allow-methods':'GET,HEAD,POST,OPTIONS','access-control-allow-headers':'Content-Type,Authorization','access-control-max-age':'86400'};
const json=(object,status=200,headers={})=>new Response(JSON.stringify(object),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...CORS,...headers}});
const fail=(code,message)=>json({error:message},code);
const urlSafe=(bytes)=>btoa(Array.from(bytes,b=>String.fromCharCode(b)).join('')).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
const fromUrlSafe=(s)=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-s.length%4)%4)),c=>c.charCodeAt(0));
const b64=(bytes)=>{let out='';for(let i=0;i<bytes.length;i+=8192)out+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(out)};
const repoUrl=p=>`https://api.github.com/repos/${REPO}/contents/${p.split('/').map(encodeURIComponent).join('/')}?ref=${BRANCH}`;
const authHeaders=(env,extra={})=>({'Authorization':`Bearer ${env.MIRAS_GITHUB_TOKEN||''}`,'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'MIRAS-Community-Worker',...extra});
const ready=env=>Boolean(env.MIRAS_GITHUB_TOKEN&&env.MIRAS_SESSION_SECRET);
const assertReady=env=>{if(!ready(env))throw new ApiError(503,'Community server is not configured yet')};
class ApiError extends Error{constructor(status,message){super(message);this.status=status}}

async function ghRead(env,path){
 assertReady(env);
 const response=await fetch(repoUrl(path),{headers:authHeaders(env)});
 if(response.status===404)return {data:null,sha:null};
 if(!response.ok)throw new ApiError(502,'GitHub storage unavailable ('+response.status+')');
 const item=await response.json();
 if(!item.content||!item.sha)throw new ApiError(502,'GitHub storage returned an unsupported file');
 const bytes=Uint8Array.from(atob(item.content.replace(/\s/g,'')),c=>c.charCodeAt(0));
 return {data:JSON.parse(TD.decode(bytes)),sha:item.sha};
}
async function ghWrite(env,path,value,sha=null,binary=false){
 assertReady(env);
 const contents=binary ? b64(value) : b64(TE.encode(JSON.stringify(value)));
 const body={message:`miras: update ${path.slice(0,95)}`,content:contents,branch:BRANCH};if(sha)body.sha=sha;
 const response=await fetch(repoUrl(path).split('?')[0],{method:'PUT',headers:authHeaders(env,{'content-type':'application/json'}),body:JSON.stringify(body)});
 if(response.status===409||response.status===422)throw new ApiError(409,'Concurrent update or existing record');
 if(!response.ok)throw new ApiError(502,'GitHub rejected the write ('+response.status+')');
 return response.json();
}
async function patchJson(env,path,initial,update){
 for(let n=0;n<4;n++){
  const {data,sha}=await ghRead(env,path);const next=update(data??structuredClone(initial));
  try{await ghWrite(env,path,next,sha);return next}catch(e){if(e.status!==409||n===3)throw e}
 }
}
const catalogPath='miras/community/catalog.json';
const socialPath=id=>`miras/community/interactions/${id}.json`;
const userPath=u=>`miras/community/accounts/${u}.json`;
const defaultSocial=()=>({likes:[],comments:[],views:0,updated_at:null});
const iso=()=>new Date().toISOString();
const randomId=()=>crypto.randomUUID();
async function catalog(env){if(!ready(env))return [];const {data}=await ghRead(env,catalogPath);return Array.isArray(data?.videos)?data.videos:[]}
const publicBase=(req,env)=>((env.MIRAS_PUBLIC_URL||new URL(req.url).origin).replace(/\/$/,''));
const publicVideo=(video,req,env)=>({...video,share_url:publicBase(req,env)+'/watch/'+video.id,video_url:video.type==='upload'?publicBase(req,env)+'/media/'+video.id:video.video_url});
async function allVideos(req,env){const uploaded=await catalog(env);return [...uploaded.map(v=>publicVideo(v,req,env)),...CURATED.map(v=>publicVideo(v,req,env))]}
async function lookup(req,env,id){if(!VIDEO_RE.test(id))return null;const matches=await allVideos(req,env);return matches.find(v=>v.id===id)||null}
async function sign(data,secret){const key=await crypto.subtle.importKey('raw',TE.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);return urlSafe(new Uint8Array(await crypto.subtle.sign('HMAC',key,TE.encode(data))))}
async function tokenFor(username,env){const payload=urlSafe(TE.encode(JSON.stringify({sub:username,exp:Math.floor(Date.now()/1000)+30*86400})));return payload+'.'+await sign(payload,env.MIRAS_SESSION_SECRET)}
async function identity(req,env){
 if(!ready(env))return null;
 const token=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');
 const [payload,signature,extra]=token.split('.');if(!payload||!signature||extra)return null;
 if((await sign(payload,env.MIRAS_SESSION_SECRET))!==signature)return null;
 let obj;try{obj=JSON.parse(TD.decode(fromUrlSafe(payload)))}catch{return null}
 if(!USER_RE.test(obj.sub)||!Number.isSafeInteger(obj.exp)||obj.exp<=Date.now()/1000)return null;
 return obj.sub;
}
const requireUser=async(req,env)=>{assertReady(env);const u=await identity(req,env);if(!u)throw new ApiError(401,'Sign in to continue');return u};
const publicUser=u=>({username:u.username,display_name:u.display_name,joined_at:u.joined_at,language:u.language||'en',saved:Array.isArray(u.saved)?u.saved:[]});
async function parseJson(req){const type=req.headers.get('content-type')||'';if(!type.includes('application/json'))throw new ApiError(415,'Expected JSON');const len=Number(req.headers.get('content-length')||0);if(len>10000)throw new ApiError(413,'Request too large');try{const s=await req.text();if(s.length>10000)throw new Error('large');return JSON.parse(s)}catch{throw new ApiError(400,'Invalid JSON')}}
const clean=(v,max=200)=>String(v??'').trim().slice(0,max);
async function passwordDigest(password,salt){
 const key=await crypto.subtle.importKey('raw',TE.encode(password),'PBKDF2',false,['deriveBits']);
 return urlSafe(new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt,iterations:120000},key,256)));
}
async function register(req,env){
 assertReady(env);const d=await parseJson(req);const username=clean(d.username,26).toLowerCase();const pw=String(d.password||'');const display_name=clean(d.displayName||username,40);
 if(!USER_RE.test(username)||pw.length<8||pw.length>128||!display_name)throw new ApiError(400,'Use a 3–24 character username and an 8–128 character password');
 const {data:existing}=await ghRead(env,userPath(username));if(existing)throw new ApiError(409,'Username is already taken');
 const salt=crypto.getRandomValues(new Uint8Array(16));const user={username,display_name,salt:urlSafe(salt),password_hash:await passwordDigest(pw,salt),language:'en',joined_at:iso()};
 await ghWrite(env,userPath(username),user);
 return json({user:publicUser(user),token:await tokenFor(username,env)},201);
}
async function login(req,env){
 assertReady(env);const d=await parseJson(req);const username=clean(d.username,26).toLowerCase();if(!USER_RE.test(username))throw new ApiError(401,'Invalid credentials');
 const {data:user}=await ghRead(env,userPath(username));if(!user)return fail(401,'Invalid credentials');
 const actual=await passwordDigest(String(d.password??''),fromUrlSafe(user.salt));if(actual!==user.password_hash)return fail(401,'Invalid credentials');
 return json({user:publicUser(user),token:await tokenFor(username,env)});
}
async function reaction(req,env,id,verb){
 const username=await requireUser(req,env);if(!await lookup(req,env,id))throw new ApiError(404,'Video not found');
 if(verb==='like'){
  const data=await patchJson(env,socialPath(id),defaultSocial(),d=>{d.likes??=[];if(d.likes.includes(username))d.likes=d.likes.filter(x=>x!==username);else d.likes.push(username);d.updated_at=iso();return d});
  return json({likes:data.likes.length,liked:data.likes.includes(username)});
 }
 if(verb==='save'){
  const user=await patchJson(env,userPath(username),{},d=>{if(!d.username)throw new ApiError(404,'User not found');d.saved??=[];if(d.saved.includes(id))d.saved=d.saved.filter(x=>x!==id);else d.saved.push(id);return d});
  return json({saved:user.saved,bookmarked:user.saved.includes(id)});
 }
 if(verb==='comment'){
  const d=await parseJson(req);const text=clean(d.text,500);if(text.length<2)throw new ApiError(400,'Comment must be at least two characters');
  const comment={id:randomId(),username,text,created_at:iso()};
  const data=await patchJson(env,socialPath(id),defaultSocial(),d=>{d.comments??=[];if(d.comments.length>=200)throw new ApiError(429,'Comment limit reached');d.comments.push(comment);d.updated_at=iso();return d});
  return json({comment,comments:data.comments},201);
 }
 if(verb==='view'){
  const data=await patchJson(env,socialPath(id),defaultSocial(),d=>{d.views=Math.min((Number(d.views)||0)+1,2147483647);return d});return json({views:data.views});
 }
 if(verb==='report'){
  const d=await parseJson(req);const reason=clean(d.reason,200);if(reason.length<8)throw new ApiError(400,'Please provide a reason');
  const idReport=randomId();await ghWrite(env,`miras/community/reports/${idReport}.json`,{video_id:id,reporter:username,reason,created_at:iso()});return json({ok:true},201);
 }
 throw new ApiError(404,'Unknown action');
}
async function setPreferences(req,env){const u=await requireUser(req,env);const d=await parseJson(req);if(!['en','tr'].includes(d.language))throw new ApiError(400,'Unsupported language');const updated=await patchJson(env,userPath(u),{},v=>{if(!v.username)throw new ApiError(404,'User not found');v.language=d.language;return v});return json({user:publicUser(updated)});}
async function upload(req,env){
 const username=await requireUser(req,env);const type=req.headers.get('content-type')||'';if(!type.includes('multipart/form-data'))throw new ApiError(415,'Expected multipart video');
 if(Number(req.headers.get('content-length')||0)>LIMIT+50000)throw new ApiError(413,'Maximum video size is 12 MB');
 const form=await req.formData();const file=form.get('video');if(!file||typeof file.arrayBuffer!=='function')throw new ApiError(400,'Video file is required');
 if(file.size<128||file.size>LIMIT)throw new ApiError(413,'Video must be 128 B–12 MB');
 const title=clean(form.get('title'),110),description=clean(form.get('description'),800),category=clean(form.get('category'),20);
 if(title.length<3||!['places','food','arts','history','daily','nature'].includes(category))throw new ApiError(400,'Invalid video title or category');
 const bytes=new Uint8Array(await file.arrayBuffer());const isMp4=TD.decode(bytes.subarray(4,8))==='ftyp';const isWebm=bytes[0]===0x1a&&bytes[1]===0x45&&bytes[2]===0xdf&&bytes[3]===0xa3;
 if(!isMp4&&!isWebm)throw new ApiError(415,'Only valid MP4 and WebM videos are supported');
 const id=randomId().replace(/-/g,'').slice(0,24);const ext=isMp4?'mp4':'webm';const path=`miras/uploads/${id}.${ext}`;
 await ghWrite(env,path,bytes,null,true);
 const video={id,type:'upload',title:{en:title,tr:title},description:{en:description,tr:description},category,creator:username,creator_username:username,license:'Creator upload',source_url:'',file_path:path,cover:'/img/istanbul.jpg',created_at:iso(),duration:null};
 await patchJson(env,catalogPath,{videos:[]},d=>{d.videos??=[];d.videos.unshift(video);return d});
 return json({video:publicVideo(video,req,env)},201);
}
async function media(req,env,id){
 assertReady(env);const video=await lookup(req,env,id);if(!video||video.type!=='upload'||!/^miras\/uploads\/[a-z0-9]+\.(mp4|webm)$/.test(video.file_path))throw new ApiError(404,'Video not found');
 const upstream=await fetch(repoUrl(video.file_path),{headers:authHeaders(env,{Accept:'application/vnd.github.raw+json',...(req.headers.get('range')?{'Range':req.headers.get('range')}:{} )})});
 if(!upstream.ok)throw new ApiError(502,'Media is unavailable');
 const h=new Headers({'content-type':video.file_path.endsWith('.mp4')?'video/mp4':'video/webm','cache-control':'public, max-age=600','accept-ranges':'bytes','access-control-allow-origin':'*','x-content-type-options':'nosniff'});
 for(const key of ['content-range','content-length','etag'])if(upstream.headers.get(key))h.set(key,upstream.headers.get(key));
 return new Response(upstream.body,{status:upstream.status===206?206:200,headers:h});
}
const escapeHtml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeUrl=s=>{try{const u=new URL(s);return u.protocol==='https:'?escapeHtml(u.toString()):''}catch{return ''}};
async function watch(req,env,id){
 const video=await lookup(req,env,id);if(!video)throw new ApiError(404,'Video not found');
 const base=publicBase(req,env),title=escapeHtml(video.title.en),description=escapeHtml(video.description.en),link=escapeHtml(base+'/watch/'+id),source=safeUrl(video.video_url);
 const cover=safeUrl(video.cover.startsWith('/')?base+video.cover:video.cover);
 const content=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title} — MİRAS</title><meta name="description" content="${description}"><meta property="og:type" content="video.other"><meta property="og:title" content="${title}"><meta property="og:description" content="${description}"><meta property="og:url" content="${link}"><meta property="og:image" content="${cover}"><meta property="og:video" content="${source}"><link rel="canonical" href="${link}"><style>body{margin:0;background:#081a1b;color:#fff;font:16px system-ui}main{max-width:850px;margin:3vh auto;padding:20px}video{width:100%;max-height:64vh;background:#000;border-radius:18px}h1{font-size:clamp(25px,4vw,44px)}a{color:#e3ad70}p{color:#b8c4c3;line-height:1.6}.button{display:inline-block;margin-top:16px;background:#ecb770;color:#172324;padding:13px 19px;border-radius:24px;text-decoration:none;font-weight:700}</style></head><body><main><h2>MİRAS <small>· Stories of Türkiye</small></h2><video src="${source}" controls playsinline preload="metadata" poster="${cover}"></video><h1>${title}</h1><p>${description}</p><p>${escapeHtml(video.creator)} · ${escapeHtml(video.license)}</p>${video.source_url?`<a href="${safeUrl(video.source_url)}" rel="noopener">Original footage and license</a>`:''}<p><a class="button" href="/#watch=${encodeURIComponent(id)}">Explore MİRAS</a></p></main></body></html>`;
 return new Response(content,{status:200,headers:{'content-type':'text/html; charset=utf-8','cache-control':'public, max-age=90','x-content-type-options':'nosniff'}});
}
const dynamic=(req)=>req.method==='GET'||req.method==='HEAD';
export default {async fetch(req,env={}){
 const path=new URL(req.url).pathname;let response;
 try{
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:CORS});
  if(path==='/api/health'&&req.method==='GET')return json({ok:true,service:'miras',configured:ready(env)});
  if(path==='/api/config'&&req.method==='GET')return json({configured:ready(env),max_upload_bytes:LIMIT,community_enabled:ready(env)});
  if(path==='/api/videos'&&req.method==='GET')return json({videos:await allVideos(req,env),configured:ready(env)});
  if(path==='/api/auth/register'&&req.method==='POST')return await register(req,env);
  if(path==='/api/auth/login'&&req.method==='POST')return await login(req,env);
  if(path==='/api/auth/me'&&req.method==='GET'){
   const u=await identity(req,env);if(!u)return json({user:null});const {data:user}=await ghRead(env,userPath(u));return json({user:user?publicUser(user):null});
  }
  if(path==='/api/auth/preferences'&&req.method==='POST')return await setPreferences(req,env);
  if(path==='/api/library'&&req.method==='GET'){const username=await requireUser(req,env);const {data:user}=await ghRead(env,userPath(username));if(!user)throw new ApiError(404,'User not found');const saved=new Set(user.saved||[]);return json({videos:(await allVideos(req,env)).filter(v=>saved.has(v.id))});}
  if(path==='/api/upload'&&req.method==='POST')return await upload(req,env);
  const social=path.match(/^\/api\/videos\/([a-z0-9-]+)\/social$/);
  if(social&&req.method==='GET'){
   if(!await lookup(req,env,social[1]))throw new ApiError(404,'Video not found');
   const d=ready(env)?(await ghRead(env,socialPath(social[1]))).data||defaultSocial():defaultSocial();
   const user=await identity(req,env);return json({likes:d.likes.length,liked:!!user&&d.likes.includes(user),views:d.views||0,comments:d.comments||[]});
  }
  const action=path.match(/^\/api\/videos\/([a-z0-9-]+)\/(like|save|comment|view|report)$/);
  if(action&&req.method==='POST')return await reaction(req,env,action[1],action[2]);
  const detail=path.match(/^\/api\/videos\/([a-z0-9-]+)$/);
  if(detail&&req.method==='GET'){
   const video=await lookup(req,env,detail[1]);return video?json({video}):fail(404,'Video not found');
  }
  const link=path.match(/^\/watch\/([a-z0-9-]+)$/);if(link&&dynamic(req))return await watch(req,env,link[1]);
  const movie=path.match(/^\/media\/([a-z0-9-]+)$/);if(movie&&dynamic(req))return await media(req,env,movie[1]);
  if(path.startsWith('/api/'))return fail(404,'Endpoint not found');
  if(env.ASSETS)return env.ASSETS.fetch(req);
  return fail(404,'No static site configured');
 }catch(e){
  if(e instanceof ApiError)return fail(e.status,e.message);
  console.error('MIRAS server error:',String(e));return fail(500,'Unexpected server error');
 }
}};
