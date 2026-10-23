// Honor for GP — 画面：スリット写真・水面とボートの描画・HUD
function slitCreate(label){return {label,frames:[],boats:[],archived:false};}
function slitCapture(rec,t,rows){
  if(!rec || rec.archived || t < -2.2 || t > 1.6)return;
  const prev=rec.frames[rec.frames.length-1];
  if(prev && t<=prev.t)return;
  rec.frames.push({t,boats:rows.map(r=>({no:r.no,course:r.trait?r.trait.course:r.no,x:r.b.x,y:r.b.y,a:r.b.a,v:r.b.v,cap:r.b.cap||0}))});
}
function slitArchive(rec,rows,result){
  if(!rec || rec.archived || !rec.frames.length)return;
  // A start-signal photo requires actual samples on BOTH sides of zero.
  if(rec.frames[0].t>0 || rec.frames[rec.frames.length-1].t<0)return;
  rec.archived=true;rec.id=++slitSerial;rec.result=result;
  const first=rec.frames[0];
  rec.boats=rows.map(r=>({no:r.no,course:(first.boats.find(b=>b.no===r.no)||{}).course||r.no,st:r.st==null?null:r.st}));
  slitHistory.unshift(rec);if(slitHistory.length>5)slitHistory.pop();
  $('slitBtn').disabled=false;$('slitBtn').title='直近5走のスタート判定を見る';
}
function slitFrameAt(rec,t){
  const frames=rec.frames;t=clamp(t,frames[0].t,frames[frames.length-1].t);
  const hi=frames.findIndex(f=>f.t>=t);
  const b=frames[hi<0?frames.length-1:hi],a=frames[Math.max(0,hi-1)];
  const u=b.t===a.t?0:(t-a.t)/(b.t-a.t);
  return {t,boats:a.boats.map(p=>{const q=b.boats.find(q=>q.no===p.no)||p;return interpolatePose(p,q,u);})};
}
function slitST(r){return r.st==null?'未通過':r.st<0?'F '+(-r.st).toFixed(3):'ST '+r.st.toFixed(3);}
function slitOpen(rec){
  if(!slitHistory.length || !$('slitPhoto').hidden)return;
  slitWasPaused=paused;paused=true;keys.clear();
  for(const id of ptrs.keys())try{cv.releasePointerCapture(id);}catch(_){}
  ptrs.clear();steerTouch=false;sideOn('thr');sideOn('steer');resetVirtualPosture();hapticsStop();
  slitReturnFocus=document.activeElement;
  const sel=$('slitRace');sel.textContent='';
  for(const r of slitHistory){const opt=document.createElement('option');opt.value=String(r.id);opt.textContent=`第${r.id}走 · ${r.label}`;sel.appendChild(opt);}
  sel.value=String((rec && slitHistory.includes(rec)?rec:slitHistory[0]).id);
  $('slitPhoto').hidden=false;slitChoose();$('slitClose').focus();
}
function slitChoose(){
  slitSelected=slitHistory.find(r=>r.id===Number($('slitRace').value))||slitHistory[0];
  if(!slitSelected)return;
  $('slitSeek').min=String(Math.ceil(Math.max(-1,slitSelected.frames[0].t)*1000));
  $('slitSeek').max=String(Math.floor(Math.min(1.5,slitSelected.frames[slitSelected.frames.length-1].t)*1000));
  $('slitSeek').value='0';slitRender();
}
function slitRender(exactTime){
  const rec=slitSelected;if(!rec)return;
  const t=exactTime==null?Number($('slitSeek').value)/1000:exactTime;
  const frame=slitFrameAt(rec,t),g=$('slitCanvas').getContext('2d');
  rec.viewTime=frame.t;
  const when=`合図 ${frame.t>=0?'+':''}${frame.t.toFixed(3)}秒`;
  $('slitTime').textContent=when;
  $('slitSummary').textContent=rec.boats.map(r=>`${r.no}号艇（${r.course}コース） ${slitST(r)}`).join(' ／ ');
  $('slitCanvas').setAttribute('aria-label',when+'。'+$('slitSummary').textContent);
  if(slitCam){slitRenderCam(rec,frame,g,when);return;}
  g.clearRect(0,0,1000,700);g.fillStyle='#0b1c29';g.fillRect(0,0,1000,700);
  g.textAlign='left';g.font='bold 26px sans-serif';g.fillStyle='#e9f6fa';g.fillText(`SLIT PHOTO  /  第${rec.id}走`,32,40);
  g.font='18px sans-serif';g.fillStyle='#99b6c6';g.fillText(rec.label+' · ゲーム内判定画像',32,69);
  g.textAlign='right';g.font='bold 25px monospace';g.fillStyle=Math.abs(frame.t)<.00001?'#64eac1':'#e9f6fa';g.fillText(when,968,44);
  // Fixed view across all frames; include even unusually displaced boats.
  const positions=rec.frames.flatMap(f=>f.boats);
  const minX=Math.min(-35,...positions.map(b=>b.x-5)),maxX=Math.max(35,...positions.map(b=>b.x+5));
  const minY=Math.min(0,...positions.map(b=>b.y-4)),maxY=Math.max(50,...positions.map(b=>b.y+4));
  const scale=Math.min(928/(maxX-minX),420/(maxY-minY));
  const sx=x=>500+(x-(minX+maxX)/2)*scale,sy=y=>326+(y-(minY+maxY)/2)*scale;
  g.save();g.beginPath();g.rect(32,94,936,458);g.clip();
  const water=g.createLinearGradient(0,94,0,552);water.addColorStop(0,'#164858');water.addColorStop(1,'#0d2c41');g.fillStyle=water;g.fillRect(32,94,936,458);
  for(let x=Math.ceil(minX/10)*10;x<=maxX;x+=10){g.strokeStyle='rgba(170,220,230,.16)';g.lineWidth=1;g.beginPath();g.moveTo(sx(x),94);g.lineTo(sx(x),552);g.stroke();g.textAlign='center';g.font='13px sans-serif';g.fillStyle='#8badbe';g.fillText((x>0?'+':'')+x+'m',sx(x),543);}
  g.strokeStyle='#64eac1';g.lineWidth=2;g.beginPath();g.moveTo(sx(0),94);g.lineTo(sx(0),552);g.stroke();
  g.textAlign='left';g.font='bold 16px sans-serif';g.fillStyle='#89ffda';g.fillText('START',sx(0)+7,115);
  g.textAlign='right';g.fillStyle='#a3c8d8';g.fillText('進行方向 →',950,115);
  // 航跡: where each boat ran over the last second — its length is the speed (1 s at 80 km/h ≈ 22 m)
  for(const b of frame.boats){
    const path=rec.frames.filter(f=>f.t<=frame.t&&f.t>=frame.t-1).map(f=>f.boats.find(q=>q.no===b.no)).filter(Boolean);
    if(path.length<2)continue;
    const aft=p=>({x:p.x-2.1*Math.cos(p.a),y:p.y-2.1*Math.sin(p.a)}),pts=[...path.map(aft),aft(b)];
    for(const [w,c] of [[9,'rgba(2,30,40,.35)'],[5,'rgba(190,240,232,.35)'],[1.8,'rgba(255,255,255,.75)']]){
      g.lineWidth=w;g.strokeStyle=c;g.lineCap='round';g.beginPath();pts.forEach((p,i)=>i?g.lineTo(sx(p.x),sy(p.y)):g.moveTo(sx(p.x),sy(p.y)));g.stroke();
    }
  }
  for(const b of frame.boats){
    const col=LANE_COL[b.no-1]||LANE_COL[0],r=rec.boats.find(r=>r.no===b.no);
    const x=sx(b.x),y=sy(b.y);
    g.save();g.translate(x,y);g.rotate(b.a);g.scale(scale,scale);
    g.drawImage(boatSprite({hull:col[0],num:col[1],label:String(b.no),helmet:col[0]},b.cap>0),-2.65,-1.1,5.3,2.2);g.restore();
    g.beginPath();g.arc(sx(boatBow(b).x),sy(boatBow(b).y),3.2,0,Math.PI*2);g.fillStyle='#fff';g.fill();g.lineWidth=1.5;g.strokeStyle='#071824';g.stroke();
    g.textAlign='center';g.font='bold 15px sans-serif';g.fillStyle=r&&r.st<0?'#ffb0a6':'#fff';g.fillText(`${b.no}号艇${b.v!=null?'  '+Math.round(b.v*3.6)+'km/h':''}`,x,y-14);
  }
  g.restore();
  for(let i=0;i<rec.boats.length;i++){
    const r=rec.boats[i],x=32+i*(936/rec.boats.length),w=936/rec.boats.length-6,col=LANE_COL[r.no-1]||LANE_COL[0];
    g.fillStyle='#152f40';g.fillRect(x,568,w,78);g.fillStyle=col[0];g.fillRect(x,568,5,78);
    g.textAlign='left';g.font='bold 16px sans-serif';g.fillStyle='#dcecf3';g.fillText(`${r.no}号艇 · ${r.course}コース`,x+12,593);
    g.font='bold 21px monospace';g.fillStyle=r.st!=null&&r.st<0?'#ff9b8e':'#70e8c3';g.fillText(slitST(r),x+12,627);
  }
  g.font='15px sans-serif';g.textAlign='left';g.fillStyle='#91adbf';g.fillText('白点＝舳先の判定点  /  ST・F＝ゲーム判定値  /  記録コマ間は補間表示',32,678);
}
// スリットカメラ: like the real slit photograph, a line camera on the start line — the picture's horizontal axis is
// TIME (later to the left), so a boat shows up as long as it takes to pass the line: fast boats short, slow boats long.
// The 合図 (0.00) line marks the signal; a bow right of it is a フライング, the distance left of it is the ST.
function slitCrossing(rec,no,off){
  // time the point `off` m along the hull (2.25 = bow, -2.04 = stern) crosses x=0, interpolated between frames
  const P=f=>{const b=f.boats.find(q=>q.no===no);return b&&{x:b.x+off*Math.cos(b.a),v:b.v,y:b.y};};
  for(let i=1;i<rec.frames.length;i++){
    const a=P(rec.frames[i-1]),c=P(rec.frames[i]);
    if(a&&c&&a.x<0&&c.x>=0){const u=-a.x/(c.x-a.x);return{t:rec.frames[i-1].t+(rec.frames[i].t-rec.frames[i-1].t)*u,v:a.v+(c.v-a.v)*u,y:a.y+(c.y-a.y)*u};}
  }
  return null;
}
function slitRenderCam(rec,frame,g,when){
  g.clearRect(0,0,1000,700);g.fillStyle='#0b1c29';g.fillRect(0,0,1000,700);
  g.textAlign='left';g.font='bold 26px sans-serif';g.fillStyle='#e9f6fa';g.fillText(`SLIT CAMERA  /  第${rec.id}走`,32,40);
  g.font='18px sans-serif';g.fillStyle='#99b6c6';g.fillText(rec.label+' · スタートライン上の定点撮影（横軸は時間）',32,69);
  const t0=-0.35,t1=1.25,X0=968,K=936/(t1-t0),tx=t=>X0-(t-t0)*K;
  const ys=frame.boats.map(b=>b.y),minY=Math.min(0,...ys)-3,maxY=Math.max(50,...ys)+3,sy=y=>110+(y-minY)/(maxY-minY)*430;
  g.save();g.beginPath();g.rect(32,94,936,458);g.clip();
  const water=g.createLinearGradient(0,94,0,552);water.addColorStop(0,'#164858');water.addColorStop(1,'#0d2c41');g.fillStyle=water;g.fillRect(32,94,936,458);
  for(let t=Math.ceil(t0*10)/10;t<=t1;t+=0.1){const x=tx(t);g.strokeStyle=Math.abs(t)<1e-6?'#64eac1':'rgba(170,220,230,.16)';g.lineWidth=Math.abs(t)<1e-6?2:1;g.beginPath();g.moveTo(x,94);g.lineTo(x,552);g.stroke();
    g.textAlign='center';g.font='13px sans-serif';g.fillStyle='#8badbe';g.fillText((t<0?'F':'')+(Math.abs(t)<1e-6?'0.00':Math.abs(t).toFixed(1)),x,543);}
  g.textAlign='left';g.font='bold 16px sans-serif';g.fillStyle='#89ffda';g.fillText('合図',tx(0)+6,115);
  g.textAlign='left';g.fillStyle='#a3c8d8';g.fillText('← 遅れて通過',40,115);
  // cursor at the selected time
  g.strokeStyle='rgba(255,207,117,.7)';g.setLineDash([6,5]);g.beginPath();g.moveTo(tx(frame.t),94);g.lineTo(tx(frame.t),552);g.stroke();g.setLineDash([]);
  const rows=[];
  for(const r of rec.boats){
    const bow=slitCrossing(rec,r.no,BOW_TIP);if(!bow)continue;
    const st=slitCrossing(rec,r.no,-2.04),v=Math.max(0.5,bow.v),tEnd=st?st.t:bow.t+4.29/v;
    rows.push({r,bow,tEnd,v});
  }
  for(const q of rows){
    const col=LANE_COL[q.r.no-1]||LANE_COL[0],x1=tx(q.bow.t),x2=tx(q.tEnd),y=sy(q.bow.y),h=(2.2/(maxY-minY))*430;
    // wake: churned water passing the line after the stern, fading
    const wl=Math.min(220,0.45*K),wg=g.createLinearGradient(x2,0,x2-wl,0);wg.addColorStop(0,'rgba(240,255,250,.75)');wg.addColorStop(1,'rgba(240,255,250,0)');
    g.fillStyle=wg;g.fillRect(x2-wl,y-h*0.32,wl,h*0.64);
    g.save();g.translate((x1+x2)/2,y);g.drawImage(boatSprite({hull:col[0],num:col[1],label:String(q.r.no),helmet:col[0]},false),-(x1-x2)/2,-h/2,x1-x2,h);g.restore();
    g.beginPath();g.arc(x1,y,3.2,0,Math.PI*2);g.fillStyle='#fff';g.fill();
    g.textAlign='left';g.font='bold 15px sans-serif';g.fillStyle=q.r.st!=null&&q.r.st<0?'#ffb0a6':'#fff';
    g.fillText(`${q.r.no}号艇 ${Math.round(q.v*3.6)}km/h`,x1+8,y-h/2-2);
  }
  g.restore();
  for(let i=0;i<rec.boats.length;i++){
    const r=rec.boats[i],x=32+i*(936/rec.boats.length),w=936/rec.boats.length-6,col=LANE_COL[r.no-1]||LANE_COL[0],q=rows.find(q=>q.r===r);
    g.fillStyle='#152f40';g.fillRect(x,568,w,78);g.fillStyle=col[0];g.fillRect(x,568,5,78);
    g.textAlign='left';g.font='bold 16px sans-serif';g.fillStyle='#dcecf3';g.fillText(`${r.no}号艇 · ${r.course}コース`,x+12,593);
    g.font='bold 21px monospace';g.fillStyle=r.st!=null&&r.st<0?'#ff9b8e':'#70e8c3';g.fillText(slitST(r),x+12,627);
    if(q){g.font='13px sans-serif';g.fillStyle='#9fc0cf';g.fillText(`${Math.round(q.v*3.6)}km/h`,x+12,643);}
  }
  g.font='15px sans-serif';g.textAlign='left';g.fillStyle='#91adbf';g.fillText('横軸＝時間（右ほど早く通過）／速い艇ほど短く、遅い艇ほど長く写る／破線＝選択中の時刻',32,678);
}
function slitMove(dir){
  if(!slitSelected)return;const t=slitSelected.viewTime||0;
  const frames=slitSelected.frames.filter(f=>f.t>=Number($('slitSeek').min)/1000&&f.t<=Number($('slitSeek').max)/1000);
  const f=dir>0?frames.find(f=>f.t>t+.000001):frames.slice().reverse().find(f=>f.t<t-.000001);
  if(f){$('slitSeek').value=String(Math.round(f.t*1000));slitRender(f.t);}
}
function finishP6() {
  fleet.p6Done = true;
  slitArchive(fleet.slit, fleet.boats, 'スタート練習');
  const me = playerRow();
  if (me) toast('スタート練習', `${me.no}号艇 ${me.trait.course}コース ${me.st == null ? '未通過' : me.st < 0 ? 'F' + fmtST(-me.st) : 'ST ' + fmtST(me.st)}`, me.st != null && me.st >= 0 && me.st <= 0.15 ? 'good' : 'info');
  paused = true;
  setTimeout(() => slitOpen(fleet && fleet.slit), 600);
}
function quitFleet() {
  if (runLog) runLogEnd('途中で終了'); fleet = null; waterEnv = null; input.thr = input.steer = input.roll = input.pitch = 0; $('order').hidden = true; refreshFleetUi(); }
