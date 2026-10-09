export function dotPage(){
const HTML=String.raw`<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#0a0e13"><title>Dot — Metodbox</title>
<style>
:root{color-scheme:dark;--bg:#0a0e13;--panel:#111820;--panel2:#172129;--border:#293841;--text:#f3f6f5;--muted:#92a6ad;--accent:#c7f38b;--hover:#223039;--red:#fe968e}
*{box-sizing:border-box}html,body{height:100%;margin:0}body{background:var(--bg);color:var(--text);font:14px/1.5 system-ui,-apple-system,Segoe UI,sans-serif}
button,input,textarea,select{font:inherit}button{cursor:pointer;border:1px solid var(--border);border-radius:11px;padding:10px 13px;color:var(--text);background:var(--panel2);transition:background .12s}button:hover{background:var(--hover)}button:disabled{opacity:.5;cursor:default}button.accent{background:var(--accent);color:#19211c;border-color:var(--accent);font-weight:750}button.quiet{background:transparent}button.danger{background:#392329;color:#ffb5b0}button.sm{padding:7px 10px;font-size:12px}button svg{vertical-align:middle}
a{color:var(--accent);text-decoration:none}input,textarea,select{background:#0d141b;border:1px solid #354650;border-radius:12px;color:var(--text);padding:11px 12px;outline:none;min-width:0}input:focus,textarea:focus{border-color:#a3cb7b}textarea{resize:none}
.frame{display:grid;grid-template-columns:246px minmax(0,1fr);height:100dvh}.side{display:flex;flex-direction:column;border-right:1px solid var(--border);padding:20px 12px;background:#0f151c;min-width:0}.brand{display:flex;gap:11px;align-items:center;padding:4px 10px 25px}.emblem{background:var(--accent);width:36px;height:36px;display:grid;place-items:center;color:#152315;border-radius:12px;font-size:23px}.brand strong{font-size:19px;letter-spacing:-.6px}.brand span{display:block;color:var(--muted);font-size:10px;letter-spacing:1.2px;text-transform:uppercase}.sidebarHeading{padding:21px 12px 9px;color:var(--muted);font-size:11px;font-weight:750;text-transform:uppercase;letter-spacing:1.1px}
#chats{overflow:auto;flex:1;min-height:0}.chatItem{width:100%;text-align:left;border:0;background:none;display:block;color:#aec0c4;font-size:13px;padding:12px;border-radius:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.chatItem.active{background:#1f2d32;color:#ecf7df}
.sideFooter{border-top:1px solid var(--border);padding:13px 11px;color:var(--muted);font-size:12px}.online{color:var(--accent)}
.main{min-width:0;display:flex;flex-direction:column;position:relative}.top{height:69px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border);padding:0 24px;gap:10px}.topTitle{min-width:0}.topTitle strong{font-size:15px}.topTitle small{color:var(--muted);display:block;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:45vw}.topActions{display:flex;gap:7px;align-items:center}.chip{background:#213323;border:1px solid #345738;border-radius:99px;padding:5px 10px;font-size:11px;color:#cef5af}
#chatArea{min-height:0;flex:1;overflow:auto;scroll-behavior:smooth}.messages{max-width:850px;padding:30px 22px 30px;margin:0 auto}.hero{padding:clamp(55px,13vh,135px) 0 40px;max-width:610px;margin:auto}.hero .mark{width:53px;height:53px;background:#203b2d;color:var(--accent);border:1px solid #456d48;display:grid;place-items:center;border-radius:17px;font-size:29px;margin-bottom:23px}.hero h1{font-size:clamp(28px,3vw,40px);font-weight:670;letter-spacing:-1.4px;line-height:1.15;margin:0 0 15px}.hero p{color:var(--muted);max-width:440px;line-height:1.8;margin:0}.suggestions{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:30px}.suggestions button{font-size:12px;text-align:left;padding:15px;background:#121b21;border-radius:13px}
.turn{display:flex;gap:12px;margin-bottom:26px;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.74}.avatar{width:29px;height:29px;flex:none;border-radius:9px;background:#233b31;color:var(--accent);display:grid;place-items:center;font-size:16px}.turn.user .avatar{background:#243039;color:#c7e0ef}.bubble{flex:1;min-width:0;max-width:100%;padding-top:3px}.speaker{font-weight:700;font-size:12px;margin-bottom:7px}.content{font-size:14px;color:#dce8e5}.turn.user .content{color:#f4f7f8}.streaming .content::after{content:'▌';animation:blink 1s step-end infinite;color:var(--accent)}@keyframes blink{50%{opacity:0}}.stage{display:block;font-size:11px;color:var(--accent);padding:6px 0}
.composeDock{padding:12px 23px calc(18px + env(safe-area-inset-bottom));border-top:1px solid var(--border)}.compose{max-width:820px;margin:auto;background:#111a20;border:1px solid #40534b;border-radius:19px;padding:9px;display:flex;align-items:end;gap:8px}.compose textarea{flex:1;max-height:185px;min-height:42px;background:transparent;border:0;padding:11px 13px;line-height:1.5;resize:none}.compose button{min-width:48px;min-height:42px}.hint{font-size:11px;color:#6d858a;text-align:center;margin:8px 0 0}
.drawer{display:none;position:absolute;right:0;top:0;bottom:0;width:min(430px,100%);background:#121b22;border-left:1px solid #40524d;z-index:15;box-shadow:-18px 0 75px #0009;padding:20px;overflow-y:auto}.drawer.open{display:block}.drawTop{display:flex;align-items:center;justify-content:space-between;gap:12px}.drawer h2{font-size:18px;margin:0 0 4px}.muted{color:var(--muted);font-size:12px}.label{display:block;color:#adc0c1;font-size:12px;margin:17px 0 7px}.statusBox{border-radius:12px;background:#1e2b2b;border:1px solid #334b40;padding:14px;margin:15px 0;color:#c7e2d4;font-size:12px}.row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.row button{flex:none}.row input{flex:1}.full{width:100%}
.screenFrame{background:#03070a;border:1px solid #536562;border-radius:13px;min-height:240px;display:grid;place-items:center;overflow:hidden}.screenFrame img{width:100%;height:auto;display:none;cursor:crosshair;user-select:none;-webkit-user-drag:none}.screenEmpty{color:#8da6a1;text-align:center;font-size:12px;padding:35px}
.log{padding:12px;border:1px solid var(--border);background:#0b1117;border-radius:12px;color:#b4c8c5;font:12px/1.55 ui-monospace,monospace;white-space:pre-wrap;overflow-wrap:anywhere;max-height:260px;overflow:auto;margin-top:12px}
.agentCard{border:1px solid #35483e;background:#1a2927;border-radius:13px;padding:13px;margin:10px 0}.agentCard strong{font-size:13px}.agentCard p{margin:5px 0 10px;color:var(--muted);font-size:12px}.check{display:flex;align-items:center;gap:9px;margin:10px 0;color:#c2d3cc;font-size:12px}
#menu{display:none}.call{display:none;position:fixed;inset:0;z-index:50;align-items:center;justify-content:center;background:#081010ed}.call.open{display:flex}.callCard{text-align:center;background:#172324;border-radius:23px;padding:35px;width:min(430px,90vw);border:1px solid #486151}.callOrb{display:grid;place-items:center;width:105px;height:105px;border-radius:50%;background:var(--accent);color:#162213;font-size:48px;margin:0 auto 25px;box-shadow:0 0 0 16px #bcef9022}
@media(max-width:780px){.frame{display:block}.side{position:fixed;left:0;top:0;bottom:0;width:min(286px,88vw);z-index:25;display:none;box-shadow:12px 0 65px #000b}.side.open{display:flex}.main{height:100dvh}.top{height:61px;padding:0 12px}.chip{display:none}#menu{display:block}.topActions button{padding:8px;font-size:12px}.messages{padding:18px 15px}.hero{padding:75px 0 30px}.suggestions{grid-template-columns:1fr}.composeDock{padding:9px 9px calc(11px + env(safe-area-inset-bottom))}.hint{display:none}}
</style></head><body>
<div class="frame"><aside class="side" id="sidebar">
  <div class="brand"><span class="emblem">◈</span><div><strong>Dot</strong><span>METODBOX STUDIO</span></div></div>
  <button class="accent full" id="newChat">＋ Yeni sohbet</button><div class="sidebarHeading">Çalışma alanları</div><div id="chats"></div>
  <div class="sideFooter"><span class="online">●</span> GPT+ bağlı<br>Her sohbet ayrı PC kimliği<br><a href="/apps">Hesap ve ayarlar ↗</a></div>
 </aside><main class="main">
  <header class="top"><div class="row"><button id="menu" class="quiet sm">☰</button><div class="topTitle"><strong>Dot <span style="color:var(--accent)">/</span> Studio</strong><small id="chatTitle">Yeni çalışma alanı</small></div></div>
   <div class="topActions"><span class="chip">● Model hazır</span><button id="agentBtn" class="sm">◈ Agentlar</button><button id="pcBtn" class="sm">▣ PC</button><button id="callBtn" class="sm">☎ Ara</button></div>
  </header>
  <div id="chatArea"><div id="messages" class="messages"><section class="hero" id="hero"><div class="mark">✦</div><h1>Fikirden sonuca.<br>Tek bir çalışma alanında.</h1><p>Bir görev yaz. Dot yanıtını yazarken gör, alt agentları yönet ve gerektiğinde gerçek Linux bilgisayarını aç.</p><div class="suggestions"><button data-prompt="Bir web uygulaması için plan ve dosya yapısı oluştur.">↗ Web uygulaması geliştir</button><button data-prompt="Üç alt agente bölünebilen bir araştırma görevi planla.">◈ Çoklu agent görevi planla</button><button data-prompt="Bilgisayarımda bir web sitesini açmak için gerekli adımları anlat.">▣ Bilgisayar kullan</button><button data-prompt="Günlük görevlerim için kısa bir plan oluştur.">✦ Yeni bir plan oluştur</button></div></section></div></div>
  <div class="composeDock"><div class="compose"><textarea id="prompt" rows="1" placeholder="Dot'a bir şey söyle..."></textarea><button id="send" class="accent" title="Gönder">↑</button><button id="stop" class="danger" style="display:none" title="Yanıtı durdur">■</button></div><div class="hint" id="status">Yanıtlar gerçek zamanlı akışla gelir. Shift+Enter: yeni satır.</div></div>
  <aside id="pcDrawer" class="drawer"><div class="drawTop"><div><h2>▣ Bulut bilgisayarı</h2><div class="muted">Openbox · Chromium · Terminal</div></div><button class="quiet" id="pcClose">✕</button></div>
   <label class="label">Bilgisayar</label><select class="full" id="pcTarget"><option value="main">Ana agent</option></select><div class="statusBox" id="pcState">Henüz başlatılmadı.</div>
   <div class="row"><button class="accent sm" id="pcStart">▶ Başlat</button><button id="pcStop" class="sm">■ Durdur</button><button id="refresh" class="sm">↻ Yenile</button></div>
   <p class="label">Canlı ekran · 1280 × 800</p><div class="screenFrame"><div class="screenEmpty" id="emptyScreen">PC hazır olunca gerçek Linux ekranı burada görünür.</div><img id="screen" alt="Linux desktop"></div>
   <div class="row" style="margin-top:10px"><button id="scrollUp" class="sm">↑ Kaydır</button><button id="scrollDown" class="sm">↓ Kaydır</button><button id="enter" class="sm">↵ Enter</button><button id="tab" class="sm">Tab</button></div>
   <label class="label">Klavyeye yaz</label><div class="row"><input id="typeText" placeholder="Metin..."><button id="typeButton" class="accent sm">Yaz</button></div>
   <label class="label">Adres</label><div class="row"><input id="url" value="https://example.org"><button id="visit" class="sm">Git</button></div>
   <label class="label">Terminal</label><textarea id="command" rows="2" class="full" placeholder="Örn. pwd"></textarea><button class="sm" id="exec">⌘ Komutu onayla ve çalıştır</button>
   <div class="log" id="pcLog">PC henüz açılmadı.</div>
  </aside>
  <aside id="agentsDrawer" class="drawer"><div class="drawTop"><div><h2>◈ Agent ekibi</h2><div class="muted">Ana agent ve bağımsız çalışma alanları</div></div><button class="quiet" id="agentsClose">✕</button></div>
   <div class="statusBox" id="teamSummary">Agentlar yükleniyor…</div><div id="agentCards"></div>
   <label class="label">Alt agent oluştur</label><input id="agentName" class="full" maxlength="80" placeholder="Agent adı">
   <textarea id="agentTask" rows="3" class="full" style="margin-top:9px" maxlength="2000" placeholder="Agentın görevini yaz..."></textarea>
   <div class="row" style="margin-top:10px"><button id="addAgent" class="accent sm">＋ Oluştur</button><button id="runAgents" class="sm">▶ Seçilenleri çalıştır</button></div>
   <label class="check"><input id="waitForPc" type="checkbox" checked> PC hazır olana kadar bekle</label>
   <label class="check"><input id="agentTerminal" type="checkbox"> AI terminal izni</label>
   <label class="check"><input id="aiDesktop" type="checkbox"> AI fare/klavye izni</label>
   <div class="log" id="agentLog">Alt agentları buradan yöneteceksin.</div>
  </aside>
 </main></div>
<div id="callOverlay" class="call"><div class="callCard"><div class="callOrb">✦</div><h2>Dot ile konuş</h2><p id="callText" class="muted">Mikrofon hazırlanıyor…</p><select id="voice" class="full"><option value="tr-TR-EmelNeural">Emel · Neural Türkçe</option><option value="tr-TR-AhmetNeural">Ahmet · Neural Türkçe</option><option value="device">Telefon sesi</option></select><div class="row" style="justify-content:center;margin-top:20px"><button id="mute">🎙 Sustur</button><button id="hangup" class="danger">☎ Bitir</button></div></div></div>
<script>
(()=>{'use strict';
const $=id=>document.getElementById(id);
const st={chat:null,threads:[],roster:null,agent:'main',busy:false,watch:false,refreshBusy:false,pcStatus:null,width:1280,height:800,
abort:null,voice:false,muted:false,talking:false,rec:null,audio:null,edgeFailed:false};
function notice(v){$('status').textContent=String(v)}
async function api(route,method='GET',body){
 const res=await fetch('/dot/api/'+route,{method,credentials:'same-origin',cache:'no-store',
 headers:{'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 const data=await res.json().catch(()=>({}));
 if(!res.ok)throw Error(data.error||'HTTP '+res.status);
 return data;
}
const stick=()=>{const area=$('chatArea');if(area.scrollHeight-area.scrollTop-area.clientHeight<240)area.scrollTop=area.scrollHeight};
function turn(role,text){
 const el=document.createElement('article');el.className='turn '+role;
 const av=document.createElement('div');av.className='avatar';av.textContent=role==='user'?'●':'✦';
 const wrap=document.createElement('div');wrap.className='bubble';
 const who=document.createElement('div');who.className='speaker';who.textContent=role==='user'?'Sen':'Dot';
 const content=document.createElement('div');content.className='content';content.textContent=text||'';
 const stage=document.createElement('div');stage.className='stage';stage.style.display='none';
 wrap.append(who,content,stage);el.append(av,wrap);
 if($('hero'))$('hero').remove();$('messages').append(el);stick();
 return {el,content,stage};
}
function reset(){const messages=$('messages');messages.replaceChildren()}
async function threads(){
 const d=await api('threads');st.threads=d.threads||[];
 const container=$('chats');container.replaceChildren();
 for(const t of st.threads){const b=document.createElement('button');b.className='chatItem'+(t.id===st.chat?' active':'');b.textContent='◦  '+(t.title||'Yeni sohbet');b.onclick=()=>load(t.id);container.append(b)}
}
async function load(id){
 if(st.busy)return;
 const t=await api('threads/'+encodeURIComponent(id));st.chat=t.id;st.agent='main';
 history.replaceState(null,'','/dot?chatId='+encodeURIComponent(t.id));$('chatTitle').textContent=t.title||'Yeni sohbet';reset();
 for(const m of t.messages||[])if(m.role==='assistant'||m.role==='user')turn(m.role,m.content);
 if(!(t.messages||[]).length)turn('assistant','Çalışma alanın hazır. Bir görev vererek başlayabilirsin.');
 await threads();await roster();$('sidebar').classList.remove('open');notice('Hazır.');
}
async function create(){
 const t=await api('threads','POST',{title:'Yeni sohbet'});
 st.chat=t.id;st.agent='main';history.replaceState(null,'','/dot?chatId='+encodeURIComponent(t.id));
 $('chatTitle').textContent='Yeni sohbet';reset();turn('assistant','Yeni çalışma alanı açıldı. PC ayrı olarak hazırlanıyor; sohbet için beklemene gerek yok.');
 await threads();await roster();$('sidebar').classList.remove('open');return t;
}
function parseSseBlock(block,handlers){
 let type='message';const data=[];
 for(const line of block.split('\n')){
  if(line.startsWith('event:'))type=line.slice(6).trim();
  if(line.startsWith('data:'))data.push(line.slice(5).trimStart());
 }
 if(!data.length)return false;
 let value;try{value=JSON.parse(data.join('\n'))}catch{return false}
 if(handlers[type])handlers[type](value);
 return type==='done'||type==='error';
}
async function sendText(text){
 text=String(text||'').trim();if(!text||st.busy)return;
 st.busy=true;$('send').style.display='none';$('stop').style.display='inline-block';
 $('prompt').value='';notice('Bağlanıyor…');
 const controller=new AbortController();st.abort=controller;
 let assistant=null,received='',ended=false;
 try{
  if(!st.chat)await create();
  turn('user',text);assistant=turn('assistant','');assistant.el.classList.add('streaming');
  assistant.stage.style.display='block';assistant.stage.textContent='Model yanıtı bekleniyor…';
  const res=await fetch('/dot/api/message/stream',{method:'POST',credentials:'same-origin',
   headers:{'Content-Type':'application/json','Accept':'text/event-stream'},
   body:JSON.stringify({threadId:st.chat,text}),signal:controller.signal});
  if(!res.ok)throw Error('Streaming HTTP '+res.status+': '+(await res.text()).slice(0,200));
  if(!res.body)throw Error('Bu tarayıcı streaming desteklemiyor.');
  const reader=res.body.getReader(),decoder=new TextDecoder();let buffer='';
  const handlers={
   token:o=>{received+=o.text||'';assistant.content.textContent=received;assistant.stage.style.display='none';notice('Dot yazıyor…');stick()},
   status:o=>{assistant.stage.style.display='block';assistant.stage.textContent=o.text||'Araç kullanılıyor…';stick()},
   done:o=>{ended=true;assistant.content.textContent=o.content||received;assistant.stage.style.display='none';
      assistant.el.classList.remove('streaming');notice(o.saved?'Yanıt tamamlandı.':'Yanıt geldi, geçmiş kaydedilemedi.');if(st.voice&&o.content)speak(o.content)},
   error:o=>{ended=true;throw Error(o.error||'Model akışı hata verdi')}
  };
  for(;;){
   const {value,done}=await reader.read();if(done)break;
   buffer+=decoder.decode(value,{stream:true});
   buffer=buffer.replace(/\r\n/g,'\n');
   let end;while((end=buffer.indexOf('\n\n'))>=0){
     const block=buffer.slice(0,end);buffer=buffer.slice(end+2);
     parseSseBlock(block,handlers);
   }
  }
  if(!ended)throw Error('Yanıt akışı beklenmedik şekilde kapandı.');
  await threads();await roster();
 }catch(e){
  if(assistant){assistant.el.classList.remove('streaming');assistant.stage.style.display='none';
    assistant.content.textContent=(received?received+'\n\n':'')+(e.name==='AbortError'?'[Akış kullanıcı tarafından durduruldu.]':'[Hata: '+e.message+']')}
  notice(e.name==='AbortError'?'Durduruldu.':e.message)
 }finally{
  st.busy=false;st.abort=null;$('stop').style.display='none';$('send').style.display='inline-block';
  if(st.voice&&!st.muted&&!st.talking)listen();
 }
}
$('send').onclick=()=>$('prompt').value.trim()&&sendText($('prompt').value);
$('stop').onclick=()=>{st.abort?.abort();notice('Akış durduruluyor…')};
$('prompt').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();$('send').click()}};
document.querySelectorAll('[data-prompt]').forEach(b=>b.onclick=()=>{$('prompt').value=b.dataset.prompt;$('prompt').focus()});
$('newChat').onclick=()=>create().catch(e=>notice(e.message));
$('menu').onclick=()=>$('sidebar').classList.toggle('open');
function drawer(id){for(const name of ['pcDrawer','agentsDrawer'])$(name).classList.toggle('open',name===id&&!$(name).classList.contains('open'));st.watch=$('pcDrawer').classList.contains('open');if(st.watch){pcStatus();shot()}if($('agentsDrawer').classList.contains('open'))roster()}
$('pcBtn').onclick=()=>st.chat?drawer('pcDrawer'):notice('Önce yeni sohbet oluştur.');
$('agentBtn').onclick=()=>st.chat?drawer('agentsDrawer'):notice('Önce yeni sohbet oluştur.');
$('pcClose').onclick=()=>{drawer('pcDrawer')};
$('agentsClose').onclick=()=>{drawer('agentsDrawer')};
async function roster(){
 if(!st.chat)return;
 try{
  const d=await api('chats/'+st.chat+'/agents');st.roster=d;
  $('teamSummary').textContent='Ana bilgisayar: '+d.mainPc.status+' · Alt agent: '+d.agents.length+'/6';
  $('agentTerminal').checked=d.allowExec===true;$('aiDesktop').checked=d.allowDesktopAI===true;
  const sel=$('pcTarget');sel.replaceChildren();sel.add(new Option('★ Ana agent · '+d.mainPc.status,'main'));
  for(const a of d.agents)sel.add(new Option(a.name+' · '+a.pc.status,a.id));
  if(!Array.from(sel.options).some(x=>x.value===st.agent))st.agent='main';sel.value=st.agent;
  const cards=$('agentCards');cards.replaceChildren();
  for(const a of d.agents){
   const card=document.createElement('section');card.className='agentCard';
   const name=document.createElement('strong');name.textContent=a.name+' · '+a.pc.status;card.append(name);
   const task=document.createElement('p');task.textContent=a.task;card.append(task);
   const line=document.createElement('div');line.className='row';
   const tick=document.createElement('input');tick.type='checkbox';tick.dataset.agent=a.id;
   const label=document.createElement('label');label.className='check';label.append(tick,document.createTextNode('Paralel'));line.append(label);
   const pc=document.createElement('button');pc.className='sm';pc.textContent='▣ PC';pc.onclick=()=>{st.agent=a.id;$('pcTarget').value=a.id;drawer('pcDrawer')};line.append(pc);card.append(line);
   if(a.report){const report=document.createElement('p');report.textContent='Rapor: '+a.report.slice(0,450);card.append(report)}
   cards.append(card);
  }
 }catch(e){$('teamSummary').textContent=e.message}
}
$('addAgent').onclick=async()=>{
 const task=$('agentTask').value.trim();if(!st.chat||!task)return;
 $('addAgent').disabled=true;try{
 const r=await api('chats/'+st.chat+'/agents','POST',{name:$('agentName').value||'Alt Agent',task});
 $('agentTask').value='';$('agentLog').textContent='Agent oluşturuldu: '+r.agents.map(a=>a.name).join(', ');await roster();
 }catch(e){$('agentLog').textContent=e.message}finally{$('addAgent').disabled=false}
};
async function waitForPcs(ids){
 const until=Date.now()+180000;
 while(Date.now()<until){
  const d=await api('chats/'+st.chat+'/agents');const selected=ids.map(id=>d.agents.find(a=>a.id===id));
  if(selected.some(a=>!a))throw Error('Agent bulunamadı.');
  if(selected.some(a=>a.pc.status==='error'))throw Error('PC başlatma hatası.');
  for(const a of selected.filter(a=>['stopped','stale'].includes(a.pc.status)))await api('pc/start','POST',{chatId:st.chat,agentId:a.id});
  const waiting=selected.filter(a=>a.pc.status!=='running');
  if(!waiting.length)return;
  $('agentLog').textContent='PC hazırlanıyor: '+waiting.map(a=>a.name).join(', ');
  await new Promise(r=>setTimeout(r,5000));
 }
 throw Error('Bilgisayar 3 dakikada hazır olmadı. PC beklemeden model yanıtı alabilirsin.');
}
$('runAgents').onclick=async()=>{
 const ids=Array.from(document.querySelectorAll('input[data-agent]:checked')).map(e=>e.dataset.agent);
 if(!ids.length||ids.length>3){$('agentLog').textContent='1–3 agent seç.';return}
 $('runAgents').disabled=true;try{
  if($('waitForPc').checked)await waitForPcs(ids);
  $('agentLog').textContent='Alt agentlar eşzamanlı çalışıyor…';
  const r=await api('chats/'+st.chat+'/agents/run','POST',{agentIds:ids});
  $('agentLog').textContent=r.reports.map(x=>x.report||x.error||'Boş rapor').join('\n\n');await roster();
 }catch(e){$('agentLog').textContent=e.message}finally{$('runAgents').disabled=false}
};
for(const [id,key] of [['agentTerminal','allowExec'],['aiDesktop','allowDesktopAI']]){
 $(id).onchange=async e=>{const selected=e.target.checked;try{
  if(selected&&!confirm('Bu sohbet için AI '+(key==='allowExec'?'terminal':'masaüstü')+' kontrolüne izin verilsin mi?')){e.target.checked=false;return}
  await api('chats/'+st.chat+'/agents/permissions','POST',{[key]:selected});
 }catch(err){e.target.checked=!selected;$('agentLog').textContent=err.message}}
}
function pcBody(extra={}){return {chatId:st.chat,agentId:st.agent,...extra}}
async function pcAction(route,extra={}){
 try{const r=await api('pc/'+route,'POST',pcBody(extra));
  if(r.base64)present(r);else $('pcLog').textContent=JSON.stringify(r,null,2).slice(0,12000);
  return r;
 }catch(e){$('pcLog').textContent='Hata: '+e.message;return null}
}
async function pcStatus(){
 if(!st.chat)return;
 try{const r=await api('pc/status?chatId='+encodeURIComponent(st.chat)+'&agentId='+encodeURIComponent(st.agent));
  st.pcStatus=r;$('pcState').textContent=(r.status||'stopped')+' · '+(r.message||'');
  if(r.status!=='running'){$('screen').style.display='none';$('emptyScreen').style.display='block'}
 }catch(e){$('pcState').textContent=e.message}
}
function present(r){if(!/^[A-Za-z0-9+/=]+$/.test(r.base64||''))return;
 st.width=r.width||1280;st.height=r.height||800;$('screen').src='data:image/png;base64,'+r.base64;
 $('screen').style.display='block';$('emptyScreen').style.display='none';
}
async function shot(){if(!st.chat||!st.watch)return;
 try{const r=await api('pc/desktop/screenshot','POST',pcBody());present(r)}
 catch(e){$('emptyScreen').textContent='PC bekleniyor · '+e.message}
}
$('pcTarget').onchange=e=>{st.agent=e.target.value;pcStatus();shot()};
$('pcStart').onclick=async()=>{await pcAction('start');pcStatus()};
$('pcStop').onclick=async()=>{if(confirm('PC durdurulsun ve şifreli yedeği kaydedilsin mi?')){await pcAction('stop');pcStatus()}};
$('refresh').onclick=()=>{pcStatus();shot()};
$('screen').onclick=async e=>{
 const r=$('screen').getBoundingClientRect();
 const x=Math.min(st.width-1,Math.max(0,Math.floor((e.clientX-r.left)*st.width/r.width)));
 const y=Math.min(st.height-1,Math.max(0,Math.floor((e.clientY-r.top)*st.height/r.height)));
 await pcAction('desktop/action',{action:'click',x,y});shot();
};
for(const [id,action,extra] of [['scrollUp','scroll',{direction:'up',steps:3}],['scrollDown','scroll',{direction:'down',steps:3}],['enter','key',{key:'Return'}],['tab','key',{key:'Tab'}]]){
 $(id).onclick=async()=>{await pcAction('desktop/action',{action,...extra});shot()}
}
$('typeButton').onclick=async()=>{await pcAction('desktop/action',{action:'type',text:$('typeText').value});shot()};
$('visit').onclick=async()=>{await pcAction('navigate',{url:$('url').value});shot()};
$('exec').onclick=async()=>{const command=$('command').value.trim();if(command&&confirm('Yalnızca seçili PC üzerinde çalıştırılsın mı?\n'+command)){await pcAction('exec',{command,timeoutMs:18000});shot()}};
setInterval(async()=>{if(st.watch&&!document.hidden&&!st.refreshBusy){st.refreshBusy=true;try{await pcStatus();if(st.pcStatus?.status==='running')await shot()}finally{st.refreshBusy=false}}},6500);
// Audio remains optional; browser microphone recognition + remote low-RAM neural TTS.
function stopCall(){st.voice=false;st.rec?.abort();st.audio?.pause();if('speechSynthesis' in window)window.speechSynthesis.cancel();$('callOverlay').classList.remove('open')}
function listen(){if(!st.voice||st.muted||st.talking||st.busy)return;
 const Rec=window.SpeechRecognition||window.webkitSpeechRecognition;if(!Rec){$('callText').textContent='Tarayıcı konuşma tanıma desteklemiyor.';return}
 const rec=new Rec();st.rec=rec;rec.lang='tr-TR';let heard='';
 rec.onresult=e=>{for(let i=e.resultIndex;i<e.results.length;i++)if(e.results[i].isFinal)heard+=e.results[i][0].transcript;
 $('callText').textContent=heard||'Dinleniyor…'};
 rec.onend=()=>{if(heard.trim()&&st.voice)sendText(heard);else if(st.voice&&!st.muted)setTimeout(listen,650)};
 rec.onerror=e=>$('callText').textContent=e.error;
 try{rec.start()}catch(e){$('callText').textContent=e.message}
}
async function speak(text){st.talking=true;
 try{
  if($('voice').value!=='device'&&!st.edgeFailed){
   try{const r=await fetch('/dot/api/tts',{method:'POST',credentials:'same-origin',
    headers:{'Content-Type':'application/json'},body:JSON.stringify({text:text.slice(0,1000),voice:$('voice').value})});
    if(!r.ok)throw Error('TTS');
    const blob=await r.blob(),url=URL.createObjectURL(blob),audio=new Audio(url);st.audio=audio;
    try{await new Promise((ok,no)=>{audio.onended=ok;audio.onerror=no;audio.play().catch(no)});return}
    finally{st.audio=null;URL.revokeObjectURL(url)}
   }catch(e){st.edgeFailed=true}
  }
  if('speechSynthesis' in window)await new Promise(done=>{
   const u=new SpeechSynthesisUtterance(text.slice(0,1000));u.lang='tr-TR';u.onend=done;u.onerror=done;
   speechSynthesis.cancel();speechSynthesis.speak(u);setTimeout(done,23000)});
 }finally{st.talking=false;if(st.voice&&!st.muted)listen()}
}
$('callBtn').onclick=()=>{st.voice=true;st.muted=false;$('callOverlay').classList.add('open');listen()};
$('hangup').onclick=stopCall;$('mute').onclick=()=>{st.muted=!st.muted;if(st.muted)st.rec?.abort();else listen();$('mute').textContent=st.muted?'🎙 Aç':'🎙 Sustur'};
(async()=>{try{await threads();const wanted=new URLSearchParams(location.search).get('chatId');const selected=st.threads.find(t=>t.id===wanted)||st.threads[0];if(selected)await load(selected.id)}catch(e){notice(e.message)}})();
})();
</script></body></html>`;
return new Response(HTML,{headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store","X-Frame-Options":"DENY","X-Content-Type-Options":"nosniff","Content-Security-Policy":"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; media-src 'self' blob:; base-uri 'none'; frame-ancestors 'none'"}});
}
