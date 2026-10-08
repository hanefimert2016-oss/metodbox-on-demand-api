// Metodbox Dot Studio — lightweight original UI, no React/CopilotKit runtime.
export function dotPage() {
const HTML=String.raw`<!doctype html><html lang="tr"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#090d18"><title>Metodbox Dot Studio</title>
<style>
:root{color-scheme:dark;--bg:#090d17;--layer:#101726;--soft:#151e30;--line:#28344d;--ink:#f1f5ff;--muted:#9aabc5;--brand:#73a8ff;--mint:#5bd4be;--red:#ed8491}
*{box-sizing:border-box}html,body{height:100%;margin:0}body{background:var(--bg);color:var(--ink);font:14px system-ui,-apple-system,"Segoe UI",sans-serif}
button,textarea,input,select{font:inherit}button{cursor:pointer;border:1px solid var(--line);color:var(--ink);background:#1a2640;border-radius:11px;padding:10px 12px;transition:background .15s,transform .15s}button:hover{background:#283b5b}button:active{transform:scale(.985)}button:disabled{opacity:.55;cursor:wait}
button.primary{background:#436ccf;border-color:#648fe9;font-weight:650}button.primary:hover{background:#547fe3}button.ghost{background:transparent}button.danger{background:#4a2533;color:#ffb5c1}button.small{padding:7px 9px;font-size:12px}a{color:#b2d2ff;text-decoration:none}
input,textarea,select{background:#121d30;color:var(--ink);border:1px solid #304363;border-radius:11px;padding:11px 12px;outline:none;min-width:0}textarea{resize:vertical}input:focus,textarea:focus,select:focus{border-color:#6596e9}
.shell{height:100dvh;display:grid;grid-template-columns:254px minmax(0,1fr)}.rail{background:#0e1523;border-right:1px solid var(--line);padding:18px 12px;display:flex;flex-direction:column;gap:12px;min-width:0}
.brand{display:flex;align-items:center;gap:11px;padding:6px 9px}.logo{height:37px;width:37px;border-radius:14px;background:radial-gradient(circle at 28% 24%,#b5d8ff,#517cd1 54%,#273779);display:grid;place-items:center;box-shadow:0 5px 28px #3b73dc44;font-size:22px}
.brand strong{font-size:18px;letter-spacing:-.5px}.brand small{display:block;color:var(--muted);font-size:10px;letter-spacing:.12em;text-transform:uppercase}
.caption{color:var(--muted);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.11em;padding:6px 12px}
#threads{flex:1;overflow:auto;min-height:0}.thread{display:block;width:100%;text-align:left;background:transparent;border:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:12px 12px;font-size:13px;color:#b8c6dc}.thread.active{color:white;background:#233550;box-shadow:inset 3px 0 #8cbaff}
.railFooter{border-top:1px solid var(--line);padding:13px 8px;color:var(--muted);font-size:12px;line-height:1.6}.railFooter a{display:inline-block;margin-top:6px}
main{display:flex;min-width:0;height:100dvh;flex-direction:column}.topbar{height:65px;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:0 18px;border-bottom:1px solid var(--line)}
.heading{display:flex;align-items:center;gap:11px;min-width:0}.heading h1{font-size:15px;margin:0;letter-spacing:-.1px}.heading p{margin:2px 0 0;color:var(--muted);font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.tools{display:flex;align-items:center;gap:7px}.chip{font-size:11px;color:#aeeada;background:#113b36;border:1px solid #1f665b;padding:6px 9px;border-radius:100px}
.topbtn{background:#151e30;font-size:12px}.workspace{display:flex;min-height:0;flex:1;position:relative}
.conversation{display:flex;flex:1;flex-direction:column;min-width:0}
#messages{flex:1;min-height:0;overflow:auto;padding:24px max(18px,calc((100% - 850px)/2));scroll-behavior:smooth}
.welcome{margin:8vh auto 30px;max-width:560px;text-align:center}.welcome .symbol{margin:auto;width:75px;height:75px;border-radius:26px;background:radial-gradient(circle at 25% 20%,#8dd0ff,#4770d3 56%,#27366c);display:grid;place-items:center;font-size:35px;box-shadow:0 12px 55px #426ac64a}.welcome h2{font-size:28px;letter-spacing:-1px;margin:22px 0 10px}.welcome p{line-height:1.7;color:var(--muted);font-size:13px}
.message{max-width:810px;margin:0 auto 20px;display:flex;align-items:flex-start;gap:11px;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.7}
.message .face{width:30px;height:30px;flex:0 0 30px;border-radius:11px;background:#23385f;display:grid;place-items:center}.message.user .face{background:#2c4c47}
.message .content{min-width:0;flex:1;border:1px solid var(--line);padding:12px 16px;background:#121c2d;border-radius:5px 16px 16px 16px}
.message.user .content{background:#1c2e48}.message .who{color:#a9c9ff;font-size:11px;font-weight:750;display:block;margin-bottom:5px}
.composeWrap{border-top:1px solid var(--line);padding:14px clamp(12px,3vw,24px) calc(14px + env(safe-area-inset-bottom));background:#0e1421}
.compose{max-width:920px;margin:auto;display:flex;align-items:end;gap:10px}.compose textarea{flex:1;min-height:49px;max-height:160px}.compose button{min-height:49px}.hint{color:#7187a5;font-size:11px;text-align:center;margin-top:9px}
.drawer{width:445px;flex:0 0 445px;border-left:1px solid var(--line);background:#101725;display:none;overflow:auto;padding:17px}.drawer.open{display:block}
.drawerHead{display:flex;align-items:start;justify-content:space-between;gap:10px;margin-bottom:16px}.drawer h2{margin:0 0 3px;font-size:17px}.drawer .sub{font-size:11px;color:var(--muted);line-height:1.4}
.row{display:flex;align-items:center;gap:7px;flex-wrap:wrap}.row.spread{justify-content:space-between}.field{display:block;color:#aabfdc;font-size:11px;margin:12px 0 7px;font-weight:700}
.statusbox{border:1px solid #324460;background:#152239;border-radius:12px;padding:12px;margin-bottom:12px;font-size:12px;line-height:1.6}
.dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:#7f8a9e;margin-right:7px}.dot.ready{background:#64d6b0;box-shadow:0 0 0 3px #64d6b022}.dot.wait{background:#e4b46e}
.desktop{background:#060a12;border:1px solid #3c4c64;border-radius:13px;overflow:hidden;position:relative;min-height:235px;display:flex;align-items:center;justify-content:center}
.desktop img{display:block;max-width:100%;width:100%;height:auto;cursor:crosshair;user-select:none;-webkit-user-drag:none}
.desktopPlaceholder{color:#7288a4;text-align:center;padding:42px 15px;font-size:12px;line-height:1.7}
.desktopBar{display:flex;gap:8px;align-items:center;justify-content:space-between;background:#18243a;border:1px solid #38465e;border-bottom:0;border-radius:12px 12px 0 0;padding:10px 12px;font-size:11px;color:#bed4f6}
.screenControls{margin:10px 0}.screenControls input{width:100%;margin:6px 0}.screenControls .row button{flex:1}
.report{background:#0b1322;border:1px solid var(--line);padding:12px;border-radius:11px;white-space:pre-wrap;overflow-wrap:anywhere;max-height:230px;overflow:auto;font-size:12px;line-height:1.55;color:#bbcee6}
.agent{background:#172439;border:1px solid #2e405d;padding:12px;border-radius:12px;margin:8px 0}.agent.selected{border-color:#7caeff}.agent h3{margin:0 0 6px;font-size:13px}.agent p{color:#b1c1d6;font-size:11px;line-height:1.5;max-height:84px;overflow:auto}
.checkbox{display:flex;align-items:center;gap:9px;color:#bdcde4;font-size:12px;line-height:1.5}.checkbox input{width:16px;height:16px}
.call{position:fixed;inset:0;display:none;align-items:center;justify-content:center;z-index:40;background:#090e1df4;padding:24px}.call.open{display:flex}.callcard{text-align:center;width:min(470px,100%);padding:32px 24px;background:#121d30;border:1px solid #375076;border-radius:25px;box-shadow:0 26px 120px #000b}
.callorb{width:120px;height:120px;border-radius:50%;background:radial-gradient(circle at 25% 23%,#b8dbff,#4a77dd,#283c7b);display:grid;place-items:center;margin:12px auto 25px;font-size:42px;box-shadow:0 0 0 16px #4464ad1c}.callcard h2{margin:7px}.callcard p{line-height:1.6;color:#a9bddb;font-size:13px}
#menuBtn{display:none}
@media(max-width:1050px){.shell{grid-template-columns:215px minmax(0,1fr)}.drawer{position:absolute;right:0;top:0;bottom:0;width:min(455px,100%);z-index:9;box-shadow:-14px 0 65px #0009;flex:none}}
@media(max-width:720px){.shell{display:block}.rail{position:fixed;z-index:20;left:0;top:0;bottom:0;width:min(290px,87vw);display:none;box-shadow:12px 0 70px #0009}.rail.open{display:flex}#menuBtn{display:block}.topbar{padding:0 10px;height:61px}.heading p{display:none}.topbtn{padding:9px;font-size:12px}.chip{display:none}.drawer{width:100%;left:0}.welcome{margin:8vh auto 20px}.welcome h2{font-size:24px}#messages{padding:16px 12px}.message .content{padding:11px}.composeWrap{padding:10px 9px calc(11px + env(safe-area-inset-bottom))}.hint{display:none}}
</style></head><body>
<div class="shell">
<aside class="rail" id="rail">
  <div class="brand"><div class="logo">✦</div><div><strong>Metodbox Dot</strong><small>Agent workspace</small></div></div>
  <button class="primary" id="newChat">＋ Yeni çalışma alanı</button>
  <div class="caption">Konuşmalar</div><div id="threads"></div>
  <div class="railFooter"><span class="dot ready"></span> Kendi GPT+ API'n<br>Şifreli özel GitHub geçmişi<br><a href="/apps">Hesap ayarları ↗</a></div>
</aside>
<main>
  <header class="topbar">
    <div class="heading"><button class="ghost small" id="menuBtn">☰</button><div><h1>✦ Dot Studio</h1><p id="chatTitle">Her sohbet ayrı bir bilgisayardır</p></div></div>
    <div class="tools"><span class="chip">● Bağlı</span><button class="topbtn" id="agentsBtn">◈ Agentlar</button><button class="topbtn" id="pcBtn">▣ Masaüstü</button><button class="primary" id="callBtn">☎ Ara</button></div>
  </header>
  <div class="workspace">
    <section class="conversation"><div id="messages"><div class="welcome"><div class="symbol">✦</div><h2>Ne oluşturmak istiyorsun?</h2><p>Dot senin ana agent'ın. Kendi bilgisayarında kod yazabilir, web üzerinde çalışabilir ve görevleri bağımsız alt agent'lara dağıtabilir. Başlamak için mesaj gönder veya yeni çalışma alanı oluştur.</p></div></div>
    <div class="composeWrap"><div class="compose"><textarea id="prompt" rows="1" placeholder="Dot'a bir görev ver..."></textarea><button id="send" class="primary">Gönder ↗</button></div><div class="hint" id="status">Kendi modelin · Eşzamanlı agentlar · Kalıcı çalışma alanları</div></div></section>
    <aside class="drawer" id="pcDrawer">
      <div class="drawerHead"><div><h2>▣ Canlı Masaüstü</h2><div class="sub">Openbox · Linux · Chromium · Terminal</div></div><button class="small ghost" id="pcClose">✕</button></div>
      <label class="field" for="pcTarget">Agent bilgisayarı</label><select id="pcTarget"><option value="main">Ana Agent</option></select>
      <div class="statusbox"><span class="dot wait" id="pcDot"></span><strong id="pcState">Bilgisayar bekleniyor</strong><div class="sub" id="pcDescription">GitHub Actions sanal PC'yi hazırlar.</div></div>
      <div class="row" style="margin-bottom:12px"><button class="small primary" id="pcStart">▶ Başlat</button><button class="small" id="pcStop">■ Durdur + yedekle</button><button class="small" id="refresh">↻ Yenile</button></div>
      <div class="desktopBar"><span>● Metodbox Linux · 1280 × 800</span><span id="frameTime">Canlı ekran</span></div>
      <div class="desktop" id="desktop"><div id="desktopPlaceholder" class="desktopPlaceholder">▣<p>Bilgisayar açıldığında gerçek Linux masaüstü burada görünecek.</p></div><img id="screen" style="display:none" alt="Agent'ın gerçek Linux masaüstü"/></div>
      <div class="row screenControls"><button class="small" id="clickMode">☞ Ekrana dokun: tıkla</button><button class="small" id="scrollUp">↑ Kaydır</button><button class="small" id="scrollDown">↓ Kaydır</button></div>
      <label class="field">Klavyeden yaz</label><input id="typeText" placeholder="Masaüstüne yazılacak metin"><div class="row" style="margin-top:7px"><button class="small primary" id="typeButton">Yaz →</button><button class="small" id="enter">↵ Enter</button><button class="small" id="tab">⇥ Tab</button><button class="small" id="escape">Esc</button><button class="small" id="ctrlL">Ctrl+L</button></div>
      <label class="field">Tarayıcı adresi</label><div class="row"><input id="url" value="https://example.org" style="flex:1"><button class="small" id="visit">Git</button></div>
      <label class="field">Terminal (onay gerektirir)</label><textarea id="command" rows="2" style="width:100%" placeholder="Örn. pwd"></textarea><button id="exec" class="small">⌘ Komutu çalıştır</button>
      <div class="field">İşlem sonucu</div><div class="report" id="pcLog">Masaüstü açılmayı bekliyor.</div>
    </aside>
    <aside class="drawer" id="agentsDrawer">
      <div class="drawerHead"><div><h2>◈ Agent Ekibi</h2><div class="sub">Ana agent + bağımsız PC'li alt agentlar</div></div><button class="small ghost" id="agentsClose">✕</button></div>
      <div class="statusbox" id="teamSummary">Bir sohbet seçtiğinde ekibi görebilirsin.</div>
      <div id="agentCards"></div>
      <label class="field">Yeni alt agent</label><input id="agentName" placeholder="Örn. Araştırmacı" maxlength="80" style="width:100%">
      <textarea id="agentTask" placeholder="Bu agent'ın görevi..." maxlength="2000" style="width:100%;margin-top:8px" rows="3"></textarea>
      <div class="row" style="margin:10px 0"><button class="small primary" id="addAgent">＋ Agent oluştur</button><button class="small" id="runAgents">▶ Paralel çalıştır</button></div>
      <label class="checkbox"><input type="checkbox" id="waitForPc" checked> Görevden önce PC'ler hazır olsun</label>
      <label class="checkbox" style="margin-top:13px"><input type="checkbox" id="agentTerminal"> AI agentlarına terminal izni</label>
      <label class="checkbox" style="margin-top:10px"><input type="checkbox" id="aiDesktop"> AI'ın masaüstünde fare/klavye kullanmasına izin ver</label>
      <div class="report" id="agentLog" style="margin-top:15px">Agentların görev raporları burada görünecek.</div>
      <p class="sub" style="line-height:1.6">En çok 6 alt agent, bir turda 3 paralel model çağrısı. PC'ler ayrı GitHub runner'lardır. Terminal ve AI masaüstü izni kapalı başlar.</p>
    </aside>
  </div>
</main></div>
<div class="call" id="callOverlay"><div class="callcard"><div class="callorb">✦</div><h2>Dot ile konuş</h2><p id="callText">Mikrofon hazırlanıyor.</p><select id="voice" style="width:100%"><option value="tr-TR-EmelNeural">Emel · Neural Türkçe</option><option value="tr-TR-AhmetNeural">Ahmet · Neural Türkçe</option><option value="device">Telefon sesi</option></select><div class="row" style="justify-content:center;margin-top:20px"><button id="mute">🎙 Mikrofonu kapat</button><button class="danger" id="hangup">☎ Bitir</button></div><p style="font-size:11px">Tarayıcı görüşmesi · Mikrofon/konuşma tanıma desteği telefona bağlıdır. Neural ses için metin Microsoft'a gönderilebilir.</p></div></div>
<script>
(()=>{'use strict';
const $=id=>document.getElementById(id);
const st={chat:null,threads:[],roster:null,agent:'main',busy:false,pcStatus:null,watch:false,refreshBusy:false,voice:false,muted:false,recognizer:null,talking:false,audio:null,edgeFailed:false,stopWaiting:false};
function msg(t){$('status').textContent=t}
async function api(route,method='GET',body){
 const r=await fetch('/dot/api/'+route,{method,credentials:'same-origin',cache:'no-store',
 headers:{'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 const data=await r.json().catch(()=>({}));
 if(!r.ok)throw Error(data.error||'HTTP '+r.status);
 return data;
}
function showDrawer(which){for(const key of ['pc','agents'])$(key+'Drawer').classList.toggle('open',key===which&&!$(key+'Drawer').classList.contains('open'));st.watch=$('pcDrawer').classList.contains('open');if(st.watch){pcStatus();shot()}if($('agentsDrawer').classList.contains('open'))roster()}
function closeDrawers(){for(const id of ['pcDrawer','agentsDrawer'])$(id).classList.remove('open');st.watch=false}
function addMessage(role,text){
 const root=document.createElement('article');root.className='message '+role;
 const face=document.createElement('span');face.className='face';face.textContent=role==='user'?'◉':'✦';
 const body=document.createElement('div');body.className='content';
 const who=document.createElement('span');who.className='who';who.textContent=role==='user'?'Sen':'Dot';
 body.append(who,document.createTextNode(String(text||'')));root.append(face,body);
 if($('messages').querySelector('.welcome'))$('messages').replaceChildren();
 $('messages').append(root);$('messages').scrollTop=$('messages').scrollHeight;
}
function remember(id){history.replaceState(null,'','/dot?chatId='+encodeURIComponent(id))}
async function threads(){
 try{const d=await api('threads');st.threads=d.threads||[];const container=$('threads');container.replaceChildren();
 for(const t of st.threads){const b=document.createElement('button');b.className='thread'+(t.id===st.chat?' active':'');b.textContent='◦  '+(t.title||'Yeni konuşma');b.onclick=()=>load(t.id);container.append(b)}}
 catch(e){msg('Konuşmalar yüklenemedi: '+e.message)}
}
async function load(id){
 try{const t=await api('threads/'+encodeURIComponent(id));st.chat=t.id;st.agent='main';remember(t.id);
 $('chatTitle').textContent=t.title||'Yeni konuşma';$('messages').replaceChildren();
 for(const m of t.messages||[])if(m.role==='user'||m.role==='assistant')addMessage(m.role,m.content);
 if(!(t.messages||[]).length)addMessage('assistant','Yeni çalışma alanın hazır. Bir görev ver veya masaüstünü aç.');
 await threads();await roster();$('rail').classList.remove('open');msg('Sohbete bağlandı.')}
 catch(e){msg('Sohbet açılamadı: '+e.message)}
}
async function create(title='Yeni konuşma'){
 const t=await api('threads','POST',{title});st.chat=t.id;st.agent='main';remember(t.id);
 $('chatTitle').textContent=title;$('messages').replaceChildren();
 addMessage('assistant',t.pc?.status==='error'?'Sohbet hazır. PC hatası: '+t.pc.message:'Yeni çalışma alanını oluşturdum. PC arka planda hazırlanıyor.');
 await threads();await roster();$('rail').classList.remove('open');return t;
}
async function sendText(value){
 const text=String(value||'').trim();if(!text||st.busy)return;
 st.busy=true;$('send').disabled=true;msg('Dot düşünüyor…');
 try{if(!st.chat)await create(text.slice(0,55));addMessage('user',text);
 const d=await api('message','POST',{threadId:st.chat,text});
 addMessage('assistant',d.content||'Yanıt gelmedi.');msg(d.saved?'Hazır':'Yanıt geldi ancak geçmiş kaydedilemedi.');
 if(st.voice&&d.content)await speak(d.content);await threads();await roster();
 }catch(e){addMessage('assistant','Bağlantı hatası: '+e.message);msg(e.message)}
 finally{st.busy=false;$('send').disabled=false;if(st.voice&&!st.muted)listen()}
}
$('send').onclick=()=>{const t=$('prompt').value;$('prompt').value='';sendText(t)};
$('prompt').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();$('send').click()}};
$('newChat').onclick=()=>create().catch(e=>msg(e.message));
$('menuBtn').onclick=()=>$('rail').classList.toggle('open');
$('pcBtn').onclick=()=>{if(!st.chat){msg('Önce yeni sohbet oluştur');return}showDrawer('pc')};
$('agentsBtn').onclick=()=>{if(!st.chat){msg('Önce yeni sohbet oluştur');return}showDrawer('agents')};
$('pcClose').onclick=closeDrawers;$('agentsClose').onclick=closeDrawers;

async function roster(){
 if(!st.chat)return;
 try{
  const data=await api('chats/'+encodeURIComponent(st.chat)+'/agents');st.roster=data;
  $('teamSummary').textContent='Ana PC: '+(data.mainPc?.status||'stopped')+' · Alt agent: '+data.agents.length+'/6';
  $('agentTerminal').checked=data.allowExec===true;
  $('aiDesktop').checked=data.allowDesktopAI===true;
  const select=$('pcTarget');select.replaceChildren();
  select.add(new Option('★ Ana Agent · '+data.mainPc.status,'main'));
  for(const a of data.agents)select.add(new Option(a.name+' · '+(a.pc?.status||'stopped'),a.id));
  if(!Array.from(select.options).some(x=>x.value===st.agent))st.agent='main';select.value=st.agent;
  const cards=$('agentCards');cards.replaceChildren();
  for(const a of data.agents){
   const box=document.createElement('section');box.className='agent';
   const h=document.createElement('h3');h.textContent=a.name+' · '+(a.pc?.status||'stopped');box.append(h);
   const p=document.createElement('p');p.textContent=a.task;box.append(p);
   const row=document.createElement('div');row.className='row';
   const check=document.createElement('input');check.type='checkbox';check.dataset.agent=a.id;
   const label=document.createElement('label');label.className='checkbox';label.append(check,document.createTextNode('Paralel seç'));row.append(label);
   const pc=document.createElement('button');pc.className='small';pc.textContent='▣ PC';pc.onclick=()=>{st.agent=a.id;$('pcTarget').value=a.id;showDrawer('pc')};row.append(pc);
   if(a.report){const r=document.createElement('p');r.textContent='Rapor: '+a.report.slice(0,500);box.append(r)}
   box.append(row);cards.append(box);
  }
 }catch(e){$('teamSummary').textContent='Agent durumu: '+e.message}
}
$('addAgent').onclick=async()=>{
 const task=$('agentTask').value.trim();if(!task||!st.chat){$('agentLog').textContent='Önce görev yaz ve sohbet oluştur.';return}
 $('addAgent').disabled=true;
 try{const r=await api('chats/'+st.chat+'/agents','POST',{name:$('agentName').value||'Alt Agent',task});
 $('agentTask').value='';$('agentLog').textContent='Agent oluşturuldu: '+r.agents.map(a=>a.name+' · '+a.pc.status).join(', ');await roster()}
 catch(e){$('agentLog').textContent=e.message}finally{$('addAgent').disabled=false}
};
async function waitForPcs(ids){
 const deadline=Date.now()+180000;st.stopWaiting=false;
 while(Date.now()<deadline){
  if(st.stopWaiting)throw Error('Bekleme iptal edildi.');
  const d=await api('chats/'+st.chat+'/agents');
  const active=ids.map(id=>d.agents.find(a=>a.id===id));
  if(active.some(a=>!a))throw Error('Agent bulunamadı');
  if(active.some(a=>a.pc.status==='error'))throw Error('Agent PC başlatma hatası');
  const stopped=active.filter(a=>['stopped','stale'].includes(a.pc.status));
  for(const a of stopped)await api('pc/start','POST',{chatId:st.chat,agentId:a.id});
  const waiting=active.filter(a=>a.pc.status!=='running');
  if(!waiting.length)return;
  $('agentLog').textContent='Bilgisayarlar hazırlanıyor: '+waiting.map(a=>a.name+' · '+a.pc.status).join(', ');
  await new Promise(r=>setTimeout(r,5000));
 }
 throw Error('PC zaman aşımı. Görevi bilgisayar beklemeden çalıştırabilirsin.');
}
$('runAgents').onclick=async()=>{
 const ids=Array.from(document.querySelectorAll('input[data-agent]:checked')).map(e=>e.dataset.agent);
 if(!ids.length||ids.length>3){$('agentLog').textContent='1–3 agent seç.';return}
 $('runAgents').disabled=true;
 try{if($('waitForPc').checked)await waitForPcs(ids);
 $('agentLog').textContent='Paralel modeller çalışıyor…';
 const r=await api('chats/'+st.chat+'/agents/run','POST',{agentIds:ids});
 $('agentLog').textContent=r.reports.map(x=>(x.report||x.error||'Boş yanıt')).join('\n\n');await roster();
 }catch(e){$('agentLog').textContent=e.message}finally{$('runAgents').disabled=false}
};
async function setConsent(key,enabled){
 if(enabled&&!confirm('Bu sohbette AI agentlarına '+(key==='allowDesktopAI'?'masaüstünde fare/klavye':'terminal')+' yetkisi verilsin mi?'))return false;
 const v=await api('chats/'+st.chat+'/agents/permissions','POST',{[key]:enabled});st.roster=v;return true;
}
for(const [element,key] of [['agentTerminal','allowExec'],['aiDesktop','allowDesktopAI']]){
 $(element).onchange=async e=>{const checked=e.target.checked;
  try{if(!await setConsent(key,checked))e.target.checked=false}
  catch(err){e.target.checked=!checked;$('agentLog').textContent=err.message}
 };
}
function pcBody(extra={}){return {chatId:st.chat,agentId:st.agent,...extra}}
async function pcAction(route,extra={}){
 try{const r=await api('pc/'+route,'POST',pcBody(extra));
  if(r.status){$('pcLog').textContent=r.status+' · '+(r.message||'');await pcStatus()}
  else if(r.base64){presentShot(r)}
  else $('pcLog').textContent=JSON.stringify(r,null,2).slice(0,14000);
  return r;
 }catch(e){$('pcLog').textContent='PC: '+e.message;return null}
}
async function pcStatus(){
 if(!st.chat)return;
 try{const r=await api('pc/status?chatId='+encodeURIComponent(st.chat)+'&agentId='+encodeURIComponent(st.agent));
  st.pcStatus=r;$('pcState').textContent=r.status||'stopped';$('pcDescription').textContent=r.message||'PC hazır olunca masaüstü görüntülenir.';
  $('pcDot').className='dot '+(r.status==='running'?'ready':'wait');
  if(r.status!=='running'){$('screen').style.display='none';$('desktopPlaceholder').style.display='block'}
 }catch(e){$('pcState').textContent='Bağlantı hatası';$('pcDescription').textContent=e.message}
}
function presentShot(r){if(!r.base64||!(/^[A-Za-z0-9+/=]+$/).test(r.base64))return;
 $('screen').src='data:image/png;base64,'+r.base64;$('screen').style.display='block';$('desktopPlaceholder').style.display='none';
 st.width=r.width||1280;st.height=r.height||800;$('frameTime').textContent=new Date().toLocaleTimeString('tr-TR');
}
async function shot(){if(!st.chat||!st.watch)return;
 try{const r=await api('pc/desktop/screenshot','POST',pcBody());presentShot(r)}
 catch(e){$('desktopPlaceholder').textContent='Masaüstü bekleniyor: '+e.message}
}
$('pcTarget').onchange=e=>{st.agent=e.target.value;pcStatus();shot()};
$('pcStart').onclick=async()=>{await pcAction('start');await roster()};
$('pcStop').onclick=async()=>{if(confirm('Bu bilgisayar kapatılsın ve şifreli dosyalar kaydedilsin mi?')){await pcAction('stop');await roster()}};
$('refresh').onclick=()=>{pcStatus();shot()};
async function inputDesktop(action,fields={}){return pcAction('desktop/action',{action,...fields})}
$('desktop').onclick=async e=>{
 if(e.target!==$('screen')||!st.width)return;
 const r=$('screen').getBoundingClientRect();
 const x=Math.max(0,Math.min(st.width-1,Math.floor((e.clientX-r.left)*st.width/r.width)));
 const y=Math.max(0,Math.min(st.height-1,Math.floor((e.clientY-r.top)*st.height/r.height)));
 await inputDesktop('click',{x,y});await shot();
};
$('scrollUp').onclick=async()=>{await inputDesktop('scroll',{direction:'up',steps:4});await shot()};
$('scrollDown').onclick=async()=>{await inputDesktop('scroll',{direction:'down',steps:4});await shot()};
$('typeButton').onclick=async()=>{await inputDesktop('type',{text:$('typeText').value});await shot()};
for(const [id,key] of [['enter','Return'],['tab','Tab'],['escape','Escape'],['ctrlL','ctrl+l']]){
 $(id).onclick=async()=>{await inputDesktop('key',{key});await shot()}
}
$('visit').onclick=async()=>{await pcAction('navigate',{url:$('url').value});await shot()};
$('exec').onclick=async()=>{
 const command=$('command').value.trim();
 if(!command||!confirm('Komut yalnızca seçili GitHub PC üzerinde çalıştırılacak:\n'+command))return;
 await pcAction('exec',{command,timeoutMs:20000});await shot();
};
setInterval(async()=>{if(st.watch&&!document.hidden&&!st.refreshBusy){st.refreshBusy=true;try{await pcStatus();if(st.pcStatus?.status==='running')await shot()}finally{st.refreshBusy=false}}},5000);
// Lightweight optional voice call. No local AI weights; Edge neural cloud voice
// with browser voice fallback; recognition support varies by Android browser.
function endCall(){st.voice=false;st.recognizer?.abort();if(st.audio)st.audio.pause();if('speechSynthesis' in window)speechSynthesis.cancel();$('callOverlay').classList.remove('open')}
function listen(){if(!st.voice||st.muted||st.talking)return;
 const Rec=window.SpeechRecognition||window.webkitSpeechRecognition;
 if(!Rec){$('callText').textContent='Bu tarayıcıda konuşma tanıma yok. Mesaj kutusunu kullanabilirsin.';return}
 const r=new Rec();st.recognizer=r;r.lang='tr-TR';r.interimResults=true;let final='';
 r.onresult=e=>{for(let i=e.resultIndex;i<e.results.length;i++){if(e.results[i].isFinal)final+=e.results[i][0].transcript;
 else $('callText').textContent=e.results[i][0].transcript}};
 r.onerror=e=>$('callText').textContent='Mikrofon: '+e.error;
 r.onend=()=>{if(final.trim()&&st.voice){$('callText').textContent=final;sendText(final)}else if(st.voice&&!st.muted&&!st.talking)setTimeout(listen,800)};
 try{r.start();$('callText').textContent='Seni dinliyorum…'}catch(e){$('callText').textContent=e.message}
}
async function deviceVoice(text){if(!('speechSynthesis' in window))return;
 await new Promise(done=>{const u=new SpeechSynthesisUtterance(text.slice(0,650));u.lang='tr-TR';u.onend=done;u.onerror=done;speechSynthesis.cancel();speechSynthesis.speak(u);setTimeout(done,20000)});
}
async function speak(text){st.talking=true;
 try{let used=false;
 if($('voice').value!=='device'&&!st.edgeFailed){
  try{const r=await fetch('/dot/api/tts',{method:'POST',credentials:'same-origin',
   headers:{'Content-Type':'application/json'},body:JSON.stringify({text:text.slice(0,900),voice:$('voice').value})});
   if(!r.ok)throw Error('TTS unavailable');
   const blob=await r.blob();if(blob.size<500)throw Error('Empty audio');
   const url=URL.createObjectURL(blob);const audio=new Audio(url);st.audio=audio;
   try{await new Promise((ok,no)=>{audio.onended=ok;audio.onerror=no;audio.play().catch(no)});used=true}
   finally{URL.revokeObjectURL(url);st.audio=null}
  }catch(e){st.edgeFailed=true}
 }
 if(!used)await deviceVoice(text);
 }finally{st.talking=false}
}
$('callBtn').onclick=()=>{st.voice=true;st.muted=false;$('callOverlay').classList.add('open');listen()};
$('hangup').onclick=endCall;
$('mute').onclick=()=>{st.muted=!st.muted;$('mute').textContent=st.muted?'🎙 Mikrofonu aç':'🎙 Mikrofonu kapat';
 if(st.muted)st.recognizer?.abort();else listen()};
(async()=>{await threads();const wanted=new URLSearchParams(location.search).get('chatId');
 const choice=st.threads.find(t=>t.id===wanted)||st.threads[0];if(choice)await load(choice.id)})();
})();
</script></body></html>`;
return new Response(HTML,{headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store",
"X-Content-Type-Options":"nosniff","X-Frame-Options":"DENY","Referrer-Policy":"no-referrer",
"Content-Security-Policy":"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; media-src 'self' blob:; base-uri 'none'; frame-ancestors 'none'"}});
}