function slitClose(){
  $('slitPhoto').hidden=true;paused=slitWasPaused;keys.clear();last=performance.now();
  // 6艇スタート練習 ends with the photograph: back to the practice menu
  if (fleet && fleet.p6Done) { quitFleet(); soloRestart(); paused = true; $('pmenu').hidden = false; }
  if(slitReturnFocus && slitReturnFocus.focus)slitReturnFocus.focus();
}
$('slitBtn').addEventListener('click',()=>slitOpen());
$('logBtn').addEventListener('click', logOpen);
$('slitLog').addEventListener('click', () => { $('slitPhoto').hidden = true; paused = slitWasPaused; logOpen(); });
$('logSel').addEventListener('change', e => { const L = runLogs[+e.target.value]; if (L) $('logText').value = L.text; $('logMsg').textContent = ''; });
$('logClose').addEventListener('click', () => { $('logView').hidden = true; paused = logWasPaused; last = performance.now(); });
$('logCopy').addEventListener('click', async () => {
  const t = $('logText'); let ok = false;
  try { await navigator.clipboard.writeText(t.value); ok = true; } catch (e) {}
  if (!ok) { try { t.focus(); t.select(); ok = document.execCommand('copy'); } catch (e) {} }
  $('logMsg').textContent = ok ? 'コピーしました' : '全選択して手動でコピーしてください';
});
$('measSlit').addEventListener('click',()=>slitOpen(practiceSlit));
$('slitClose').addEventListener('click',slitClose);
$('slitRace').addEventListener('change',slitChoose);
$('slitSeek').addEventListener('input',()=>slitRender());
$('slitPrev').addEventListener('click',()=>slitMove(-1));$('slitNext').addEventListener('click',()=>slitMove(1));
$('slitZero').addEventListener('click',()=>{$('slitSeek').value='0';slitRender();});
$('slitMode').addEventListener('click',()=>{slitCam=!slitCam;$('slitMode').textContent=slitCam?'俯瞰で見る':'スリットカメラで見る';$('slitMode').setAttribute('aria-pressed',String(slitCam));slitRender();});
$('slitSave').addEventListener('click',()=>{
  if(!slitSelected)return;
  const a=document.createElement('a');a.download=`d42-slit-${slitSelected.id}-${Math.round(slitSelected.viewTime*1000)}ms.png`;a.href=$('slitCanvas').toDataURL('image/png');a.click();
});
$('slitPhoto').addEventListener('keydown',e=>{
  if(e.key==='Escape'){e.preventDefault();slitClose();}
  if(e.key==='Tab'){
    const nodes=Array.from($('slitPhoto').querySelectorAll('button,select,input')).filter(n=>!n.disabled);
    const first=nodes[0],last=nodes[nodes.length-1];
    if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
  }
});

/* ---------- drawing ---------- */
const hash = (i, j) => { const h = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return h - Math.floor(h); };

