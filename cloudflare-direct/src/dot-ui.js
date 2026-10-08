export function dotPage() {
const PAGE = `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#0b101c"><title>Metodbox Dot</title>
<style>
:root{color-scheme:dark;--bg:#080e19;--pane:#111b2c;--edge:#25324b;--text:#f2f5fb;--mute:#9caec8;--blue:#548dfb}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:15px system-ui,-apple-system,"Segoe UI",sans-serif}button,input,textarea{font:inherit}button{cursor:pointer;border:1px solid var(--edge);border-radius:12px;padding:10px 14px;background:#1b2b42;color:var(--text)}button:disabled{opacity:.45}.primary{background:#4679e5;border-color:#6496ff}
.wrap{height:100dvh;display:grid;grid-template-columns:250px minmax(0,1fr)}aside{padding:18px;border-right:1px solid var(--edge);background:#0d1625;overflow-y:auto}main{min-width:0;display:flex;flex-direction:column;height:100dvh}
.brand{display:flex;align-items:center;gap:9px;font-size:18px;font-weight:800}.orb{width:34px;height:34px;display:grid;place-items:center;background:radial-gradient(circle at 30% 20%,#9fc8ff,#2e65cb);border-radius:12px;color:#091627}.note{font-size:12px;color:#aabbd0}h3{font-size:13px;color:#aabbd0}
.thread{width:100%;display:block;text-align:left;margin:8px 0;background:transparent;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.thread.active{background:#283e61}
header{padding:12px 18px;border-bottom:1px solid var(--edge);display:flex;justify-content:space-between;align-items:center;gap:7px}.actions{display:flex;gap:7px;align-items:center;flex-wrap:wrap}
#messages{flex:1;overflow-y:auto;padding:18px max(18px,calc((100vw - 940px)/2))}.bubble{max-width:790px;margin:13px auto;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.55;border:1px solid var(--edge);border-radius:18px;padding:14px 18px;background:var(--pane)}
.bubble.user{margin-left:auto;background:#22395f;width:fit-content;max-width:85%}.who{display:block;color:#9fc5ff;font-size:12px;font-weight:700;margin-bottom:4px}
#composer{padding:12px 18px calc(12px + env(safe-area-inset-bottom));border-top:1px solid var(--edge);display:flex;align-items:end;gap:9px;background:#0c1423}#input{flex:1;min-height:48px;max-height:160px;resize:vertical;border:1px solid var(--edge);background:#172338;color:var(--text);border-radius:13px;padding:12px}#composer button{min-height:48px}
#pcPanel{display:none;position:absolute;z-index:10;top:64px;right:12px;width:min(430px,calc(100vw - 24px));max-height:calc(100dvh - 85px);overflow:auto;border:1px solid #44628d;box-shadow:0 24px 60px #0009;border-radius:17px;padding:16px;background:#15233a}
#pcPanel.open{display:block}#pcPanel input{width:100%;margin:6px 0 8px;background:#0c1525;color:white;border:1px solid #445674;border-radius:9px;padding:11px}#pcShot{width:100%;max-height:250px;object-fit:contain;display:none;border:1px solid #345}#pcOutput{max-height:150px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;font:12px monospace;background:#101827;padding:10px;border-radius:10px}
#call{display:none;position:absolute;inset:0;z-index:20;background:#080d18f5;align-items:center;justify-content:center;flex-direction:column;gap:14px;padding:24px;text-align:center}#call.open{display:flex}#callOrb{width:150px;height:150px;border-radius:50%;display:grid;place-items:center;background:radial-gradient(circle at 30% 20%,#b0d1ff,#457de9,#1b3060);box-shadow:0 0 0 14px #477fe222;font-size:44px;animation:pulse 3s ease-in-out infinite}@keyframes pulse{50%{box-shadow:0 0 0 28px #477fe20b;transform:scale(1.03)}}#callCaption{max-width:520px;min-height:80px;line-height:1.6;font-size:18px}.callbuttons{display:flex;gap:12px;justify-content:center;flex-wrap:wrap}
#mobileMenu{display:none}a{color:#9fc5ff}
@media(max-width:730px){.wrap{display:block}aside{display:none;position:absolute;z-index:12;inset:56px auto 0 0;width:min(84vw,315px);box-shadow:10px 0 40px #0008}aside.open{display:block}#mobileMenu{display:block}header{padding:8px 12px}.brand{font-size:15px}#messages{padding:12px}#composer{padding-left:9px;padding-right:9px}#composer button{padding:10px}}
</style></head><body>
<div class="wrap"><aside id="sidebar"><div class="brand"><div class="orb">✦</div> Metodbox Dot</div><p class="note">Kendi asistanın · Şifreli GitHub geçmişi</p><button id="newThread" class="primary" style="width:100%;margin-top:16px">＋ Yeni konuşma</button><h3>Konuşmalar</h3><div id="threadList"></div><p class="note">Dot doğrudan Cloudflare'da; bilgisayar gerektiğinde GitHub'da açılır.</p><a href="/apps" class="note">Hesap</a></aside>
<main><header><div class="actions"><button id="mobileMenu">☰</button><span class="brand">✦ Dot</span><span class="note" id="status">Hazır</span></div><div class="actions"><button id="teamButton">◈ Ekip</button><button id="voiceButton" class="primary">☎ Ara</button><button id="pcButton">▣ PC</button></div></header>
<div id="messages"><div class="bubble"><span class="who">Dot</span>Merhaba! Ben Metodbox Dot. Mesaj yazabilir, ☎ Ara ile konuşabilir veya PC'yi açabilirsin.</div></div><div id="composer"><textarea id="input" placeholder="Dot'a mesaj gönder…" rows="1"></textarea><button id="sendButton" class="primary">➤</button></div></main></div>
<div id="pcPanel"><div class="actions" style="justify-content:space-between"><strong>Dot'un bulut bilgisayarı</strong><button id="pcClose">✕</button></div><p class="note" id="pcStatus">Henüz başlatılmadı.</p><div class="actions"><button id="pcStart" class="primary">PC Başlat</button><button id="pcStop">Durdur</button><button id="pcRefresh">Yenile</button></div><h3>Tarayıcı</h3><input id="pcUrl" value="https://example.org" placeholder="https://"><button id="pcNavigate">Web sitesini aç</button> <button id="pcScreenshot">Ekran görüntüsü</button><img id="pcShot" alt="PC tarayıcı görüntüsü"><h3>Terminal</h3><input id="pcCommand" placeholder="örn. pwd"><button id="pcExec">Komutu çalıştır</button><p class="note">Terminal komutunu onayladıktan sonra izole GitHub PC'de çalıştırır.</p><pre id="pcOutput"></pre></div>
<div id="call"><div class="note">METODBOX · SESLİ GÖRÜŞME</div><div id="callOrb">✦</div><h2>Dot ile konuş</h2><label class="note">Ses <select id="voiceSelect" style="background:#1b2b42;color:white;padding:8px;border-radius:10px"><option value="tr-TR-EmelNeural">Emel · Neural</option><option value="tr-TR-AhmetNeural">Ahmet · Neural</option><option value="device">Telefonun Türkçe sesi</option></select></label><div id="callStatus" class="note">Mikrofon hazırlanıyor…</div><div id="callCaption">Seni dinliyorum.</div><div class="callbuttons"><button id="callMute">🎙 Mikrofonu kapat</button><button id="callEnd" style="background:#9e293a">☎ Görüşmeyi bitir</button></div><p class="note">Normal telefon hattı değil · Neural ses için konuşma metni Microsoft'a iletilebilir; servis kapalıysa cihaz sesi kullanılır.</p></div>
<script>
(()=>{'use strict';
const $=id=>document.getElementById(id);const state={thread:null,threads:[],busy:false,calling:false,muted:false,speaking:false,recognizer:null,listening:false,edgeUnavailable:false,audio:null};
async function send(path,method='GET',body){const r=await fetch('/dot/api/'+path,{method,headers:{'Content-Type':'application/json'},credentials:'same-origin',body:body?JSON.stringify(body):undefined,cache:'no-store'});const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||'HTTP '+r.status);return d}
function setStatus(t){$('status').textContent=t}
function bubble(role,text){const node=document.createElement('div');node.className='bubble '+(role==='user'?'user':'');const who=document.createElement('span');who.className='who';who.textContent=role==='user'?'Sen':'Dot';node.append(who,document.createTextNode(String(text)));$('messages').append(node);$('messages').scrollTop=$('messages').scrollHeight}
function clearMessages(){$('messages').replaceChildren()}
async function threads(){try{const r=await send('threads');state.threads=r.threads||[];const list=$('threadList');list.replaceChildren();for(const t of state.threads){const b=document.createElement('button');b.className='thread'+(t.id===state.thread?' active':'');b.textContent=t.title||'Yeni konuşma';b.onclick=()=>load(t.id);list.append(b)}}catch(e){setStatus(e.message)}}
async function load(id){try{const t=await send('threads/'+encodeURIComponent(id));state.thread=t.id;clearMessages();for(const m of t.messages||[])if(m.role==='user'||m.role==='assistant')bubble(m.role,m.content||'');await threads();$('sidebar').classList.remove('open');setStatus('Hazır · Kişisel PC: '+t.id.slice(0,8))}catch(e){setStatus(e.message)}}
async function create(){try{const t=await send('threads','POST',{title:'Yeni konuşma'});state.thread=t.id;clearMessages();setStatus('Bu sohbet için yeni PC başlatılıyor…');await threads();$('sidebar').classList.remove('open')}catch(e){setStatus(e.message)}}
async function say(){const text=$('input').value.trim();if(!text||state.busy)return;$('input').value='';await ask(text)}
async function ask(text){if(state.busy)return;state.busy=true;$('sendButton').disabled=true;
if(!state.thread){try{const t=await send('threads','POST',{title:text.slice(0,55)});state.thread=t.id}catch(e){setStatus(e.message);state.busy=false;$('sendButton').disabled=false;return}}
bubble('user',text);setStatus('Dot düşünüyor…');if(state.calling)$('callStatus').textContent='Yanıt hazırlanıyor…';
try{const reply=await send('message','POST',{threadId:state.thread,text});if(reply.content)bubble('assistant',reply.content);setStatus(reply.saved===false?'Yanıt geldi ama geçmiş kaydedilemedi':'Hazır');if(state.calling&&reply.content){$('callCaption').textContent=reply.content.slice(0,400);await speak(reply.content)}}catch(e){bubble('assistant','Yanıt alınamadı: '+e.message);setStatus('Bağlantı hatası')}finally{state.busy=false;$('sendButton').disabled=false;await threads();if(state.calling&&!state.muted&&!state.speaking)listen()}}
$('teamButton').onclick=()=>{if(!state.thread){setStatus('Önce bir sohbet oluştur.');return}location.href='/dot/team?chatId='+encodeURIComponent(state.thread)};
$('sendButton').onclick=say;$('input').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();say()}};$('newThread').onclick=create;$('mobileMenu').onclick=()=>$('sidebar').classList.toggle('open');
async function speak(text){
  if(!state.calling)return;
  state.speaking=true;
  const input=String(text).replace(/[\*_#]/g,'').slice(0,850);
  if($('voiceSelect').value==='device'||state.edgeUnavailable){
    $('callStatus').textContent='Telefonun Türkçe sesi kullanılıyor.';
    try{await deviceSpeak(input)}finally{state.speaking=false}
    return;
  }
  // Prefer remote neural voice; download audio bytes only (no large model/RAM).
  // The unofficial Edge endpoint can fail. Always offer native device TTS.
  try{
    $('callStatus').textContent='Neural ses hazırlanıyor…';
    const response=await fetch('/dot/api/tts',{method:'POST',credentials:'same-origin',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({text:input,voice:$('voiceSelect').value}),
      signal:AbortSignal.timeout(17000)});
    if(!response.ok)throw Error('Neural TTS HTTP '+response.status);
    const blob=await response.blob();
    if(blob.size<500||!response.headers.get('content-type')?.includes('audio/'))throw Error('Neural TTS audio yok');
    if(!state.calling)return;
    const url=URL.createObjectURL(blob), audio=new Audio(url);
    state.audio=audio;
    $('callStatus').textContent='Dot konuşuyor · Edge neural';
    try{
      await new Promise((resolve,reject)=>{audio.onended=resolve;audio.onerror=()=>reject(Error('Audio error'));audio.play().catch(reject)});
      return;
    }finally{state.audio=null;URL.revokeObjectURL(url)}
  }catch(error){
    state.edgeUnavailable=true;
    if(!state.calling)return;
    $('callStatus').textContent='Neural ses şu anda erişilemiyor; telefon sesi kullanılıyor.';
    await deviceSpeak(input);
  }finally{state.speaking=false}
}
function deviceSpeak(text){return new Promise(resolve=>{
  if(!state.calling||!('speechSynthesis' in window)){resolve();return}
  const u=new SpeechSynthesisUtterance(text);u.lang='tr-TR';u.rate=1.05;
  const voices=speechSynthesis.getVoices()||[];
  u.voice=voices.find(v=>/tr[-_]TR/i.test(v.lang)&&/google|natural|neural|microsoft/i.test(v.name))||
    voices.find(v=>/tr[-_]TR/i.test(v.lang))||null;
  let finished=false;const done=()=>{if(finished)return;finished=true;resolve()};
  u.onend=done;u.onerror=done;speechSynthesis.cancel();speechSynthesis.speak(u);
  setTimeout(done,25000);
})}
function listen(){if(!state.calling||state.muted||state.speaking||state.listening)return;const API=window.SpeechRecognition||window.webkitSpeechRecognition;if(!API){$('callStatus').textContent='Konuşma tanıma desteklenmiyor. Metin kutusunu kullan.';return}const sr=new API();state.recognizer=sr;sr.lang='tr-TR';sr.interimResults=true;sr.continuous=false;let final='';sr.onstart=()=>{state.listening=true;$('callStatus').textContent='🎙 Dinliyorum…'};sr.onresult=e=>{for(let i=e.resultIndex;i<e.results.length;i++){const part=e.results[i][0].transcript;if(e.results[i].isFinal)final+=part;else $('callCaption').textContent=part}if(final)$('callCaption').textContent=final};sr.onerror=e=>{state.listening=false;$('callStatus').textContent='Mikrofon: '+e.error};sr.onend=()=>{state.listening=false;state.recognizer=null;if(final.trim()&&state.calling&&!state.muted){ask(final.trim());return}if(state.calling&&!state.muted&&!state.speaking)setTimeout(listen,900)};try{sr.start()}catch(e){$('callStatus').textContent=e.message}}
function endCall(){state.calling=false;state.recognizer?.abort();state.listening=false;if(state.audio){state.audio.pause();state.audio=null}if('speechSynthesis' in window)speechSynthesis.cancel();state.speaking=false;$('call').classList.remove('open')}
$('voiceButton').onclick=()=>{state.calling=true;state.muted=false;$('call').classList.add('open');$('callCaption').textContent='Merhaba! Konuşmaya başlayabilirsin.';listen()};$('callEnd').onclick=endCall;
$('callMute').onclick=()=>{state.muted=!state.muted;$('callMute').textContent=state.muted?'🎙 Mikrofonu aç':'🎙 Mikrofonu kapat';if(state.muted)state.recognizer?.abort();else listen()};
$('pcButton').onclick=()=>{if(!state.thread){setStatus('Önce bir sohbet oluştur.');return}$('pcPanel').classList.toggle('open');pcStatus()};$('pcClose').onclick=()=>$('pcPanel').classList.remove('open');
function pcDisplay(v){$('pcStatus').textContent=(v.status||'stopped')+' · '+(v.message||'');if(v.status==='running')$('pcOutput').textContent='PC çalışıyor.'}
async function pcStatus(){try{pcDisplay(await send('pc/status?chatId='+encodeURIComponent(state.thread)))catch(e){$('pcStatus').textContent=e.message}}
async function pcAction(path,body){if(!state.thread){setStatus('Önce bir sohbet oluştur.');return}try{const v=await send('pc/'+path,'POST',{...body,chatId:state.thread});if(v.status)pcDisplay(v);else if(v.base64&&/^[A-Za-z0-9+/=]+$/.test(v.base64)){const img=$('pcShot');img.src='data:image/png;base64,'+v.base64;img.style.display='block'}else $('pcOutput').textContent=JSON.stringify(v,null,2).slice(0,12000)}catch(e){$('pcOutput').textContent='Hata: '+e.message}}
$('pcStart').onclick=()=>pcAction('start');$('pcStop').onclick=()=>pcAction('stop');$('pcRefresh').onclick=pcStatus;$('pcNavigate').onclick=()=>pcAction('navigate',{url:$('pcUrl').value});$('pcScreenshot').onclick=()=>pcAction('screenshot');
$('pcExec').onclick=()=>{const command=$('pcCommand').value.trim();if(command&&confirm('İzole Dot PC üzerinde çalıştırılsın mı?\\n'+command))pcAction('exec',{command,timeoutMs:20000})};
threads();setInterval(()=>{if($('pcPanel').classList.contains('open'))pcStatus()},8000);
})();
</script></body></html>`;
return new Response(PAGE,{headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff","X-Frame-Options":"DENY","Referrer-Policy":"no-referrer","Content-Security-Policy":"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; media-src 'self' blob:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"}});
}
