import './styles/main.css';
import { PRESETS,buildTrack,copyTrack,COLORS,type TrackData,type TrackGeometry } from './game/Track';
import { RaceManager,formatTime,type Mode } from './game/RaceManager';
import { Renderer,fitView } from './rendering/Renderer';
import { TrackEditor,type Tool } from './editor/TrackEditor';
import { InputManager } from './input/InputManager';
import { TouchControls } from './input/TouchControls';
import { GameAudio } from './game/Audio';
import { allTracks,byId,deleteTrack,getBest,importTrack,putTrack,saveBest,savedTracks } from './storage/Tracks';

type Screen='menu'|'setup'|'editor'|'tracks'|'settings'|'race'|'results';
const app=document.getElementById('app')!;
app.innerHTML=`<div class="app-shell">
  <header class="header"><div class="logo"><span class="logo-mark">S<span>•</span></span><span>SLOT<span class="accent">CARS</span><small>MINIATURE RACING SIMULATOR</small></span></div><div class="header-right"><span class="live-dot"></span><span>LOCAL MULTIPLAYER</span><button class="icon-button" id="sound-toggle" title="Audio on/off" aria-label="Audio">♫</button></div></header>
  <main class="stage" id="stage"><canvas id="track-canvas" aria-label="Circuito delle slot car"></canvas><div id="screen" class="screen"></div><div id="hud" class="hud hidden"></div><div id="touch" class="touch-controls hidden"></div><div id="notice" class="notice hidden" role="status"></div></main>
  <footer class="footer"><span><span class="footer-led"></span> PHYSICS ENGINE · 120 HZ</span><span>NO SERVER · GITHUB PAGES READY</span></footer>
</div>`;
const stage=document.getElementById('stage')!, canvas=document.getElementById('track-canvas') as HTMLCanvasElement;
const screenEl=document.getElementById('screen')!,hud=document.getElementById('hud')!,touchEl=document.getElementById('touch')!,noticeEl=document.getElementById('notice')!;
const renderer=new Renderer(canvas),input=new InputManager(),audio=new GameAudio();
let screen:Screen='menu',selectedTrackId='oval',mode:Mode='quick',playerCount=2,laps=5;
let playerNames=['Pilota 1','Pilota 2','Pilota 3','Pilota 4'];
let edit:TrackEditor|null=null,race:RaceManager|null=null,touch:TouchControls|null=null;
let current=buildTrack(byId('oval')),last=performance.now(),accumulator=0,hudTimer=0;
const FIXED=1/120;
let noteTimeout:number|undefined;
const html=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c));
function notice(message:string):void{
  noticeEl.textContent=message;noticeEl.classList.remove('hidden');clearTimeout(noteTimeout);
  noteTimeout=window.setTimeout(()=>noticeEl.classList.add('hidden'),3200);
}
function button(text:string,action:string,extra='',cls=''):string{return `<button class="${cls||'btn'}" data-action="${action}" ${extra}>${text}</button>`;}
function trackOptions(currentId:string):string{return allTracks().map(t=>`<option value="${html(t.id)}" ${t.id===currentId?'selected':''}>${html(t.name)} · ${t.lanes} corsie</option>`).join('');}
function cleanup():void{edit?.dispose();edit=null;touch?.dispose();touch=null;input.touch.fill(0);hud.classList.add('hidden');touchEl.classList.add('hidden');race=null;audio.stop();canvas.style.pointerEvents='none';}
function setScreen(next:Screen):void{
  if(next!=='race'&&next!=='results')cleanup();screen=next;renderScreen();
}
function renderScreen():void{
  screenEl.className=`screen screen-${screen}`;
  if(screen==='menu'){
    screenEl.innerHTML=`<div class="menu-content"><div class="eyebrow">THE TABLETOP RACING EXPERIENCE <span class="tag">MVP 1.0</span></div>
      <h1>PRECISIONE.<br><em>NON FORTUNA.</em></h1>
      <p class="intro">Niente sterzo, solo acceleratore e la giusta sensibilità in curva. Costruisci circuiti, sfida fino a quattro amici e resta agganciato alla corsia.</p>
      <div class="menu-actions">${button('🏁 &nbsp; GARA RAPIDA','quick','','btn primary')}${button('⏱ &nbsp; TIME ATTACK','time','','btn')}${button('✎ &nbsp; EDITOR PISTE','editor','','btn')}${button('▤ &nbsp; PISTE SALVATE','tracks','','btn')}${button('⚙ &nbsp; IMPOSTAZIONI','settings','','btn subtle')}</div>
      <div class="menu-tip"><span class="tip-label">COME SI GUIDA</span><span><b>A / L / V / ↑</b> per accelerare · rilascia prima delle curve · su telefono usa i trigger touch.</span></div></div>`;
  } else if(screen==='setup'){
    let track=byId(selectedTrackId);if(!track)track=byId('oval');
    if(mode==='time')playerCount=1;else playerCount=Math.max(1,Math.min(playerCount,track.lanes));
    screenEl.innerHTML=`<div class="panel setup-panel"><div class="panel-heading"><span class="eyebrow">PRONTO ALLA PARTENZA?</span><h2>${mode==='quick'?'GARA RAPIDA':'TIME ATTACK'}</h2><p>${mode==='quick'?'Scegli piloti, circuito e numero di giri.':'Giri illimitati, cronometro e record personale salvato sul dispositivo.'}</p></div>
      <div class="field"><label for="track-choice">CIRCUITO</label><select id="track-choice">${trackOptions(selectedTrackId)}</select></div>
      <div class="setup-grid"><div class="field"><label for="player-choice">PILOTI</label><select id="player-choice" ${mode==='time'?'disabled':''}>${Array.from({length:track.lanes},(_,i)=>`<option value="${i+1}" ${playerCount===i+1?'selected':''}>${i+1} ${i===0?'pilota':'piloti'}</option>`).join('')}</select></div>
      <div class="field"><label for="laps-choice">GIRI</label><select id="laps-choice" ${mode==='time'?'disabled':''}>${[3,5,10].map(n=>`<option value="${n}" ${laps===n?'selected':''}>${mode==='time'?'∞':n}</option>`).join('')}</select></div></div>
      <div class="drivers">${Array.from({length:playerCount},(_,p)=>`<div class="driver-field" style="--driver-color:${COLORS[p]}"><span class="driver-dot"></span><input maxlength="18" aria-label="Nome pilota ${p+1}" data-name="${p}" value="${html(playerNames[p])}" /><small>${html(input.bindings[p].replace('Key','').replace('Arrow','↑ '))}</small></div>`).join('')}</div>
      <p class="setup-advice">Su smartphone: 2 piloti consigliati in orizzontale. Ogni giocatore controlla solo il proprio acceleratore. I gamepad sono configurabili nelle impostazioni.</p>
      <div class="panel-actions">${button('← INDIETRO','menu','','btn subtle')}${button('AVVIA PARTITA →','start-race','','btn primary')}</div></div>`;
  } else if(screen==='tracks'){
    screenEl.innerHTML=`<div class="panel tracks-panel"><div class="panel-heading"><span class="eyebrow">GARAGE / CIRCUITI</span><h2>LE TUE PISTE</h2></div><div class="track-list">${allTracks().map(t=>`<div class="track-item"><div><b>${html(t.name)}</b><small>${t.lanes} corsie · ${PRESETS.some(p=>p.id===t.id)?'PREDEFINITA':'SALVATA LOCALMENTE'}</small></div><div class="track-item-actions"><button data-action="choose-track" data-id="${html(t.id)}">GIOCA</button><button data-action="edit-track" data-id="${html(t.id)}">MODIFICA</button>${PRESETS.some(p=>p.id===t.id)?'':`<button data-action="rename-track" data-id="${html(t.id)}">RINOMINA</button><button class="danger" data-action="delete-track" data-id="${html(t.id)}">×</button>`}</div></div>`).join('')}</div><div class="panel-actions">${button('← MENU','menu','','btn subtle')}${button('IMPORTA JSON','import-track','','btn')}${button('+ NUOVA PISTA','new-track','','btn primary')}</div></div>`;
  } else if(screen==='settings'){
    screenEl.innerHTML=`<div class="panel settings-panel"><div class="panel-heading"><span class="eyebrow">CONFIGURAZIONE</span><h2>CONTROLLI</h2><p>Clicca un tasto per rimapparlo. Puoi usare anche controller collegati via USB o Bluetooth.</p></div>
      <div class="setting-list">${input.bindings.map((key,p)=>`<div class="setting-row"><span style="color:${COLORS[p]}">●</span> PILOTA ${p+1}<button class="key-button" data-action="rebind" data-player="${p}">${input.listening===p?'PREMI UN TASTO…':html(key)}</button><label>GAMEPAD <select data-pad="${p}"><option value="-1">Nessuno</option>${Array.from({length:4},(_,i)=>`<option value="${i}" ${input.gamepads[p]===i?'selected':''}>${i+1}</option>`).join('')}</select></label></div>`).join('')}</div>
      <p class="setup-advice">GAMEPAD: grilletto destro, pulsante principale o stick sinistro verso l'alto. Il multiplayer è locale, senza server.</p><div class="panel-actions">${button('← MENU','menu','','btn primary')}</div></div>`;
  } else if(screen==='editor'&&edit){
    screenEl.innerHTML=`<div class="editor-top"><div class="editor-panel"><span class="eyebrow">TRACK BUILDER</span><h3>${html(edit.data.name)}</h3><div class="tool-row">${(['move','add','remove'] as Tool[]).map(t=>button(t==='move'?'✋ MUOVI':t==='add'?'+ PUNTO':'− PUNTO',`tool-${t}`,'',edit!.tool===t?'mini active':'mini')).join('')}</div>
    <div class="tool-row">${button('↶ UNDO','undo','','mini')}${button('↷ REDO','redo','','mini')}${button('⊞ CENTRA','fit','','mini')}</div>
    <div class="field editor-lanes"><label for="editor-lanes">NUMERO CORSIE</label><select id="editor-lanes">${[2,3,4].map(n=>`<option value="${n}" ${edit!.data.lanes===n?'selected':''}>${n} corsie</option>`).join('')}</select></div>
    <div class="geometry-status ${edit.geometry.valid?'valid':'invalid'}">${edit.geometry.valid?'✓ PISTA VALIDA':'⚠ '+html(edit.geometry.reason)}</div>
    <div class="tool-row">${button('SALVA','save-track','','mini primary')}${button('EXPORT JSON','export-track','','mini')}${button('IMPORT','import-track','','mini')}</div>
    <div class="tool-row">${button('TEST PISTA →','test-track',edit.geometry.valid?'':'disabled','mini accent-btn')}${button('← MENU','menu','','mini')}</div>
    </div></div><div class="editor-help">TOCCA E TRASCINA I PUNTI &nbsp;·&nbsp; ROTELLA / PINCH PER ZOOM &nbsp;·&nbsp; TRASCINA VUOTO PER PAN</div>`;
    canvas.style.pointerEvents='auto';
  } else if(screen==='race'||screen==='results'){
    screenEl.innerHTML=screen==='race'?'':resultsHtml();
    hud.classList.remove('hidden');touchEl.classList.toggle('hidden',screen==='results');
  }
}
function resultsHtml():string{
  if(!race)return '';
  return `<div class="panel results-panel"><span class="eyebrow">RACE CONTROL</span><h2>🏆 TRAGUARDO</h2><p>Tempo totale: <b>${formatTime(race.clock)}</b></p><div class="results-list">${race.standings().map((c,i)=>`<div><strong style="color:${c.color}">${i+1}°</strong><span>${html(c.name)}</span><span>Best ${formatTime(c.bestLap)}</span></div>`).join('')}</div><div class="panel-actions">${button('MENU','menu','','btn subtle')}${button('RIVINCITA ↻','retry','','btn primary')}</div></div>`;
}
function openEditor(track:TrackData):void{
  cleanup();screen='editor';current=buildTrack(track);
  edit=new TrackEditor(canvas,track);
  edit.onChange=()=>{current=edit!.geometry;const status=screenEl.querySelector('.geometry-status');if(status){status.textContent=current.valid?'✓ PISTA VALIDA':'⚠ '+current.reason;status.className='geometry-status '+(current.valid?'valid':'invalid');}
    const btn=screenEl.querySelector('[data-action="test-track"]') as HTMLButtonElement|null;if(btn)btn.disabled=!current.valid;};
  canvas.style.pointerEvents='auto';renderScreen();
}
function startRace(trackData?:TrackData):void{
  const d=trackData||byId(selectedTrackId),g=buildTrack(d);
  if(!g.valid){notice('La pista non è valida: '+g.reason);return;}
  cleanup();current=g;
  playerCount=mode==='time'?1:Math.min(playerCount,g.data.lanes);
  race=new RaceManager({mode,playerCount,names:playerNames.slice(),laps,track:g});
  screen='race';canvas.style.pointerEvents='none';
  touch=new TouchControls(touchEl,input,playerCount,playerNames);
  renderScreen();updateHud();accumulator=0;hudTimer=0;
  if(window.matchMedia('(pointer: coarse)').matches&&renderer.width<640&&playerCount>2)notice('Per 3–4 giocatori usa un tablet o uno schermo più grande.');
  void audio.activate().catch(()=>{});
}
function updateHud():void{
  const r=race; if(!r)return;
  const paused=r.state==='paused',countdown=r.state==='countdown';
  const standings=r.standings();
  hud.innerHTML=`<div class="race-hud-top"><div class="race-meta"><span class="eyebrow">${r.config.mode==='quick'?'GARA RAPIDA':'TIME ATTACK'}</span><b>${html(r.config.track.data.name)}</b><small>${formatTime(r.clock)} · ${r.config.mode==='time'?'GIRI LIBERI':r.config.laps+' GIRI'}</small></div>
  <div class="race-buttons">${button('Ⅱ','pause','','hud-button')}${button('↻','restart','','hud-button')}${button('×','menu','','hud-button')}</div></div>
  <div class="race-board">${standings.map((c,i)=>`<div class="race-driver" style="--driver-color:${c.color}"><strong>${i+1}</strong><span class="driver-name">${html(c.name)}</span><span class="lap-num">${r.config.mode==='quick'?Math.min(c.completedLaps+1,r.config.laps)+'/'+r.config.laps:c.completedLaps+' GIRI'}</span><span class="best-lap">BEST ${formatTime(c.bestLap)}</span><span class="speed-readout">${Math.round(c.speed*3.6)} km/h</span><span class="driver-state">${c.derailed?'⟲ RECUPERO':c.finished?'✓ FINITO':''}</span></div>`).join('')}</div>
  ${countdown?`<div class="countdown-overlay"><div class="countdown-traffic"><i class="${r.countdown<3.1?'on':''}"></i><i class="${r.countdown<2.1?'on':''}"></i><i class="${r.countdown<1.1?'on':''}"></i></div><strong>${Math.min(3,Math.ceil(r.countdown))}</strong><small>PREPARATI</small></div>`:''}
  ${paused?`<div class="pause-overlay"><h2>IN PAUSA</h2>${button('RIPRENDI ▶','resume','','btn primary')}${button('MENU','menu','','btn')}</div>`:''}`;
}
function exportJson(d:TrackData):void{
  const file=new Blob([JSON.stringify(d,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(file),a=document.createElement('a');a.href=url;a.download=(d.name.toLowerCase().replace(/[^a-z0-9]+/g,'-')||'pista')+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function openImport():void{
  const file=document.createElement('input');file.type='file';file.accept='.json,application/json';
  file.onchange=async()=>{const f=file.files?.[0];if(!f)return;
    try{if(f.size>100_000)throw new Error('File troppo grande.');const d=importTrack(JSON.parse(await f.text()) as unknown);putTrack(d);selectedTrackId=d.id;openEditor(d);notice('Pista importata e salvata!');}
    catch(e){notice((e as Error).message||'Impossibile importare la pista.');}};
  file.click();
}
function action(name:string,el:HTMLElement):void{
  switch(name){
    case 'quick':mode='quick';setScreen('setup');break;
    case 'time':mode='time';setScreen('setup');break;
    case 'menu':setScreen('menu');current=buildTrack(byId(selectedTrackId));break;
    case 'tracks':setScreen('tracks');break;
    case 'settings':setScreen('settings');break;
    case 'editor':openEditor(byId(selectedTrackId));break;
    case 'start-race':startRace();break;
    case 'new-track':openEditor({...copyTrack(PRESETS[0]),id:'new',name:'Nuova pista',lanes:2,created:Date.now()});break;
    case 'choose-track':selectedTrackId=el.dataset.id!;current=buildTrack(byId(selectedTrackId));mode='quick';setScreen('setup');break;
    case 'edit-track':selectedTrackId=el.dataset.id!;openEditor(byId(selectedTrackId));break;
    case 'delete-track':if(confirm('Eliminare definitivamente questa pista?')){deleteTrack(el.dataset.id!);setScreen('tracks');}break;
    case 'rename-track':{
      const d=byId(el.dataset.id!),name=prompt('Nuovo nome della pista:',d.name)?.trim();
      if(name){d.name=name.slice(0,48);putTrack(d);setScreen('tracks');}break;}
    case 'undo':edit?.undo();break;
    case 'redo':edit?.redo();break;
    case 'fit':edit?.fit();break;
    case 'tool-move':case 'tool-add':case 'tool-remove':edit?.setTool(name.slice(5) as Tool);renderScreen();break;
    case 'save-track':{
      if(!edit)return;
      if(!edit.geometry.valid){notice('Prima correggi la pista: '+edit.geometry.reason);return;}
      const title=prompt('Nome del circuito:',edit.data.name)?.trim();if(!title)return;
      edit.data.name=title.slice(0,48);
      if(!edit.data.id.startsWith('custom-'))edit.data.id=`custom-${Date.now()}`;
      edit.data.created=Date.now();putTrack(edit.data);selectedTrackId=edit.data.id;notice('Pista salvata sul dispositivo!');renderScreen();break;}
    case 'export-track':if(edit)exportJson(edit.data);break;
    case 'import-track':openImport();break;
    case 'test-track':if(edit?.geometry.valid){const d=copyTrack(edit.data);mode='time';startRace(d);}else notice('La pista non è ancora valida.');break;
    case 'pause':race?.togglePause();updateHud();break;
    case 'resume':race?.togglePause();updateHud();break;
    case 'restart':case 'retry':if(race)startRace(race.config.track.data);break;
    case 'rebind':input.listening=Number(el.dataset.player);input.onRebind=()=>renderScreen();renderScreen();break;
  }
}
app.addEventListener('click',e=>{
  const el=(e.target as HTMLElement).closest<HTMLElement>('[data-action]');if(el&&!el.hasAttribute('disabled'))action(el.dataset.action!,el);
});
hud.addEventListener('pointerdown',e=>{
  const el=(e.target as HTMLElement).closest<HTMLElement>('[data-action]');
  if(el&&!el.hasAttribute('disabled')){e.preventDefault();e.stopPropagation();action(el.dataset.action!,el);}
});
app.addEventListener('change',e=>{
  const el=e.target as HTMLInputElement|HTMLSelectElement;
  if(el.id==='track-choice'){selectedTrackId=el.value;current=buildTrack(byId(selectedTrackId));renderScreen();}
  else if(el.id==='player-choice'){playerCount=Number(el.value);renderScreen();}
  else if(el.id==='laps-choice')laps=Number(el.value);
  else if(el.id==='editor-lanes')edit?.setLaneCount(Number(el.value));
  else if(el.dataset.pad!==undefined)input.assignPad(Number(el.dataset.pad),Number(el.value));
});
app.addEventListener('input',e=>{
  const el=e.target as HTMLInputElement;if(el.dataset.name!==undefined)playerNames[Number(el.dataset.name)]=el.value;
});
document.getElementById('sound-toggle')!.addEventListener('click',()=>{audio.enabled=!audio.enabled;document.getElementById('sound-toggle')!.textContent=audio.enabled?'♫':'♪̸';if(audio.enabled)void audio.activate().catch(()=>{});notice(audio.enabled?'Audio attivato':'Audio disattivato');});
window.addEventListener('keydown',e=>{if(e.code==='Escape'&&screen==='race'&&race){race.togglePause();updateHud();}});
const ro=new ResizeObserver(()=>{renderer.resize();if(edit)edit.fit();});ro.observe(stage);
function handleRaceEvents():void{
  if(!race)return;
  while(race.events.length){const event=race.events.shift()!;
    if(event.kind==='beep')audio.beep(410,.08);
    if(event.kind==='start')audio.beep(720,.24);
    if(event.kind==='derail')audio.beep(105,.25,'sawtooth');
    if(event.kind==='finish')audio.beep(920,.24);
    if(event.kind==='lap'&&race.config.mode==='time'&&event.player!==undefined){
      const best=race.cars[event.player].bestLap;
      if(best!==null&&saveBest(race.config.track.data.id,best))notice('Nuovo record personale! '+formatTime(best));
    }
  }
  if(race.state==='finished'&&screen==='race'){screen='results';touch?.dispose();audio.stop();renderScreen();}
}
function gameView(t:TrackGeometry){
  const touchVisible=window.matchMedia('(pointer: coarse)').matches;
  const top=renderer.height<510?76:153;
  const bottom=touchVisible?(renderer.height<510?92:Math.min(182,renderer.height*.29)):10;
  const h=Math.max(120,renderer.height-top-bottom);
  const v=fitView(t,renderer.width,h,Math.max(12,Math.min(32,h*.08)));
  v.offsetY+=top;
  return v;
}
function frame(now:number):void{
  const frameTime=Math.min(.12,Math.max(0,(now-last)/1000));last=now;
  if(screen==='race'&&race){
    if(race.state==='running'||race.state==='countdown'){
      accumulator=Math.min(.14,accumulator+frameTime);
      while(accumulator>=FIXED){race.update(FIXED,race.cars.map(c=>input.read(c.player)));accumulator-=FIXED;}
    }else accumulator=0;
    handleRaceEvents();audio.update(race.cars);
    hudTimer+=frameTime;if(hudTimer>.12){updateHud();hudTimer=0;}
  }
  const t=edit?.geometry||current;
  const fit=edit?edit.view:(screen==='race'||screen==='results'?gameView(t):fitView(t,renderer.width,renderer.height,65));
  renderer.render(t,fit,race?.cars||[],Math.min(1,accumulator/FIXED),edit?{selected:edit.selected,hover:edit.hover}:undefined);
  requestAnimationFrame(frame);
}
// Set a visible offline-safe menu before the first animation frame.
renderScreen();requestAnimationFrame(frame);
// Service-worker versioning: new deployments replace old cache; old caches cleared at activate.
if('serviceWorker'in navigator)window.addEventListener('load',()=>{
  navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`,{scope:import.meta.env.BASE_URL}).catch(()=>{});
});