// Cached deck artwork avoids rebuilding hull gradients for every boat every frame.
const boatSprites = new Map();
function boatSprite(sty, overturned) {
  const key = [sty.hull, sty.num, sty.label, overturned].join('|');
  if (boatSprites.has(key)) return boatSprites.get(key);
  const cvb = document.createElement('canvas'); cvb.width = 424; cvb.height = 176;
  const c = cvb.getContext('2d'); c.scale(80, 80); c.translate(2.65, 1.1);
  const outline = () => {
    c.beginPath(); c.moveTo(BOW_TIP, 0); c.bezierCurveTo(1.94, -.3, 1.49, -.71, 1.05, -.83);
    c.lineTo(-1.94, -.83); c.quadraticCurveTo(-2.04, -.81, -2.04, -.67);
    c.lineTo(-2.04, .67); c.quadraticCurveTo(-2.04, .81, -1.94, .83);
    c.lineTo(1.05, .83); c.bezierCurveTo(1.49, .71, 1.94, .3, BOW_TIP, 0); c.closePath();
  };
  outline(); c.fillStyle = overturned ? '#65747b' : '#d0ba86'; c.fill();
  c.save(); c.clip();
  const g = c.createLinearGradient(0, -.85, 0, .85);
  g.addColorStop(0, '#fff2d0'); g.addColorStop(.19, '#d8c397'); g.addColorStop(.55, '#b5a078'); g.addColorStop(1, '#716552');
  c.fillStyle = g; c.fillRect(-2.1, -.9, 4.5, 1.8);
  // Natural plywood seams under a lacquered deck.
  c.strokeStyle = 'rgba(82,59,33,.13)'; c.lineWidth = .015;
  for (let i = 0; i < 10; i++) { const y = -.75 + i * .16; c.beginPath(); c.moveTo(-2, y); c.bezierCurveTo(-.3, y + .05, .3, y - .03, 2.2, y); c.stroke(); }
  c.fillStyle = overturned ? '#43545e' : sty.hull;
  c.beginPath(); c.moveTo(2.21, 0); c.lineTo(.92, -.65); c.lineTo(-.1, -.65); c.lineTo(.05, .65); c.lineTo(.92, .65); c.closePath(); c.fill();
  const gloss = c.createLinearGradient(0, -.8, 0, .8);
  gloss.addColorStop(0, 'rgba(255,255,255,.48)'); gloss.addColorStop(.43, 'rgba(255,255,255,.06)'); gloss.addColorStop(1, 'rgba(0,15,27,.38)');
  c.fillStyle = gloss; c.fillRect(-2.1, -.85, 4.4, 1.7);
  c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = .045;
  c.beginPath(); c.moveTo(2.13, 0); c.lineTo(.89, -.57); c.lineTo(.12, -.57); c.stroke();
  // Recessed cockpit and aft transom.
  c.fillStyle = '#58616a'; c.fillRect(-1.65, -.59, 1.43, 1.18);
  const cockpit = c.createLinearGradient(0, -.53, 0, .53);
  cockpit.addColorStop(0, '#071c28'); cockpit.addColorStop(1, '#344650');
  c.fillStyle = cockpit; c.fillRect(-1.59, -.53, 1.3, 1.06);
  c.strokeStyle = '#b6b4a6'; c.lineWidth = .055; c.strokeRect(-1.65, -.59, 1.43, 1.18);
  c.fillStyle = '#89795f'; c.fillRect(-1.95, -.75, .17, 1.5);
  for (const y of [-.7, .7]) { c.fillStyle = '#e8e2cb'; c.beginPath(); c.arc(-1.84, y, .04, 0, Math.PI * 2); c.fill(); }
  c.restore();
  outline(); c.strokeStyle = '#122d38'; c.lineWidth = .075; c.stroke();
  c.strokeStyle = 'rgba(255,255,255,.72)'; c.lineWidth = .025;
  c.beginPath(); c.moveTo(-1.96, -.78); c.lineTo(1.02, -.78); c.lineTo(2.15, -.04); c.stroke();
  // Outboard cowling, bracket and metal trim.
  c.fillStyle = '#a3adb0'; c.fillRect(-2.2, -.19, .3, .38);
  const motor = c.createLinearGradient(0, -.34, 0, .34);
  motor.addColorStop(0, '#849198'); motor.addColorStop(.3, '#384953'); motor.addColorStop(1, '#0c1c27');
  c.fillStyle = motor; c.beginPath(); c.roundRect(-2.54, -.34, .48, .68, .09); c.fill();
  c.strokeStyle = '#bdc9ca'; c.lineWidth = .03; c.stroke();
  c.fillStyle = '#bcc8c9'; c.fillRect(-2.43, -.25, .23, .055);
  c.strokeStyle = '#101f29'; c.lineWidth = .03;
  for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(-2.42, .04 + i * .055); c.lineTo(-2.15, .04 + i * .055); c.stroke(); }
  if (!overturned) {
    c.save(); c.translate(.89, 0); c.rotate(Math.PI / 2);
    c.fillStyle = sty.num; c.beginPath(); c.roundRect(-.37, -.37, .74, .74, .075); c.fill();
    c.fillStyle = sty.hull; c.font = 'bold .62px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(sty.label, 0, .035); c.restore();
  } else { c.strokeStyle = '#a9b3b4'; c.lineWidth = .09; c.beginPath(); c.moveTo(-1.8, 0); c.lineTo(1.75, 0); c.stroke(); }
  boatSprites.set(key, cvb); return cvb;
}

function drawWaterSurface(S, cw, ch) {
  ctx.save(); ctx.beginPath(); ctx.rect(COURSE.xMin, COURSE.yMin, cw, ch); ctx.clip();
  const water = ctx.createLinearGradient(0, COURSE.yMin, 0, COURSE.yMax);
  water.addColorStop(0, '#245d65'); water.addColorStop(.27, '#28747b');
  water.addColorStop(.66, '#185b69'); water.addColorStop(1, '#103b4c');
  ctx.fillStyle = water; ctx.fillRect(COURSE.xMin, COURSE.yMin, cw, ch);
  const vw = W / S, vh = H / S;
  const minX = Math.max(COURSE.xMin, cam.x - vw / 2 - 7), maxX = Math.min(COURSE.xMax, cam.x + vw / 2 + 7);
  const minY = Math.max(COURSE.yMin, cam.y - vh / 2 - 7), maxY = Math.min(COURSE.yMax, cam.y + vh / 2 + 7);
  ctx.lineCap = 'round';
  // ripples: two wave scales tied to world coordinates, each built as one path per colour and stroked
  // once — a few strokes a frame instead of thousands, so phones keep a steady frame rate
  const LAYERS = [
    { cell: 8, dark: 'rgba(3,32,43,.16)', dW: .23, lite: 'rgba(186,231,222,.1)', lW: .07 },
    { cell: 5, dark: 'rgba(3,32,43,.12)', dW: .09, lite: 'rgba(186,231,222,.12)', lW: .04 },
  ];
  // with wind the ripples line up across it and drift downwind, and past ~4 m/s white caps show
  const wv = waterEnv ? Math.hypot(waterEnv.wx, waterEnv.wy) : 0, ux = wv > 0.3 ? waterEnv.wx / wv : 0, uy = wv > 0.3 ? waterEnv.wy / wv : 0;
  const px = wv > 0.3 ? -uy : 1, py = wv > 0.3 ? ux : 0;
  for (let layer = 0; layer < LAYERS.length; layer++) {
    const L = LAYERS[layer], cell = L.cell, dark = new Path2D(), lite = new Path2D();
    const drift = time * (0.4 + wv * 0.35) * (1 + layer * 0.3), ox = ux * drift, oy = uy * drift, gain = 1 + Math.min(wv, 8) * 0.12;
    for (let i = Math.floor((minX - ox) / cell); i <= Math.ceil((maxX - ox) / cell); i++) {
      for (let j = Math.floor((minY - oy) / cell); j <= Math.ceil((maxY - oy) / cell); j++) {
        const h = hash(i + layer * 100, j), h2 = hash(j + 9, i);
        const phase = time * (.55 + layer * .28) + h * 28;
        const x = i * cell + h * cell + Math.sin(phase * .32) * .12 + ox;
        const y = j * cell + h2 * cell + Math.sin(phase) * (.11 + layer * .025) + oy;
        const len = cell * (.22 + h2 * .48) * gain, wave = Math.sin(phase) * .11 * gain, hx = px * len / 2, hy = py * len / 2, wx2 = -py * wave, wy2 = px * wave;
        dark.moveTo(x - hx, y - hy + .09); dark.quadraticCurveTo(x + wx2, y + wy2 + .09, x + hx, y + hy + .09);
        lite.moveTo(x - hx, y - hy); lite.quadraticCurveTo(x + wx2, y + wy2, x + hx, y + hy);
      }
    }
    ctx.strokeStyle = L.dark; ctx.lineWidth = L.dW; ctx.stroke(dark);
    ctx.strokeStyle = L.lite; ctx.lineWidth = L.lW; ctx.stroke(lite);
  }
  // a few glints that come and go (cheap: a handful of short strokes)
  const glint = new Path2D(), cellG = 6;
  for (let i = Math.floor(minX / cellG); i <= Math.ceil(maxX / cellG); i++) for (let j = Math.floor(minY / cellG); j <= Math.ceil(maxY / cellG); j++) {
    const hh = hash(i + 300, j), h2 = hash(j + 77, i), f = Math.pow(Math.max(0, Math.sin(time * 0.9 + hh * 40)), 12);
    if (f < 0.4) continue;
    const gx = i * cellG + hh * cellG, gy = j * cellG + h2 * cellG, len = 0.6 + h2;
    glint.moveTo(gx - len / 2, gy); glint.quadraticCurveTo(gx, gy - 0.1, gx + len / 2, gy);
  }
  ctx.strokeStyle = 'rgba(214,244,236,.28)'; ctx.lineWidth = .05; ctx.stroke(glint);
  if (wv > 3.5) {   // 白波
    const caps = new Path2D(), cc = 9 - Math.min(4, (wv - 3.5)), drift = time * (0.6 + wv * 0.4), ox = ux * drift, oy = uy * drift;
    for (let i = Math.floor((minX - ox) / cc); i <= Math.ceil((maxX - ox) / cc); i++) for (let j = Math.floor((minY - oy) / cc); j <= Math.ceil((maxY - oy) / cc); j++) {
      const hh = hash(i + 511, j), f = Math.max(0, Math.sin(time * 1.3 + hh * 50));
      if (f < 0.75) continue;
      const cx = i * cc + hh * cc + ox, cy = j * cc + hash(j + 3, i) * cc + oy, len = 0.7 + hh * 0.9;
      caps.moveTo(cx - px * len / 2, cy - py * len / 2); caps.lineTo(cx + px * len / 2, cy + py * len / 2);
    }
    ctx.strokeStyle = 'rgba(240,250,248,.55)'; ctx.lineWidth = .16; ctx.stroke(caps);
  }
  ctx.restore();
  ctx.strokeStyle = 'rgba(153,207,199,.45)'; ctx.lineWidth = .35;
  ctx.strokeRect(COURSE.xMin, COURSE.yMin, cw, ch);
}

// 吹き流し on a pole: points downwind, fills out with the wind
function drawWindsock(x, y) {
  const w = waterEnv ? Math.hypot(waterEnv.wx, waterEnv.wy) : 0, a = w > 0.3 ? Math.atan2(waterEnv.wy, waterEnv.wx) : Math.PI / 2;
  const fill = clamp(w / 7, 0.15, 1), len = 2.2 + 2.6 * fill, droop = (1 - fill) * 1.2;
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = '#d8d8d8'; ctx.beginPath(); ctx.arc(0, 0, 0.35, 0, Math.PI * 2); ctx.fill();
  ctx.rotate(a + Math.sin(time * (3 + w)) * 0.08 * (1.2 - fill));
  for (let k = 0; k < 4; k++) {
    const x0 = len * k / 4, x1 = len * (k + 1) / 4, r0 = 0.75 - 0.12 * k, r1 = 0.75 - 0.12 * (k + 1), d0 = droop * (k / 4) ** 2, d1 = droop * ((k + 1) / 4) ** 2;
    ctx.fillStyle = k % 2 ? '#f4f4f4' : '#e8463c';
    ctx.beginPath(); ctx.moveTo(x0, -r0 + d0); ctx.lineTo(x1, -r1 + d1); ctx.lineTo(x1, r1 + d1); ctx.lineTo(x0, r0 + d0); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}
// 自動ズーム (PC): pull back just far enough to keep every boat still racing on screen — close in when they are
// bunched, out to the whole course when they spread. min: the closest it comes in (m across the short side).
const CAM_AUTO = { margin: 22, min: 60, ease: 2.2 };
let camMode = 'follow';
try { camMode = localStorage.getItem('honorGP.camera') || 'follow'; } catch (e) {}
if ($('camMode')) { $('camMode').value = camMode; $('camMode').addEventListener('change', e => { camMode = e.target.value; try { localStorage.setItem('honorGP.camera', camMode); } catch (x) {} }); }
function camAutoTargets() {
  if (!fleet) return [];
  const live = fleet.boats.filter(r => !r.out && r.fin == null && !(r.flying && r.passed1M));
  return (live.length ? live : fleet.boats.filter(r => !r.out)).map(r => r.b);
}
function draw() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  let S = Math.min(W, H) / (camMode === 'close' ? 20 : fleet ? 44 : 34); // px per metre
  const fr = focusRow(), vb = fr ? fr.b : B;
  const look = camMode === 'close' ? Math.min(5, 3 + vb.v * .12) : 5 + vb.v * 0.45;
  // camera follow eased by real elapsed time, so an uneven frame doesn't make the view lurch
  const nowD = performance.now(), fdt = Math.min(0.1, Math.max(0, (nowD - (draw.t || nowD)) / 1000)); draw.t = nowD;
  const k = fdt > 0 ? 1 - Math.exp(-7.7 * fdt) : 0.12;
  if(lab.active && lab.view!=='follow'){
    const boats=fleet.boats.map(r=>r.b);
    const xmin=lab.view==='mark'?100:Math.min(...boats.map(b=>b.x));
    const xmax=lab.view==='mark'?185:Math.max(...boats.map(b=>b.x));
    const ymin=lab.view==='mark'?-40:Math.min(...boats.map(b=>b.y));
    const ymax=lab.view==='mark'?45:Math.max(...boats.map(b=>b.y));
    S=Math.min(W/Math.max(65,xmax-xmin+35),H/Math.max(65,ymax-ymin+35));
    cam.x=(xmin+xmax)/2;cam.y=(ymin+ymax)/2;
  }else if(camMode==='auto' && fleet && camAutoTargets().length){
    const bs=camAutoTargets(), m=CAM_AUTO.margin;
    let x0=Math.min(...bs.map(b=>b.x))-m, x1=Math.max(...bs.map(b=>b.x))+m, y0=Math.min(...bs.map(b=>b.y))-m, y1=Math.max(...bs.map(b=>b.y))+m;
    const cw=COURSE.xMax-COURSE.xMin, ch=COURSE.yMax-COURSE.yMin;
    const sFull=Math.min(W/cw,H/ch), sMax=Math.min(W,H)/CAM_AUTO.min;
    const sT=clamp(Math.min(W/(x1-x0),H/(y1-y0)),sFull,Math.max(sFull,sMax));
    const ka=fdt>0?1-Math.exp(-CAM_AUTO.ease*fdt):0.05;
    cam.s=cam.s?cam.s*Math.exp(Math.log(sT/cam.s)*ka):sT; S=cam.s;
    // keep the view on the water: centre on the boats, but never show past the course edge when it all fits
    const vw=W/S, vh=H/S;
    let tx=(x0+x1)/2, ty=(y0+y1)/2;
    tx=vw>=cw?(COURSE.xMin+COURSE.xMax)/2:clamp(tx,COURSE.xMin+vw/2,COURSE.xMax-vw/2);
    ty=vh>=ch?(COURSE.yMin+COURSE.yMax)/2:clamp(ty,COURSE.yMin+vh/2,COURSE.yMax-vh/2);
    cam.x += (tx - cam.x) * ka * 2; cam.y += (ty - cam.y) * ka * 2;
  }else{
    cam.s=0;
    cam.x += (vb.x + Math.cos(vb.a) * look - cam.x) * k;
    cam.y += (vb.y + Math.sin(vb.a) * look - cam.y) * k;
  }

  ctx.fillStyle = C.bank; ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.translate(W / 2 - cam.x * S, H / 2 - cam.y * S);
  ctx.scale(S, S);

  // World-anchored layers keep the water moving independently of the camera.
  const cw = COURSE.xMax - COURSE.xMin, ch = COURSE.yMax - COURSE.yMin;
  drawWaterSurface(S, cw, ch);

  // start / finish line on the lower straight
  ctx.setLineDash([1.2, 1]); ctx.strokeStyle = 'rgba(233,245,242,.45)'; ctx.lineWidth = 0.22;
  ctx.beginPath(); ctx.moveTo(0, 6); ctx.lineTo(0, COURSE.yMax); ctx.stroke();
  // turning guide rings
  ctx.setLineDash([0.8, 1.4]); ctx.strokeStyle = 'rgba(233,245,242,.14)'; ctx.lineWidth = 0.18;
  for (const m of COURSE.marks) { ctx.beginPath(); ctx.arc(m.x, m.y, 11, 0, Math.PI * 2); ctx.stroke(); }
  ctx.setLineDash([]);
  // faint line across the course through each turn mark: tells you where the mark is when you're out wide
  ctx.strokeStyle = 'rgba(233,245,242,.12)'; ctx.lineWidth = 0.2;
  for (const m of COURSE.marks) { ctx.beginPath(); ctx.moveTo(m.x, COURSE.yMin); ctx.lineTo(m.x, COURSE.yMax); ctx.stroke(); }
  // dashed line 20 m before each mark, across the straight that runs into it (1M: home side, 2M: back side)
  ctx.setLineDash([1, 1]); ctx.strokeStyle = 'rgba(233,245,242,.16)';
  ctx.beginPath(); ctx.moveTo(MK - 20, 0); ctx.lineTo(MK - 20, COURSE.yMax); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-MK + 20, COURSE.yMin); ctx.lineTo(-MK + 20, 0); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(233,245,242,.55)'; ctx.font = '700 1.6px "Zen Kaku Gothic New", sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('スタート／ゴール', 0, COURSE.yMax - 2);

  // 距離標識: 空中線 (wire across the home straight with flags) and a pole on each side, colour-coded by distance to the line
  if (fleet) {
    for (const [d, col] of DIST_MARKS) {
      const x = -d;
      ctx.strokeStyle = 'rgba(233,245,242,.22)'; ctx.lineWidth = 0.12; ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(x, 3); ctx.lineTo(x, COURSE.yMax - 1); ctx.stroke();
      ctx.fillStyle = col;
      const fw = waterEnv ? Math.hypot(waterEnv.wx, waterEnv.wy) : 0, fl = 0.7 + Math.min(fw, 8) * 0.12, fa = fw > 0.3 ? Math.atan2(waterEnv.wy, waterEnv.wx) : 0, flap = Math.sin(time * (4 + fw)) * 0.15;
      for (let y = 5; y < COURSE.yMax - 2; y += 4.5) { ctx.save(); ctx.translate(x, y + 0.45); ctx.rotate(fa + flap); ctx.beginPath(); ctx.moveTo(0, -0.45); ctx.lineTo(fl, 0); ctx.lineTo(0, 0.45); ctx.fill(); ctx.restore(); }   // 旗: they stream downwind
      for (const y of [2.2, COURSE.yMax - 0.6]) { ctx.beginPath(); ctx.arc(x, y, 0.55, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = 0.12; ctx.stroke(); }   // ポール
      ctx.font = '800 1.5px "Zen Kaku Gothic New", sans-serif'; ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillText(d + 'm', x + 0.08, COURSE.yMax - 2.3 + 0.08); ctx.fillText(d + 'm', x + 0.08, 0.6 + 0.08);
      ctx.fillStyle = col; ctx.fillText(d + 'm', x, COURSE.yMax - 2.3); ctx.fillText(d + 'm', x, 0.6);
    }
  }
  if (fleet) drawWindsock(6, COURSE.yMax - 1.2);
  ctx.lineCap = 'round';
  if (!fleet) {
    // 計測ライン (スタート練習): short ticks across the straight they're on
    ctx.strokeStyle = 'rgba(255,214,120,.35)'; ctx.lineWidth = 0.25; ctx.setLineDash([0.6, 0.6]);
    ctx.fillStyle = 'rgba(255,214,120,.6)'; ctx.font = '700 1.2px "Zen Kaku Gothic New", sans-serif'; ctx.textAlign = 'center';
    const tick = (g, label, dy = 0) => { const y0 = g.side > 0 ? 4 : -4, y1 = g.side > 0 ? 40 : -40; ctx.beginPath(); ctx.moveTo(g.x, y0); ctx.lineTo(g.x, y1); ctx.stroke(); ctx.fillText(label, g.x, (g.side > 0 ? 42.5 : -41.5) + dy); };
    tick(GATES.tenji.from, '直線 終／展示 始／一周'); tick(GATES.tenji.to, '展示 終'); tick(GATES.choku.from, '直線 始');
    tick(GATES.mawari.from, 'まわり足 始'); tick(GATES.mawari.to, 'まわり足 終', -2.6);
    ctx.setLineDash([]);
  }
  if (fleet) for (const r of fleet.boats) drawWake(r.wake); else drawWake(wake);

  // ピット and 小回り防止ブイ (shown in ピット離れ mode)
  if (entryMode || (fleet && fleet.pitMode)) {
    const px = ENTRY.pitX, py = ENTRY.pitY;
    ctx.fillStyle = 'rgba(160,140,110,.85)'; ctx.fillRect(COURSE.xMin, py[0] - 2.6, px - 2.8 - COURSE.xMin, py[5] - py[0] + 4.6);
    ctx.strokeStyle = 'rgba(233,245,242,.5)'; ctx.lineWidth = 0.15;
    for (let k = 0; k <= 6; k++) { const y = (k === 0 ? py[0] - 2.25 : k === 6 ? py[5] + 2.25 : (py[k - 1] + py[k]) / 2); ctx.beginPath(); ctx.moveTo(px - 3, y); ctx.lineTo(px + 3.5, y); ctx.stroke(); }
    ctx.fillStyle = 'rgba(233,245,242,.8)'; ctx.font = '700 1.6px "Zen Kaku Gothic New", sans-serif'; ctx.textAlign = 'center';
    ctx.save(); ctx.translate(COURSE.xMin + 4.5, (py[0] + py[5]) / 2); ctx.rotate(-Math.PI / 2); ctx.fillText('ピット', 0, 0.5); ctx.restore();
    // 小回り防止: no going inside the line from 2M to the buoy; 150m見通し線 through 2M
    ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(-MK + 2, 0); ctx.lineTo(SMALL_TURN_BUOY.x - 1.2, 0); ctx.stroke();
    ctx.strokeStyle = 'rgba(232,70,60,.6)'; ctx.lineWidth = 0.25;
    ctx.beginPath(); ctx.moveTo(-MK, 2); ctx.lineTo(-MK, COURSE.yMax); ctx.stroke();
    ctx.fillStyle = 'rgba(232,70,60,.8)'; ctx.font = '700 1.3px "Zen Kaku Gothic New", sans-serif'; ctx.textAlign = 'left';
    ctx.fillText('150m見通し線', -MK + 0.8, COURSE.yMax - 2); ctx.textAlign = 'center';
    ctx.fillStyle = '#f2cf2e'; ctx.beginPath(); ctx.arc(SMALL_TURN_BUOY.x, SMALL_TURN_BUOY.y, 1.1, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 0.2; ctx.stroke();
    ctx.fillStyle = 'rgba(233,245,242,.7)'; ctx.font = '700 1.3px "Zen Kaku Gothic New", sans-serif';
    ctx.fillText('小回り防止ブイ', SMALL_TURN_BUOY.x, SMALL_TURN_BUOY.y - 2);
  }
  // 消波装置: a rope of floats in from each mark
  for (const ob of OBSTACLES) {
    if (ob.kind !== 'boom') continue;
    ctx.strokeStyle = 'rgba(233,245,242,.35)'; ctx.lineWidth = 0.12;
    ctx.beginPath(); ctx.moveTo(ob.x1, ob.y1); ctx.lineTo(ob.x2, ob.y2); ctx.stroke();
    const n = Math.round(BOOM_LEN / 1.5);
    for (let i = 0; i <= n; i++) {
      const t = i / n, x = ob.x1 + (ob.x2 - ob.x1) * t, y = ob.y1 + (ob.y2 - ob.y1) * t;
      ctx.fillStyle = i % 2 ? '#f4f7f6' : C.buoy;
      ctx.beginPath(); ctx.arc(x, y, 0.38, 0, Math.PI * 2); ctx.fill();
    }
  }
  // turn marks
  for (const m of COURSE.marks) {
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(m.x + 0.4, m.y + 0.5, 1.7, 1.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = C.buoy; ctx.beginPath(); ctx.arc(m.x, m.y, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 0.28; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.arc(m.x - 0.45, m.y - 0.45, 0.45, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(233,245,242,.8)'; ctx.font = '700 1.8px "Chakra Petch", sans-serif';
    ctx.fillText(m.name, m.x, m.y - 2.6);
  }

  // spray
  for (let i = spray.length - 1; i >= 0; i--) {
    const s = spray[i], age = time - s.t;
    if (age > s.life) { spray.splice(i, 1); continue; }
    ctx.fillStyle = `rgba(240,250,248,${0.75 * (1 - age / s.life)})`;
    ctx.beginPath(); ctx.arc(s.x + s.vx * age * 0.7, s.y + s.vy * age * 0.7, 0.14 + age * 0.35, 0, Math.PI * 2); ctx.fill();
  }

  if(lab.active)labDrawGuides();
  // コース主張中の艇は白く点滅
  if (fleet && fleet.entry && Math.sin(time * 12) > 0) for (const r of fleet.boats) {
    if (!(r.en && r.en.claimLeft > 0 && !r.en.dash)) continue;
    ctx.save(); ctx.translate(r.b.x, r.b.y); ctx.rotate(r.b.a);
    ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.lineWidth = 0.35;
    ctx.beginPath(); ctx.ellipse(0, 0, 3.3, 1.8, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  }
  if (window.Boat3D) Boat3D.prepare(fleet ? fleet.boats : [{b:B, inp:input, no:1, col:[PLAYER_STYLE.hull,PLAYER_STYLE.num]}], S, DPR, time);
  if (fleet) {
    for (const r of fleet.boats) drawBoatAt(r.b, r.inp, { hull: r.col[0], num: r.col[1], label: String(r.no), helmet: r.col[0], top: !!r.prof.top }, r === fr);
  } else { taDrawGhost(); drawBoatAt(B, input, PLAYER_STYLE, false); }
  ctx.restore();
  if (fleet && waterEnv && waterEnv.rain) drawRain();
  drawMini();
}

// 雨: screen-space streaks slanting with the wind (no Math.random — the race's dice stay untouched)
function drawRain() {
  const n = Math.round(Math.min(160, W * H / 9000)), sl = clamp((waterEnv.wx || 0) * 0.06, -0.5, 0.5), len = Math.min(W, H) * 0.045, t = performance.now() / 1000;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.strokeStyle = 'rgba(214,232,240,.33)'; ctx.lineWidth = 1; ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const h1 = Math.sin(i * 12.9898) * 43758.5453, h2 = Math.sin(i * 78.233) * 12345.678;
    const fx = h1 - Math.floor(h1), fy = h2 - Math.floor(h2), sp = 1.6 + fx * 0.8;
    const y = ((fy + t * sp) % 1) * (H + len) - len, x = ((fx * (W + 200) + y * sl) % (W + 200) + W + 200) % (W + 200) - 100;
    ctx.moveTo(x, y); ctx.lineTo(x + sl * len, y + len);
  }
  ctx.stroke();
  ctx.fillStyle = 'rgba(40,60,70,.12)'; ctx.fillRect(0, 0, W, H);   // the light goes grey under the cloud
}
function drawWake(arr) {
  // Turbulent propeller wash: dark trough, soft aerated water, white core, and the two spreading
  // wave lines. Drawn in age bands — one path per band and colour — so a whole field of boats costs a
  // few hundred strokes a frame rather than thousands (the difference between smooth and juddery on a phone).
  if (arr.length < 2) return;
  ctx.save(); ctx.lineCap = 'butt'; ctx.lineJoin = 'round';
  const BANDS = 6, span = 3 / BANDS;
  for (let k = 0; k < BANDS; k++) {
    const a0 = k * span, a1 = a0 + span, age = a0 + span / 2;
    const core = new Path2D(), sides = new Path2D(), foam = new Path2D();
    let open = false, vs = 0, n = 0;
    for (let i = 1; i < arr.length; i++) {
      const p = arr[i - 1], q = arr[i], ag = time - q.t;
      if (ag < a0 || ag > a1 + 0.05) { open = false; continue; }
      if (!open) { core.moveTo(p.x, p.y); open = true; }
      core.lineTo(q.x, q.y);
      for (const side of [-1, 1]) {
        const sp = (time - p.t) * (1.4 + p.v * 0.12), sq = ag * (1.4 + q.v * 0.12);
        sides.moveTo(p.x - Math.sin(p.a) * side * sp, p.y + Math.cos(p.a) * side * sp);
        sides.lineTo(q.x - Math.sin(q.a) * side * sq, q.y + Math.cos(q.a) * side * sq);
      }
      if (i % 3 === 0) {
        const h = hash(i, Math.floor(q.t * 25)), spread = 0.2 + ag * 0.48;
        const fx = q.x + Math.sin(q.a) * (h - .5) * spread, fy = q.y - Math.cos(q.a) * (h - .5) * spread;
        foam.moveTo(fx + 0.08 + ag * .065, fy); foam.ellipse(fx, fy, 0.08 + ag * .065, 0.045 + ag * .025, q.a, 0, Math.PI * 2);
      }
      vs += Math.min(1, q.v / 10); n++;
    }
    if (!n) continue;
    const al = (1 - age / 3) * (vs / n);
    ctx.strokeStyle = `rgba(3,35,45,${0.23 * al})`; ctx.lineWidth = 1.25 + age * 1.55; ctx.stroke(core);
    ctx.strokeStyle = `rgba(157,218,218,${0.27 * al})`; ctx.lineWidth = 0.85 + age * 1.05; ctx.stroke(core);
    ctx.strokeStyle = `rgba(247,255,250,${0.58 * al * Math.exp(-age * 0.65)})`; ctx.lineWidth = 0.24 + age * 0.32; ctx.stroke(core);
    ctx.strokeStyle = `rgba(2,40,49,${0.3 * al})`; ctx.lineWidth = 0.36 + age * 0.1; ctx.stroke(sides);
    ctx.strokeStyle = `rgba(227,251,241,${0.48 * al})`; ctx.lineWidth = 0.1 + age * 0.045; ctx.stroke(sides);
    ctx.fillStyle = `rgba(239,255,246,${0.45 * al})`; ctx.fill(foam);
  }
  ctx.restore();
}

const PLAYER_STYLE = { hull: '#f4f7f6', num: '#0a2c38', label: '1', helmet: C.lever };
/* バウンド: drawn from the hull's hop in the physics (d155; d154 was looks only). In the air the hull comes up at the
   camera and its shadow stays on the water; a landing throws a white burst. */
const BOUNCE_VIEW = { hMax: 0.45, splashT: 0.4, wil: 0.22 };   // wil: ウィリー drawn as this much lift (bow up, riding on the tail)
function boatBounce(b) {
  return { h: b.cap > 0 ? 0 : clamp(Math.max(b.hop || 0, (b.wil || 0) * BOUNCE_VIEW.wil), 0, BOUNCE_VIEW.hMax), wil: b.cap > 0 ? 0 : b.wil || 0, ls: b.landAge ?? 9, sp: clamp((b.landV || 0) / 4, 0, 1), stuck: (b.stuckAge ?? 9) < 0.3 };
}
function drawBoatAt(b, inp, sty, focused) {
  ctx.save();
  ctx.translate(b.x, b.y); ctx.rotate(b.a);
  if (focused) {
    ctx.setLineDash([0.6, 0.6]); ctx.strokeStyle = C.lever; ctx.lineWidth = 0.2;
    ctx.beginPath(); ctx.arc(0, 0, 3.4, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
  }
  const bo = boatBounce(b), lift = bo.h, ls = bo.ls;
  const bob = 1 + 0.07 * Math.sin(time * 18) * Math.max(b.porp, (b.wakeBump || 0) * 1.3);
  ctx.scale(bob, 1);
  if (ls >= 0 && ls < BOUNCE_VIEW.splashT && bo.sp > 0.25 && b.cap <= 0) {   // landing slap: a white burst out both sides
    const k = ls / BOUNCE_VIEW.splashT, a = (1 - k) * 0.75 * bo.sp;
    ctx.strokeStyle = `rgba(240,255,250,${a})`; ctx.lineWidth = 0.16 * (1 - k) + 0.05;
    ctx.beginPath(); ctx.ellipse(-0.3, 0, 2.6 + k * 1.6 * bo.sp, 1.2 + k * 1.4 * bo.sp, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = `rgba(245,255,252,${a * 0.8})`;
    for (let n = 0; n < 8; n++) { const h = hash(n, Math.floor((time - ls) * 10)), side = n % 2 ? 1 : -1;
      ctx.beginPath(); ctx.ellipse(1.2 - h * 3.2, side * (1.1 + k * (0.8 + h) * 1.6 * bo.sp), 0.12 + h * 0.1, 0.07, 0, 0, Math.PI * 2); ctx.fill(); }
  }
  const capT = b.cap > 0 ? (b.cap > 100 ? (time * 0.6) % 1 : 1 - b.cap / 2.2) : 0;
  // stability on the water: amber as it nears the line, red and pulsing past it; a second ring while it's going for it
  if (b.cap <= 0) {
    const ld = b.load || 0;
    if (ld > 0.7) {
      const over = ld >= 1, pulse = over ? 0.5 + 0.5 * Math.sin(time * 14) : 1;
      ctx.strokeStyle = over ? `rgba(255,107,90,${0.45 + 0.4 * pulse})` : `rgba(255,209,102,${clamp((ld - 0.7) / 0.3, 0, 1) * 0.6})`;
      ctx.lineWidth = over ? 0.3 : 0.2;
      ctx.beginPath(); ctx.ellipse(0, 0, 3.1, 1.9, 0, 0, Math.PI * 2); ctx.stroke();
    }
    if (b.pushing) {
      ctx.strokeStyle = 'rgba(255,180,46,.85)'; ctx.lineWidth = 0.14; ctx.setLineDash([0.5, 0.4]);
      ctx.beginPath(); ctx.ellipse(0, 0, 3.7, 2.4, 0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    }
  }
  // Soft contact shadow, then a cached shaded hull (same physical footprint).
  { const sk = b.cap > 0 ? 0 : clamp((b.splashK || 0) / 1.2, 0, 1.4);
    if (sk > 0.12 && b.v > 7 && Math.abs(b.yaw || 0) > 0.2) {   // スプラッシュ (d158): thrown off the outside of the turn — a tall wall when the hull is flat, a thin low sheet when it is banked deep
      const side = -Math.sign(b.yaw), hgt = sk * sk;
      for (let n = 0; n < 14; n++) { const h = hash(n + 110, Math.floor(time * 15)), u = n / 14;
        const o = side * (1.0 + u * (0.6 + 2.6 * hgt) + h * 0.5 * sk), r0 = 0.12 + (0.18 + h * 0.2) * sk + u * 0.25 * hgt;
        ctx.fillStyle = `rgba(0,26,34,${0.12 * hgt})`;   // its shadow, falling away down-screen as it gets taller
        ctx.beginPath(); ctx.ellipse(0.4 - u * 3.6 + 0.4 * hgt, o + 0.6 * hgt * u, r0, r0 * 0.6, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = `rgba(242,255,252,${clamp(0.25 + 0.5 * sk, 0, 0.85) * (1 - 0.5 * u)})`;
        ctx.beginPath(); ctx.ellipse(0.4 - u * 3.6, o, r0, r0 * 0.6, 0, 0, Math.PI * 2); ctx.fill(); }
    }
  }
  { const sl = b.cap > 0 ? 0 : clamp((Math.abs(b.slip || 0) - 0.05) / 0.25, 0, 1);
    if (sl > 0 && b.v > 6) {   // ドリフト: the hull skating sideways throws a sheet of water off the side it is sliding toward
      const side = Math.sign(b.vl) || 1;   // + = toward the left of the bow (local +y)
      ctx.fillStyle = `rgba(238,255,250,${0.55 * sl})`;
      for (let n = 0; n < 9; n++) { const h = hash(n + 70, Math.floor(time * 16)), u = n / 9;
        ctx.beginPath(); ctx.ellipse(1.6 - u * 3.8, side * (1.05 + h * 0.5 + sl * (0.4 + u * 1.2)), 0.18 + h * 0.18 + sl * 0.15, 0.1 + sl * 0.12, 0, 0, Math.PI * 2); ctx.fill(); }
    }
  }
  if (bo.wil > 0.05) {   // ウィリー: a tall rooster tail off the stern, the hull riding on it
    ctx.fillStyle = `rgba(240,255,250,${0.5 * bo.wil})`;
    for (let n = 0; n < 9; n++) { const h = hash(n + 40, Math.floor(time * 14)), u = n / 9;
      ctx.beginPath(); ctx.ellipse(-2.8 - u * 3.2, (h - 0.5) * (0.6 + u * 1.4), 0.25 + u * 0.35, 0.15 + u * 0.2, 0, 0, Math.PI * 2); ctx.fill(); }
  }
  if (bo.stuck && b.cap <= 0) {   // 刺さり: the bow buried, water thrown up and forward over it
    const k = clamp((b.stuckAge || 0) / 0.3, 0, 1);
    ctx.fillStyle = `rgba(250,255,253,${0.85 * (1 - k)})`;
    for (let n = 0; n < 10; n++) { const h = hash(n, Math.floor((time - (b.stuckAge || 0)) * 10)), side = n % 2 ? 1 : -1;
      ctx.beginPath(); ctx.ellipse(2.0 + h * 1.4 + k, side * (0.3 + h * 0.9 + k * 0.6), 0.22 + h * 0.15, 0.12, 0, 0, Math.PI * 2); ctx.fill(); }
  }
  const lf = lift / BOUNCE_VIEW.hMax;   // in the air the shadow stays on the water, falls away down-screen and sharpens, the hull comes up at the camera
  const ox = lf * 1.6, oy = lf * 2.2, ca = Math.cos(b.a), sa = Math.sin(b.a), sx = ox * ca + oy * sa, sy = -ox * sa + oy * ca;
  ctx.fillStyle = `rgba(0,22,30,${0.22 + 0.1 * lf})`;
  ctx.beginPath(); ctx.ellipse(0.12 + sx, 0.4 + inp.roll * 0.25 + sy, 2.55 * (1 - 0.08 * lf), 1.05 * (1 - 0.08 * lf), 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = `rgba(0,18,25,${0.25 + 0.1 * lf})`;
  ctx.beginPath(); ctx.ellipse(-0.15 + sx, 0.22 + sy, 2.15, 0.78, 0, 0, Math.PI * 2); ctx.fill();
  if (lift > 0.005) ctx.scale(1 + lf * 0.28, 1 + lf * 0.2);   // nearer the camera
  // Bow spray follows speed and lateral load; it is entirely visual.
  if (b.cap <= 0 && b.v > 5) {
    const speed = clamp(b.v / 23, 0, 1);
    ctx.lineCap = 'round';
    for (const side of [-1, 1]) {
      ctx.strokeStyle = `rgba(232,255,248,${0.32 + speed * .35})`; ctx.lineWidth = .09 + speed * .1;
      ctx.beginPath(); ctx.moveTo(1.65, side * .38);
      ctx.bezierCurveTo(.8, side * .96, -.7, side * (1.02 + speed * .3), -2.55, side * (1.1 + speed * .5)); ctx.stroke();
      for (let n = 0; n < 7; n++) {
        const h = hash(n + side * 15, Math.floor(time * 12));
        const u = n / 7;
        ctx.fillStyle = `rgba(243,255,250,${(.15 + h * .4) * speed})`;
        ctx.beginPath(); ctx.ellipse(.8 - u * 3.6,
          side * (.87 + u * (.35 + Math.abs(b.vl) * .05) + h * .18), .06 + h * .07, .035, -.25 * side, 0, Math.PI * 2); ctx.fill();
      }
    }
  }
  // The atlas is rendered from GLB geometry each frame; all 2D wake/spray/UI layers remain.
  const drew3D = window.Boat3D && Boat3D.draw(ctx, b);
  if (!drew3D) {
  const hullSprite = boatSprite(sty, b.cap > 0 && !b.fallen);
  const bk = b.cap > 0 ? 0 : clamp((b.bank || 0) / BANK.max, -1, 1);   // 艇の傾き (d158): seen from above a banked hull narrows and its bottom shows on the high side
  ctx.save(); ctx.translate(0, bk * 0.18); ctx.scale(1, 1 - Math.abs(bk) * 0.22);
  ctx.drawImage(hullSprite, -2.65, -1.1, 5.3, 2.2);
  if (Math.abs(bk) > 0.08) {
    const hi = -Math.sign(bk);   // the side that has come up out of the water
    ctx.fillStyle = `rgba(12,30,40,${0.35 + 0.4 * Math.abs(bk)})`;
    ctx.beginPath(); ctx.moveTo(2.3, hi * 0.75); ctx.quadraticCurveTo(0.2, hi * (1.12 + 0.35 * Math.abs(bk)), -2.6, hi * (1.0 + 0.35 * Math.abs(bk)));
    ctx.lineTo(-2.6, hi * 1.0); ctx.quadraticCurveTo(0.2, hi * 1.1, 2.3, hi * 0.75); ctx.fill();
    ctx.strokeStyle = `rgba(255,255,255,${0.25 * Math.abs(bk)})`; ctx.lineWidth = 0.06;
    ctx.beginPath(); ctx.moveTo(1.8, hi * (0.86 + 0.2 * Math.abs(bk))); ctx.lineTo(-2.4, hi * (1.06 + 0.3 * Math.abs(bk))); ctx.stroke();   // the chine
  }
  ctx.restore();
  if (b.cap <= 0) {
    // Life jacket, bent arms, helmet shell and visor; pose follows the actual inputs.
    const rxp = -0.35 + inp.pitch * 0.6, ryp = inp.roll * 0.55;
    ctx.save(); ctx.translate(rxp, ryp); ctx.rotate(inp.roll * .13);
    ctx.strokeStyle = '#152d3b'; ctx.lineWidth = .21; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-.48, -.24); ctx.lineTo(-.78, -.34); ctx.lineTo(-.9, -.12);
    ctx.moveTo(-.48, .24); ctx.lineTo(-.8, .34); ctx.lineTo(-.92, .12); ctx.stroke();
    const vest = ctx.createLinearGradient(0, -.38, 0, .38);
    vest.addColorStop(0, '#f8faf2'); vest.addColorStop(.35, sty.hull); vest.addColorStop(1, '#263c47');
    ctx.fillStyle = vest; ctx.beginPath(); ctx.ellipse(-.25, 0, .55, .36, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(6,24,34,.6)'; ctx.lineWidth = .075; ctx.stroke();
    ctx.strokeStyle = '#d8e5df'; ctx.lineWidth = .12;
    ctx.beginPath(); ctx.moveTo(-.08, -.26); ctx.lineTo(.38, -.36); ctx.lineTo(.62, -.24);
    ctx.moveTo(-.08, .26); ctx.lineTo(.32, .4); ctx.lineTo(.56, .27); ctx.stroke();
    ctx.fillStyle = '#101d2a'; ctx.beginPath(); ctx.ellipse(.22, .06, .4, .34, 0, 0, Math.PI * 2); ctx.fill();
    const helm = ctx.createRadialGradient(.1, -.15, .015, .2, 0, .41);
    helm.addColorStop(0, '#ffffff'); helm.addColorStop(.3, sty.helmet); helm.addColorStop(1, '#243a47');
    ctx.fillStyle = helm; ctx.beginPath(); ctx.ellipse(.22, -.04, .37, .32, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#153141'; ctx.beginPath(); ctx.ellipse(.46, -.015, .13, .235, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#7eb9c9'; ctx.lineWidth = .045; ctx.beginPath(); ctx.moveTo(.48, -.17); ctx.lineTo(.5, .09); ctx.stroke();
    if (sty.top) { ctx.strokeStyle = '#ff4032'; ctx.lineWidth = .09; ctx.beginPath(); ctx.arc(.22, -.04, .33, 1.1, 4.7); ctx.stroke(); }
    ctx.restore();
  } else {
    ctx.strokeStyle = `rgba(233,245,242,${1 - capT})`; ctx.lineWidth = 0.15;
    ctx.beginPath(); ctx.arc(0, 0, 2.5 + capT * 3, 0, Math.PI * 2); ctx.stroke();
  }
  }
  ctx.restore();
  if (b.fallen) {
    // 落水: the rider bobbing in the water behind an empty boat
    const rt = (time * 0.8) % 1;
    ctx.strokeStyle = `rgba(233,245,242,${0.8 * (1 - rt)})`; ctx.lineWidth = 0.12;
    ctx.beginPath(); ctx.arc(b.fx, b.fy, 0.6 + rt * 1.8, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = sty.helmet; ctx.beginPath(); ctx.arc(b.fx, b.fy, 0.38, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#0a2c38'; ctx.lineWidth = 0.08; ctx.stroke();
  }
}

function drawMini() {
  const w = mini.width, h = mini.height; if (!w) return;
  mctx.setTransform(1, 0, 0, 1, 0, 0);
  mctx.clearRect(0, 0, w, h);
  const pad = 5 * DPR;
  const sc = Math.min((w - pad * 2) / (COURSE.xMax - COURSE.xMin), (h - pad * 2) / (COURSE.yMax - COURSE.yMin)), sx = sc, sy = sc;
  const ox = (w - (COURSE.xMax - COURSE.xMin) * sc) / 2, oy = (h - (COURSE.yMax - COURSE.yMin) * sc) / 2;
  const X = x => ox + (x - COURSE.xMin) * sx, Y = y => oy + (y - COURSE.yMin) * sy;
  mctx.strokeStyle = 'rgba(233,245,242,.3)'; mctx.lineWidth = DPR;
  mctx.strokeRect(X(COURSE.xMin), Y(COURSE.yMin), (COURSE.xMax - COURSE.xMin) * sx, (COURSE.yMax - COURSE.yMin) * sy);
  mctx.beginPath(); mctx.moveTo(X(0), Y(6)); mctx.lineTo(X(0), Y(COURSE.yMax)); mctx.stroke();
  mctx.strokeStyle = 'rgba(255,122,26,.7)'; mctx.lineWidth = 1.5 * DPR;
  for (const ob of OBSTACLES) if (ob.kind === 'boom') { mctx.beginPath(); mctx.moveTo(X(ob.x1), Y(ob.y1)); mctx.lineTo(X(ob.x2), Y(ob.y2)); mctx.stroke(); }
  mctx.fillStyle = C.buoy;
  for (const m of COURSE.marks) { mctx.beginPath(); mctx.arc(X(m.x), Y(m.y), 2.5 * DPR, 0, Math.PI * 2); mctx.fill(); }
  if (fleet) {
    for (const r of fleet.boats) { mctx.fillStyle = r.col[0]; mctx.strokeStyle = 'rgba(233,245,242,.8)'; mctx.lineWidth = DPR; mctx.beginPath(); mctx.arc(X(r.b.x), Y(r.b.y), 2.6 * DPR, 0, Math.PI * 2); mctx.fill(); mctx.stroke(); }
    return;
  }
  mctx.fillStyle = '#f4f7f6';
  mctx.beginPath(); mctx.arc(X(B.x), Y(B.y), 3 * DPR, 0, Math.PI * 2); mctx.fill();
  mctx.strokeStyle = '#f4f7f6'; mctx.lineWidth = 1.5 * DPR;
  mctx.beginPath(); mctx.moveTo(X(B.x), Y(B.y)); mctx.lineTo(X(B.x) + Math.cos(B.a) * 8 * DPR, Y(B.y) + Math.sin(B.a) * 8 * DPR); mctx.stroke();
}

/* ---------- HUD ---------- */
const REDUCED_MOTION = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
const el = { stab: $('stab'), stabFill: $('stabFill'), demoTag: $('demoTag'), spd: $('spd'), lap: $('lap'), best: $('best'), fill: $('lfill'), knob: $('lknob'), wrot: $('wrot'), pdot: $('pdot'), pbank: document.querySelectorAll('svg.bank'), pdeg: $('pdeg'), pbox: $('pbox'), track: $('track'), hand: $('hand'), clockTxt: $('clockTxt'), clock: $('clock') };
let lastTxt = {};
const setTxt = (k, v) => { if (lastTxt[k] !== v) { lastTxt[k] = v; el[k].textContent = v; } };
// 予想コース (under the order strip): the courses as they stand now — slow group / dash group
function updateCourseOrder() {
  const box = $('corder');
  if (!fleet || lab.active) { box.hidden = true; return; }
  let list, nSlow;
  if (fleet.entry) { const eo = entryOrder(fleet.entry, fleet.boats); list = eo.order; nSlow = eo.nSlow; }
  else { list = fleet.boats.slice().sort((a, c) => a.trait.course - c.trait.course); nSlow = list.filter(r => r.trait.slow).length; }
  const key = list.map(r => r.no).join('') + '/' + nSlow;
  box.hidden = false;
  if (box.dataset.k === key) return;
  box.dataset.k = key; box.textContent = '';
  const lab0 = document.createElement('span'); lab0.textContent = fleet.entry ? '予想コース' : '進入'; box.appendChild(lab0);
  list.forEach((r, i) => {
    if (i === nSlow && i > 0) { const s = document.createElement('i'); s.className = 'sep'; s.textContent = '/'; box.appendChild(s); }
    const c = document.createElement('i'); c.textContent = r.no; c.style.background = r.col[0]; c.style.color = r.col[1]; box.appendChild(c);
  });
}
const windJa = e => { if (!e) return ''; const w = Math.hypot(e.wx, e.wy); if (w < 0.3) return '無風'; const a = Math.abs(e.wx) >= Math.abs(e.wy) ? (e.wx > 0 ? '追い風' : '向かい風') : (e.wy > 0 ? '横風(外向き)' : '横風(内向き)'); return `${a} ${w.toFixed(1)}m`; };
// the water badge by the clock: one entry per reading that is switched on (tide and temperature join later)
const ENV_BADGE = { wind: true, wave: true, tide: false, temp: false };
const envBadge = e => [e.rain ? '雨' : '', ENV_BADGE.wind && windJa(e), ENV_BADGE.wave && e.wave ? `波${e.wave}cm` : '', ENV_BADGE.tide && e.tideJa ? `${e.tideJa}` : '', ENV_BADGE.temp && e.temp != null ? `${Math.round(e.temp)}℃` : '', e.laps === 2 ? '2周戦' : e.stabilizer ? '安定板' : ''].filter(Boolean).join(' ');
function updateHud() {
  { const wh = $('windHud'); if (wh) { const on = !!(fleet && waterEnv); if (wh.hidden === on) wh.hidden = !on;
      if (on) { const a = Math.atan2(waterEnv.wy, waterEnv.wx) * 180 / Math.PI, t = envBadge(waterEnv); if (wh.dataset.t !== t) { wh.dataset.t = t; $('windTxt').textContent = t; $('windArrow').setAttribute('transform', `rotate(${a.toFixed(0)})`); } } } }
  // the on-screen posture pad mirrors the controller's left stick (or keys) when no finger is on it
  if (virtualPosture.enabled && virtualPosture.pointer == null) {
    const zr = $('postureZone').getBoundingClientRect(), rad = Math.max(1, zr.width / 2 - 18);
    const px = clamp(input.roll), py = clamp(-input.pitch), len = Math.hypot(px, py), k = len > 1 ? 1 / len : 1;
    $('postureThumb').style.transform = `translate(${px * k * rad}px,${py * k * rad}px)`;
  }
  if(controlMode==='wheel')$('phoneSteerReadout').textContent=phoneWheel.value<-.03?`スマホ舵：左 ${Math.round(-phoneWheel.value*100)}%`:phoneWheel.value>.03?`スマホ舵：右 ${Math.round(phoneWheel.value*100)}%`:'スマホ舵：中央';
  const fr = focusRow();
  const vb = fr ? fr.b : B, vi = fr ? fr.inp : input, vh = fr ? (fr.b.harmony || 0) : harmony;
  setTxt('spd', String(kmh(vb.v)));
  const pr = playerRow();
  $('dashBtn').hidden = !(fleet && fleet.entry && pr);
  $('claimBtn').hidden = !(fleet && fleet.entry && pr && !fleet.noMae);
  if (pr && fleet.entry) { $('claimBtn').classList.toggle('on', pr.en.claimLeft > 0); $('claimTxt').textContent = pr.en.claimLeft > 0 ? `あと${pr.en.claimLeft}` : 'コース'; }
  updateCourseOrder();
  if (pr && fleet.entry) { $('dashBtn').classList.toggle('done', pr.en.dash); $('dashBtn').disabled = pr.en.dash; }
  if (fr && fleet.entry) {
    const STAGE = { pit: 'ピット', out: 'ピットアウト', back: '2マークへ', turn: '2マーク', approach: '正対へ', wait: '待機' };
    setTxt('lap', `進入　${STAGE[fr.en.stage]}${fr.en.rewind ? '（回り直し）' : ''}`);
    el.best.classList.toggle('top', !!fr.prof.top);
    setTxt('best', `${fr.prof.kinen ? 'A1★記念クラス' : fr.prof.top ? 'A1★トップ' : fr.prof.name + '級'}・予定${fr.en.course || fr.en.slot}コース${fr.en.dash ? '（ダッシュ）' : ''}${fr.en.projOk != null && (fr.en.stage === 'wait' || fr.en.stage === 'approach') ? `・起こし見込み${Math.round(fr.en.projOk)}m` : ''}${fr.en.fightWith ? '・抵抗中' : ''}・調子${playerForm()}`);
    setTxt('demoTag', fr.player ? `自分 ${fr.no}号艇` : `追尾 ${fr.no}号艇${fleet.focus == null ? '（先頭を自動追尾）' : ''}`);
    updateOrderStrip();
    $('skipBtn').hidden = true;
  } else if (fr) {
    const lead = fleet.rank[0];
    setTxt('lap', SS.phase === 'count' ? '待機行動' : `${Math.min(raceLaps(), lead.laps + 1)}周目  ${fmtRT(Math.max(0, (lead.fin ?? time) - fleet.raceStart))}`);
    el.best.classList.toggle('top', !!fr.prof.top);
    setTxt('best', `${fr.prof.kinen ? 'A1★記念クラス' : fr.prof.top ? 'A1★トップ' : fr.prof.name + '級'}・${fr.trait.course}コース・${fr.trait.kado ? `${fr.trait.course}カド` : fr.trait.slow ? 'スロー' : 'ダッシュ'}・${TACTIC_JA[fr.drv.mem.tacticNow || fr.trait.tactic]}`);
    setTxt('demoTag', fr.player ? `自分 ${fr.no}号艇${fr.st == null || playerRacing(fr) ? '' : '（CPU操縦中）'}` : `追尾 ${fr.no}号艇${fleet.focus == null ? '（先頭を自動追尾）' : ''}`);
    updateOrderStrip();
    $('skipBtn').hidden = !(fleet.locked && !fleet.endAt);
  } else {
    el.best.classList.remove('top');
    if (soloKind === 'ta') {
      setTxt('lap', SS.phase === 'count' ? 'タイムアタック' : `${Math.min(TA.laps, ta.laps.length + 1)}周目  ${fmtRT(Math.max(0, (ta.on ? time : ta.lastAt) - ta.zero))}`);
      setTxt('best', `${playerName()}　` + (taBest ? `自己ベスト ${fmtRT(taBest.t)}（${taRank(taBest.t)}）` : '自己ベスト —'));
    } else {
      setTxt('lap', `LAP ${lap.n + 1}  ${fmt(Math.max(0, time - lap.start))}`);
      setTxt('best', lap.best == null ? 'ベスト —' : `ベスト ${fmt(lap.best)}`);
    }
  }
  const th = el.track.clientHeight;
  el.fill.style.height = (vi.thr * 100) + '%';
  el.knob.style.transform = `translateY(${-vi.thr * (th - 18)}px)`;
  el.wrot.setAttribute('transform', `rotate(${vi.steer * 110})`);
  el.pdot.style.transform = `translate(${vi.roll * 30}px, ${-vi.pitch * 30}px)`;
  const bankDeg = vb.cap > 0 ? 0 : (vb.bank || 0) * 57.3;   // 艇の傾き: the hull's section, as seen from behind (body lean is the dot)
  for (const ic of el.pbank) { ic.style.transform = `rotate(${bankDeg.toFixed(1)}deg)`; ic.classList.toggle('deep', Math.abs(bankDeg) > 0.75 * BANK.max * 57.3); }
  const f = n => (n >= 0 ? '+' : '−') + Math.abs(Math.round(n));
  // 限界度 gauge (load): 0 … 1.5, danger line at 1.0 (two-thirds across). Past the line the needle and the gauge
  // shake, harder the deeper it goes — the warning that the hull may let go (d138)
  const ld = vb.cap > 0 ? 1.5 : (vb.load || 0);
  const shake = vb.cap <= 0 && ld > 1 && !REDUCED_MOTION ? clamp((ld - 1) / 0.4, 0, 1) : 0, tn = performance.now() / 1000;
  const nz = k => Math.sin(tn * (41 + k) + k * 1.7) * 0.6 + Math.sin(tn * (67 + 2 * k) + k) * 0.4;
  el.stabFill.style.width = clamp(ld / 1.5 * 100 + nz(0) * (3 + 12 * shake) * (shake > 0), 0, 100) + '%';
  el.stab.style.transform = shake > 0 ? `translate(${(nz(1) * (0.8 + 2.5 * shake)).toFixed(2)}px, ${(nz(2) * (0.4 + 1.5 * shake)).toFixed(2)}px)` : '';
  el.stabFill.style.background = ld < 0.75 ? C.good : ld < 1 ? C.warn : C.bad;
  el.stab.classList.toggle('over', ld >= 1 && vb.cap <= 0);
  const stabWord = vb.cap > 0 ? '転覆' : ld >= 1 ? '危険ライン超え' : ld >= 0.85 ? '限界ぎりぎり' : ld >= 0.55 ? '攻め' : '余裕';
  el.stab.title = stabWord;
  setTxt('pdeg', (vb.pushing ? '勝負中・' : '') + stabWord + '　' + (Math.abs(bankDeg) >= 3 ? `艇${bankDeg > 0 ? '右' : '左'}${Math.round(Math.abs(bankDeg))}°　` : '') + (!fr && pad.seenAt > 0 && performance.now() - pad.seenAt < 3000 ? `パッド 左右 ${f(input.roll * 100)}%  前後 ${f(input.pitch * 100)}%` : !fr&&virtualPosture.enabled ? `仮想 左右 ${f(input.roll*100)}% 前後 ${f(input.pitch*100)}%` : fr ? `想定 左右 ${f(vi.roll * sensor.range)}°  前後 ${f(vi.pitch * sensor.range)}°` : sensor.got ? `左右 ${f(sensor.deg[0])}°  前後 ${f(sensor.deg[1])}°` : (running ? '傾き入力なし' : '体重移動')));
  const turning = Math.abs(vi.steer) > 0.3 && vb.cap <= 0;
  el.pbox.style.setProperty('--h', !turning ? C.line : vh > 0.68 ? C.good : vh > 0.42 ? C.warn : C.bad);
  if (SS.phase === 'entry' && fleet && fleet.entry) {
    // big clock from the pit release: time to the start; the hand waits at the top for the last 12 s
    const E = fleet.entry, left = Math.max(0, time < E.go ? ENTRY.total : E.zero - time);
    el.hand.setAttribute('transform', 'rotate(0)');
    setTxt('clockTxt', `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`);
    el.clock.classList.remove('live');
  } else if (SS.phase !== 'off' && SS.phase !== 'entry') {
    const el2 = time - SS.t0, rem = CLOCK - el2;
    el.hand.setAttribute('transform', `rotate(${(Math.max(0, el2) / CLOCK) * 360})`);
    setTxt('clockTxt', SS.phase === 'count' ? (rem > 0 ? rem.toFixed(1) : '+' + (-rem).toFixed(2)) : el.clockTxt.textContent);
    el.clock.classList.toggle('live', SS.phase === 'count' && rem <= 0);
  }
}

/* ---------- d42 independent behavior laboratory ---------- */
