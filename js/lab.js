// Honor for GP — 検証ラボ
const LAB_PHASES = [
 ['slit','スリット付近','開始から、設定した手前位置xまで'],
 ['approach','コーナー手前','手前位置xから、x>115mかつ左旋回速度>7°/sまで'],
 ['turn','旋回中','左旋回開始から、艇首が初期方向から左へ135°向くまで'],
 ['exit','立ち上がり','左へ135°から、160°以上回りx<135mかつy<0まで'],
 ['next','次マークへの準備','第1マーク出口から検証終了まで']
];
const LAB_TACTICS = {makurisashi:'まくり差し',auto:'CPUに任せる',keep:'前段階を継続',nige:'逃げ',sashiWin:'差し（勝負）',sashiPlace:'差し（着取り）',makuri:'まくり',tsuke:'ツケマイ',wall:'壁'};
const labEmpty = () => ({tactic:'auto',thr:null,steer:null,roll:null,pitch:null,R:null,gap:null});
const labDefault = () => ({cpuMode:'legacy',seed:42,duration:30,hz:20,approach:90,boats:Array.from({length:6},(_,i)=>({course:i+1,enabled:i===0||i===3,grade:'A1',temper:'normal',style:i<3?'slow':'dash',x:i===3?4:0,y:8+i*6,speed:78,st:i===3?.06:.15,motor:1,plan:'auto',contactMode:'priority',squeezeMode:'lead',stages:LAB_PHASES.map(()=>labEmpty())}))});
function labEscape(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function labOptions(values,selected){return Object.entries(values).map(([v,t])=>`<option value="${v}"${v===selected?' selected':''}>${t}</option>`).join('');}
function labFill(config){
 $('labCpuMode').value=config.cpuMode||'legacy';$('labSeed').value=config.seed; $('labDuration').value=config.duration; $('labHz').value=config.hz; $('labApproach').value=config.approach;
 $('labBoats').innerHTML=config.boats.map(b=>`<details class="lab-block lab-boat" data-course="${b.course}" style="--boat:${LANE_COL[b.course-1][0]}"${b.enabled?' open':''}><summary><label><input type="checkbox" data-f="enabled"${b.enabled?' checked':''}>${b.course}コース / ${b.course}号艇</label></summary>
 <div class="lab-grid">
 <label>選手能力<select data-f="grade">${labOptions({A1:'A1',A2:'A2',B1:'B1',B2:'B2',TOP:'A1 ★トップ',KINEN:'A1 ★記念クラス'},b.grade)}</select></label>
 <label>気性<select data-f="temper">${labOptions({calm:'慎重',normal:'普通',aggr:'攻撃的'},b.temper)}</select></label>
 <label>スタート型<select data-f="style">${labOptions({slow:'スロー',dash:'ダッシュ',kado:'カド'},b.style)}</select></label>
 <label>接触への対応<select data-f="contactMode">${labOptions({normal:'通常（d42）',priority:'接触回避を優先'},b.contactMode||'normal')}</select></label>
 <label>一艇身先行したら絞る<select data-f="squeezeMode">${labOptions({lead:'絞る（前へ出て内へ入る）',never:'絞らない',legacy:'従来の判断（比較用）'},b.squeezeMode||'legacy')}</select></label>
 <label>事前の作戦<select data-f="plan">${labOptions(Object.fromEntries(Object.entries(LAB_TACTICS).filter(([k])=>k!=='keep')),b.plan)}</select></label>
 ${[['x','初期 x（m）',-40,110,.1],['y','初期 y（m）',3,46,.1],['speed','初速（km/h）',0,95,.1],['st','既知の ST（秒）',0,.99,.01],['motor','推力倍率（標準1）',.8,1.2,.01]].map(([k,n,min,max,step])=>`<label>${n}<input data-f="${k}" type="number" min="${min}" max="${max}" step="${step}" value="${b[k]}"></label>`).join('')}
 </div><div class="lab-table-wrap"><table class="lab-table"><thead><tr><th>判断する段階</th><th>戦法</th><th>アクセル %</th><th>舵 %</th><th>傾き %</th><th>姿勢 %</th><th>R m</th><th>gap m</th></tr></thead><tbody>
 ${LAB_PHASES.map(([p,n],i)=>`<tr data-stage="${i}"><td>${i+1}. ${n}</td><td><select data-k="tactic" aria-label="${b.course}コース ${n} 戦法"${i===4?' disabled':''}>${labOptions(i===4?{auto:'通常の周回操艇'}:LAB_TACTICS,i===4?'auto':b.stages[i].tactic)}</select></td>${['thr','steer','roll','pitch','R','gap'].map(k=>`<td><input data-k="${k}" aria-label="${b.course}コース ${n} ${k}" type="number" placeholder="自動" min="${k==='thr'?0:k==='R'?8:k==='gap'?2:-100}" max="${k==='R'?35:k==='gap'?30:100}" step="${k==='R'||k==='gap'?.1:1}" value="${b.stages[i][k]??''}"></td>`).join('')}</tr>`).join('')}
 </tbody></table></div><p class="lab-note">絞りは第1マーク手前（x&lt;105m）で毎回判定。現在と1.2秒先の予測で一艇身（このモデルの当たり判定全長4.6m）以上のリードがあれば開始します。内の艇は直近の出走コースを対象とし、緩やかにその進路へ寄せます。舵の数値指定は絞りの自動操舵より優先します。各段階の指定は次段階まで有効。「前段階を継続」は戦法だけを引き継ぎます。数値操作は各段階で設定。5段階目は通常の周回戦法です。</p></details>`).join('');
 labCount();
}
function labCount(){ $('labCount').textContent=`${$('labBoats').querySelectorAll('[data-f="enabled"]:checked').length}艇を選択（2〜6艇）`; }
function labRead(){
 const c={cpuMode:$('labCpuMode').value,seed:Number($('labSeed').value),duration:Number($('labDuration').value),hz:Number($('labHz').value),approach:Number($('labApproach').value),boats:[]};
 for(const el of $('labBoats').querySelectorAll('.lab-boat')){
  const b={course:Number(el.dataset.course),stages:[]};
  for(const e of el.querySelectorAll('[data-f]')) b[e.dataset.f]=e.type==='checkbox'?e.checked:e.type==='number'?(e.value===''?NaN:Number(e.value)):e.value;
  for(const tr of el.querySelectorAll('[data-stage]')){const d={};for(const e of tr.querySelectorAll('[data-k]')) d[e.dataset.k]=e.tagName==='SELECT'?e.value:e.value===''?null:Number(e.value);b.stages.push(d);} c.boats.push(b);
 }
 return labValidate(c);
}
function labValidate(raw){
 const c=JSON.parse(JSON.stringify(raw));
 if(c.cpuMode==null)c.cpuMode='legacy';
 if(!['legacy',COURSE_CPU.version].includes(c.cpuMode))throw Error('CPU基本判断の設定が無効です。');
 const num=(v,lo,hi,n)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<lo||v>hi)throw Error(`${n} は ${lo}〜${hi} の数値で入力してください。`);return v;};
 num(c.seed,0,4294967295,'シード');if(!Number.isInteger(c.seed))throw Error('シードは整数で入力してください。');
 num(c.duration,5,120,'検証時間');num(c.approach,40,120,'手前位置');if(![20,60,120].includes(c.hz))throw Error('記録間隔が無効です。');
 if(!Array.isArray(c.boats)||c.boats.length!==6)throw Error('6コース分の条件が必要です。');
 const active=c.boats.filter(b=>b.enabled);if(active.length<2||active.length>6)throw Error('走らせるコースを2〜6艇選んでください。');
 const courses=new Set();
 for(const b of c.boats){
  if(b.squeezeMode==null)b.squeezeMode='legacy'; // preserve old recordings
  if(!['lead','never','legacy'].includes(b.squeezeMode))throw Error('絞りの設定が無効です。');
  if(b.contactMode==null)b.contactMode='normal'; // old logs replay with original policy
  if(!['normal','priority'].includes(b.contactMode))throw Error('接触への対応が無効です。');
  num(b.course,1,6,'コース');if(!Number.isInteger(b.course)||courses.has(b.course))throw Error('コースが重複しています。');courses.add(b.course);
  if(typeof b.enabled!=='boolean'||!['A1','A2','B1','B2','TOP','KINEN'].includes(b.grade)||!['calm','normal','aggr'].includes(b.temper)||!['slow','dash','kado'].includes(b.style)||!Object.hasOwn(LAB_TACTICS,b.plan)||b.plan==='keep')throw Error('選手条件が無効です。');
  for(const [k,lo,hi] of [['x',-40,110],['y',3,46],['speed',0,95],['st',0,.99],['motor',.8,1.2]])num(b[k],lo,hi,`${b.course}コース ${k}`);
  if(!Array.isArray(b.stages)||b.stages.length!==5)throw Error('5段階分の判断が必要です。');
  for(const [i,d] of b.stages.entries()){
   if(!Object.hasOwn(LAB_TACTICS,d.tactic))throw Error('戦法が無効です。');if(i===4)d.tactic='auto';
   for(const k of ['thr','steer','roll','pitch','R','gap'])if(d[k]!==null)num(d[k],k==='thr'?0:k==='R'?8:k==='gap'?2:-100,k==='R'?35:k==='gap'?30:100,`${b.course}コース 段階${i+1} ${k}`);
   if(d.R!=null&&d.gap!=null&&d.gap>d.R)throw Error('gap は R 以下にしてください。');
  }
 }
 c.boats.sort((a,b)=>a.course-b.course);return c;
}
function labOpen(){
 if(lab.active){paused=true;lab.accumulator=0;}
 else {lab.previousPaused=paused;paused=true;}
 if(!lab.config)labFill(labDefault());
 $('labError').textContent='';$('labSetup').hidden=false;$('labSetupExport').disabled=!lab.data;
}
function labCloseSetup(){ $('labSetup').hidden=true;if(!lab.active)paused=lab.previousPaused||false;last=performance.now(); }
function labBegin(c){
 c=labValidate(c);lab.config=c;lab.active=true;lab.finished=false;lab.accumulator=0;lab.steps=0;lab.rng=c.seed>>>0;lab.rate=Number($('labRate').value)||1;lab.view=$('labView').value||'all';lab.uiAt=-1;
 lab.data={schema:'honor-for-gp.d42.behavior-log',version:1,engine:'d42 + shared course CPU v1 + bow timing v1',seed:c.seed,fixedStepSeconds:1/120,sampleHz:c.hz,config:structuredClone(c),
  aiRequest:'このログを分析してください。艇・段階ごとに、指定した戦法／CPUが選択した戦法／目標入力／実際の入力と結果を区別し、握る・落とす・切りすぎ・外へ膨らむ・内へ戻る原因を、時刻と記録値を引用して説明してください。まくりに行かない原因や速度を失う場面、修正候補を挙げてください。reasonFlagsはコードで観測した状態であり、人間の選手の心理や実際の競艇の正解を示すものではありません。未記録の意図を断定しないでください。',
  definitions:{timing:'All measured gate crossings use the deck bow tip (local x=2.25m), with position and heading interpolated within each physics step. Finishers are sorted by crossing time. Configured lab ST remains supplied, not measured.',phases:LAB_PHASES.map(([id,label,trigger])=>({id,label,trigger})),units:{time:'s',position:'m; x=0 start, 1M=(150,0), y>0 home straight',speed:'km/h; hypot(v,vl)*3.6',forwardSpeed:'m/s (hull longitudinal)',lateralSpeed:'m/s',heading:'deg; initial 0, left negative',yaw:'deg/s; hull angular velocity',acceleration:'m/s²; derivative of ground speed, averaged over sample interval',forwardAcceleration:'m/s²; derivative of hull longitudinal speed over sample interval',angularAcceleration:'deg/s²; difference of hull yaw rate over sample interval',input:'thr 0..1; steer/roll/pitch -1..1; negative = left/upright, positive = right/crouch',target:'world point m; R and gap describe d42 trajectory, not measured turning radius'},
   courseCpu:'course-v1 uses common demo/lab course priors, 0.20s observations, 1.2s constant-velocity prediction, score hysteresis and turn commitment. Trajectories change smoothly. makurisashi has outside-entry then observed-slot threading, closed slots cause throttle reduction. Desired controls still pass original actuator smoothing and contact avoidance. CPU tactics are intentions, not official result classifications. Rules are heuristic tuning values, not measured racer probabilities. cpuMode missing imports as legacy. courseDecision includes base/actual/forced, scores and observations; courseLine includes R/gap and stage.',
   contactAvoidance:'Per-boat contactMode normal preserves d42. priority increases prediction clearance, includes attack targets in avoidance, suppresses deliberate dump/resist and legacy squeeze; explicit lead squeeze remains subject to avoidance, and evaluates desired controls and alternative throttle/steering/posture with d42 physics rollouts over 1.44 seconds, recomputed every 0.075 seconds, after tactic/manual overrides. Original response smoothing applies. Predictions hold other boats current controls and use mean random perturbation; they do not change race RNG. Contact physics is unchanged; collisions remain possible. Old logs without contactMode import as normal. trace.contactAvoidance records threats, desired inputs before priority, and whether the cap intervened.',
   squeeze:'Per-boat squeezeMode: lead requests inward movement once current longitudinal center lead >= one modeled hull length (PLAN_HULL.aft+PLAN_HULL.fwd+2*PLAN_HULL.r = 4.6m) and lead projected at current ground velocities over 1.2s also >= that length. Rechecked every step on first straight until x=105m. Target is nearest occupied inner course, while physically inside. Smooth inward target, maximum intended heading deviation 0.12rad; original actuator smoothing, numeric overrides and priority avoidance still apply. never disables tactical squeeze only; legacy preserves previous logic. Missing field imports as legacy. trace.squeezeDecision and squeeze_decision events include reason, measured/projected lead and target. Predictions are estimates, not guaranteed outcomes.',
   scope:'Slit snapshot, not pit/start simulation. ST is supplied context, not measured. Fixed d42 water, wakes, collisions and caution rules. Nearest occupied inner/outer course supplies neighboring context in reduced fleets. Overrides replace desired inputs before original response smoothing, only in active racing. Caution/out/retirement takes priority. Initial throttle=1 and cruise posture.',
   decisions:'autoCandidate is d42 candidate at this step, conditional on previous forced history, not an independent counterfactual run. chosenTactic is tactic actually used. targetInputs are after overrides; cpuTargets are before numeric overrides but after chosen tactic. samples show actual applied controls, including IDLE on an out boat.',
   replay:'Same config and seed on the same engine/browser reproduces fixed steps. Frame rate and playback rate do not change simulation steps. Nominal sampling interval may include extra snapshots at manual single steps and run end. State at t is after physics; decisionAt is the start of that step. Metadata such as export time is not part of determinism.'},cpuRules:structuredClone(COURSE_CPU),profiles:[],events:[],samples:[],status:'running'};
 time=0;SS.phase='off';SS.t0=-CLOCK;SS.hideAt=0;wake.length=0;spray.length=0;ptrs.clear();keys.clear();hapticsStop();
 lab.inSim=true;
 try{
  const firstDash=c.boats.filter(b=>b.enabled&&b.style!=='slow').map(b=>b.course).sort((a,b)=>a-b)[0];
  const rows=c.boats.filter(b=>b.enabled).map(b=>{
   const r={no:b.course,prof:DRIVERS.find(d=>b.grade==='KINEN'?d.kinen:d.name===b.grade),pref:'waku',temper:b.temper,motor:{deashi:b.motor},col:LANE_COL[b.course-1],labConfig:b,labPhase:-1};
   applyCourse(r,b.course,b.style==='slow',c.cpuMode===COURSE_CPU.version?b.course===firstDash:b.style==='kado',100);
   r.trait.contactMode=b.contactMode;r.trait.squeezeMode=b.squeezeMode;
   if(b.plan!=='auto'){r.trait.tactic=b.plan;r.trait.preferredTactic=b.plan;}
   r.b={x:b.x,y:b.y,a:0,v:b.speed/3.6,vl:0,yaw:0,porp:0,cap:0,thrMul:b.motor};raceFieldsInit(r);r.st=b.st;r.drv.mem.go=true;Object.assign(r.inp,{thr:1,pitch:r.prof.cruise});
   r.labApplied={...r.inp};r.labPrev={t:0,speed:b.speed/3.6,v:r.b.v,yaw:0};
   lab.data.profiles.push({boat:r.no,profile:{...r.prof},trait:{...r.trait}});return r;
  });
  fleet=freshFleet(rows);fleet.focus=rows[0].no;fleet.raceStart=0;
 }finally{lab.inSim=false;}
 running=true;paused=false;cam.x=fleet.boats[0].b.x;cam.y=fleet.boats[0].b.y;
 for(const id of ['start','settings','card','waku','meas','rotate','clock'])if($(id))$(id).hidden=true;
 $('labSetup').hidden=true;$('labRun').hidden=false;document.body.classList.add('lab-running');
 $('labFocus').innerHTML=fleet.boats.map(r=>`<option value="${r.no}">${r.no}号艇 / ${r.no}コース</option>`).join('');
 resize();last=performance.now();labEvent('start',null,{label:'検証開始',seed:c.seed});labSample(true);labUpdate(true);
}
function labEvent(type,boat,data={}){
 if(!lab.active||!lab.data||lab.finished)return;
 lab.data.events.push({id:lab.data.events.length,t:Number(time.toFixed(6)),step:lab.steps,type,boat,...data});
}
function labBeforeDrive(r,env){
 const b=r.b;let phase=r.labPhase;
 if(phase<0)phase=0;
 if(phase===0&&b.x>=lab.config.approach)phase=1;
 if(phase===1&&b.x>115&&b.yaw< -7*D2R)phase=2;
 if(phase===2&&b.a< -135*D2R)phase=3;
 if(phase===3&&b.a< -160*D2R&&b.x<135&&b.y<0)phase=4;
 if(phase!==r.labPhase){r.labPhase=phase;const d=r.labConfig.stages[phase];r.labTactic=d.tactic==='keep'?(r.labTactic&&r.labTactic!=='auto'?r.labTactic:r.drv.mem.tacticNow||r.trait.tactic):d.tactic;
  labEvent('phase',r.no,{decisionAt:time-1/120,phase:LAB_PHASES[phase][0],label:LAB_PHASES[phase][1],requested:{...d},resolvedTactic:r.labTactic,position:{x:b.x,y:b.y},speedKmh:Math.hypot(b.v,b.vl)*3.6});
 }
 env.labDirective={...r.labConfig.stages[phase],tactic:r.labTactic};
 r.labDecisionAt=time-1/120;
 env.labObservations={inner:env.inner?{x:env.inner.x,y:env.inner.y,v:env.inner.v}:null,outer:env.outer?{x:env.outer.x,y:env.outer.y,v:env.outer.v}:null,stAdv:env.stAdv,outerPlan:env.outerPlan,battle:env.battle};
}
// Local candidate rollouts use the same d42 hull physics, without advancing the race RNG.
function labHullClearance(a,b){
 const ca=Math.cos(a.a),sa=Math.sin(a.a),cb=Math.cos(b.a),sb=Math.sin(b.a);
 const [x,y,u,v]=closestSegSeg(a.x-ca*PLAN_HULL.aft,a.y-sa*PLAN_HULL.aft,a.x+ca*PLAN_HULL.fwd,a.y+sa*PLAN_HULL.fwd,b.x-cb*PLAN_HULL.aft,b.y-sb*PLAN_HULL.aft,b.x+cb*PLAN_HULL.fwd,b.y+sb*PLAN_HULL.fwd);
 return Math.hypot(x-u,y-v)-2*PLAN_HULL.r;
}
// A tactical request, not a collision override. Track center lead along the start straight.
function labSqueezeDecision(b,env,mem,mode,first,look){
 const q=env.inner,threshold=PLAN_HULL.aft+PLAN_HULL.fwd+2*PLAN_HULL.r,horizon=1.2;
 const lead=q?b.x-q.x:null;
 const vx=v=>v.v*Math.cos(v.a)-v.vl*Math.sin(v.a);
 const predicted=q?lead+(vx(b)-vx(q))*horizon:null;
 const within=first&&b.y>0&&b.x>=0&&b.x<MK-45;
 const detail={mode,active:false,reason:'outside_window',innerBoat:q?(fleet?.boats.find(r=>r.b===q)?.no??null):null,leadM:lead,predictedLeadM:predicted,thresholdM:threshold,horizonSeconds:horizon,targetY:null};
 const previous=mem.squeeze;let targetY=null;
 mem.squeeze=null;
 if(mode==='never')detail.reason='disabled';
 else if(within){
  // Hold the current straight line while waiting, instead of diving in before the threshold.
  targetY=b.y;
  if(!q||q.cap>0){detail.reason='no_inner_boat';targetY=null;}
  else if(q.y<=0||q.x>=MK-45||Math.abs(q.a)>.35)detail.reason='inner_turning';
  else if(b.y-q.y<=.4)detail.reason='line_reached';
  else if(lead<threshold)detail.reason='lead_short';
  else if(predicted<threshold)detail.reason='lead_closing';
  else {
   detail.active=true;detail.reason='lead_clear';mem.squeeze=q;
   // Target the inner boat's line, approaching it gently from the outside.
   targetY=Math.max(q.y,b.y-Math.tan(.12)*look);
  }
 }
 detail.targetY=targetY;
 return{targetY,detail,started:detail.active&&previous!==q};
}
// d181 (まえ: contact is racing): side-to-side (headings within sideAng) may close to sideClr and only an overlap past sideHard
// counts as a crash; a bow into a side or a pile-up still keeps the full clearance
const PRIO = { clr: 1.15, sideAng: 0.5, sideClr: 0.0, sideHard: -0.3 };
function labPriorityPlan(b,env,desired,mem,prof,applied){
 const nearby=fleet.boats.filter(r=>r.b!==b&&Math.hypot(r.b.x-b.x,r.b.y-b.y)<40);
 if(!nearby.length){mem.labSafe=null;return{inputs:desired,detail:{enabled:true,intervened:false,threats:[]}};}
 if(mem.labSafe&&time<mem.labSafe.until){
  const plan=mem.labSafe;
  if(plan.detail.intervened){const inputs={...plan.inputs,thr:Math.min(desired.thr,plan.inputs.thr)};return{inputs,detail:{...plan.detail,beforePriority:{...desired},throttleCeiling:inputs.thr,intervened:['thr','steer','roll','pitch'].some(k=>Math.abs(inputs[k]-desired[k])>1e-6)}};}
  return{inputs:desired,detail:plan.detail};
 }
 const dt=.08,N=18,clearance=PRIO.clr;
 const others=[];lab.predicting=true;
 try{
  for(const r of nearby){const q={...r.b},o=r.out?IDLE_INPUT:r.inp;const path=[];for(let j=0;j<N;j++){boatPhysics(q,o,dt);path.push({...q});}others.push({boat:r.no,path});}
  const evaluate=(target)=>{
   const q={...b},o={thr:applied.thr,steer:applied.steer,roll:applied.roll,pitch:applied.pitch};
   let risk=0,minGap=Infinity,threat=null,at=0,obstacle=false;
   for(let j=0;j<N;j++){
    o.thr+=(target.thr-o.thr)*(1-Math.exp(-6*dt));o.steer+=(target.steer-o.steer)*(1-Math.exp(-prof.react*(mem.emergency>0?3:1.6)*dt));
    o.roll+=(target.roll-o.roll)*(1-Math.exp(-prof.react*dt));o.pitch+=(target.pitch-o.pitch)*(1-Math.exp(-prof.react*dt));
    const ev=boatPhysics(q,o,dt);if(ev){obstacle=true;risk+=25000;}
    if(q.y<COURSE.yMin+3||q.y>COURSE.yMax-3)risk+=1000;
    for(const other of others){const op=other.path[j],gap=labHullClearance(q,op),side=Math.abs(wrapRad(q.a-op.a))<PRIO.sideAng;
     const clr=side?PRIO.sideClr:clearance,hard=side?PRIO.sideHard:.05;
     if(gap<minGap){minGap=gap;threat=other.boat;at=(j+1)*dt;}
     if(gap<clr)risk+=(clr-gap)**2*100*(1.4-j/N);
     if(gap<hard)risk+=3000*(1.5-j/N);
    }
   }
   const deviation=(target.thr-desired.thr)**2*8+(target.steer-desired.steer)**2*18+(target.roll-desired.roll)**2*3+(target.pitch-desired.pitch)**2*2;
   return{score:risk+deviation,minGap,threat,at,obstacle,inputs:target};
  };
  const initial=evaluate({...desired});let best=initial;
  if(initial.score>0){   // d181: any predicted conflict (initial has no deviation, so score = risk)
   const steers=[desired.steer,clamp(desired.steer+.35),clamp(desired.steer-.35),0,.6,-.6];
   for(const thr of [desired.thr,Math.min(desired.thr,.35),0])for(const steer of steers){
    const target={...desired,thr,steer};
    if(Math.abs(steer-desired.steer)>.15){target.roll=Math.abs(steer)>.1?Math.sign(steer)*Math.min(.9,Math.abs(desired.roll)):desired.roll*.4;}
    if(thr<.1)target.pitch=Math.min(target.pitch,0);
    const cand=evaluate(target);if(cand.score<best.score)best=cand;
   }
  }
  const changed=['thr','steer','roll','pitch'].some(k=>Math.abs(best.inputs[k]-desired[k])>1e-6);
  const detail={enabled:true,evaluatedAt:time,intervened:changed,throttleCeiling:best.inputs.thr,beforePriority:{...desired},predictedGapBefore:initial.minGap,predictedGapAfter:best.minGap,horizonSeconds:N*dt,clearanceM:clearance,threats:initial.score>0?[{boat:initial.threat,predictedGapM:initial.minGap,atSeconds:initial.at}]:[],reason:changed?'predicted_hull_conflict':'clear'};
  mem.labSafe={until:time+.075,inputs:best.inputs,detail};return{inputs:best.inputs,detail};
 }finally{lab.predicting=false;}
}

function labTraceInputs(mem,env,targets,b,prof,applied){
 const before={...targets},d=env.labDirective;
 if(d)for(const k of ['thr','steer','roll','pitch'])if(d[k]!=null)targets[k]=d[k]/100;
 const beforePriority={...targets}, av=mem.av;
 const plan=av?.priority?labPriorityPlan(b,env,targets,mem,prof,applied):null;
 if(plan)Object.assign(targets,plan.inputs);
 const contactAvoidance=plan?plan.detail:{enabled:false,intervened:false,threats:[]};
 mem.labTrace={...(mem.labTrace||{}),cpuTargets:before,targetInputs:{...targets},contactAvoidance,reasonFlags:{contactPriority:contactAvoidance.intervened,avoidThrottle:mem.av?.thrMul<.999,avoidSteer:Math.abs(mem.av?.steerAdd||0)>.001,emergency:mem.emergency>0,brace:mem.brace>0,nigeDrop:!!mem.nigeDrop,sashiDrop:!!mem.sashiDrop,push:!!mem.push,dumping:mem.dumpT>0,squeeze:!!mem.squeeze,resist:!!mem.resistQ,yield:mem.sqResp==='yield'&&mem.sqRespT>0,exitHold:!!mem.exitHold},numericOverride:!!(d&&['thr','steer','roll','pitch'].some(k=>d[k]!=null))};
 return targets;
}
function labAfterDrive(r,o,env){
 const tr=r.drv.mem.labTrace||{};r.labApplied={thr:o.thr,steer:o.steer,roll:o.roll,pitch:o.pitch};
 const key=JSON.stringify([r.labPhase,tr.chosenTactic,tr.mode,tr.reasonFlags,tr.numericOverride]);
 if(r.labKey!==key){r.labKey=key;labEvent('decision',r.no,{phase:LAB_PHASES[r.labPhase][0],label:tr.mode==='racing'?(TACTIC_JA[tr.chosenTactic]||'通常周回'):tr.mode,trace:structuredClone(tr),observations:env.labObservations,applied:{...r.labApplied}});}
 const throttle=tr.targetInputs?.thr;
 if(throttle!=null){const band=throttle>=.95?'全速で握る':throttle<=.05?'レバーを閉じる':'アクセルを落とす';if(band!==r.labThrottleBand){r.labThrottleBand=band;labEvent('throttle',r.no,{label:band,target:throttle,actual:o.thr});}}
 const cd=tr.courseDecision;
 const cdKey=cd?JSON.stringify([cd.phase,cd.actualTactic,cd.reason,cd.forced,tr.courseLine?.stage]):'inactive';
 if(cd&&r.labCourseKey!==cdKey){r.labCourseKey=cdKey;labEvent('course_decision',r.no,{label:`${cd.course}コース ${TACTIC_JA[cd.actualTactic]}：${cd.forced?'指定戦法':CPU_REASON_JA[cd.reason]||cd.reason}`,decision:structuredClone(cd),line:structuredClone(tr.courseLine||null)});}
 const sq=tr.squeezeDecision;
 const sqKey=sq?JSON.stringify([sq.mode,sq.reason,sq.innerBoat]):'inactive';
 if(r.labSqueezeKey!==sqKey){
  if(sq)labEvent('squeeze_decision',r.no,{label:({disabled:'絞らない',outside_window:'絞りの判定区間外',no_inner_boat:'対象の内艇なし',inner_turning:'内艇が旋回へ移行',line_reached:'内の進路に到達',lead_short:'一艇身のリード待ち',lead_closing:'リードを保てない予測のため見送り',lead_clear:'一艇身先行・内へ絞る'})[sq.reason],...structuredClone(sq)});
  r.labSqueezeKey=sqKey;
 }
 const priority=tr.contactAvoidance;
 const priorityKey=priority?.intervened?(priority.threats||[]).map(q=>q.boat).sort().join(','):'off';
 if(r.labPriorityKey!==priorityKey){
  if(priorityKey!=='off')labEvent('contact_avoidance',r.no,{label:'接触回避を優先',...structuredClone(priority)});
  else if(r.labPriorityKey&&r.labPriorityKey!=='off')labEvent('contact_avoidance_clear',r.no,{label:'回避操作を解除'});
  r.labPriorityKey=priorityKey;
 }
 if(o.ev)labEvent('driver_event',r.no,{label:o.ev});
}
function labSample(force=false){
 if(!force&&lab.steps%(120/lab.config.hz)!==0)return;
 if(lab.data.samples.length&&lab.data.samples.at(-1).step===lab.steps)return;
 const boats=fleet.boats.map(r=>{
  const b=r.b,sp=Math.hypot(b.v,b.vl),prev=r.labPrev,dt=time-prev.t;
  const sample={boat:r.no,phase:LAB_PHASES[Math.max(0,r.labPhase)][0],decisionAt:r.labDecisionAt??null,x:b.x,y:b.y,heading:b.a/D2R,speed:sp*3.6,forwardSpeed:b.v,lateralSpeed:b.vl,yaw:b.yaw/D2R,acceleration:dt>0?(sp-prev.speed)/dt:0,forwardAcceleration:dt>0?(b.v-prev.v)/dt:0,angularAcceleration:dt>0?(b.yaw-prev.yaw)/D2R/dt:0,turnRadius:Math.abs(b.yaw)>.01?sp/Math.abs(b.yaw):null,applied:{...r.labApplied},trace:r.out?null:structuredClone(r.drv.mem.labTrace||null),load:b.load||0,inWake:b.inWake||0,trail:b.trail||0,status:{out:r.out||null,dq:!!r.dq,caution:!!fleet.caution,insideCourse:!!r.relegated}};
  r.labPrev={t:time,speed:sp,v:b.v,yaw:b.yaw};r.labSample=sample;return sample;
 });
 lab.data.samples.push({t:Number(time.toFixed(6)),step:lab.steps,boats});
}
function labStep(){
 if(!lab.active||lab.finished)return;lab.inSim=true;lab.steps++;
 try{fleetStep(1/120,input);}catch(e){labEvent('error',null,{label:String(e)});labFinish('実行エラー');throw e;}finally{lab.inSim=false;}
 labSample();
 if(time+1e-8>=lab.config.duration)labFinish('設定時間に到達');
 else if(fleet.boats.every(r=>r.out))labFinish('全艇が航走不能');
}
function labFinish(reason){
 if(lab.finished)return;labSample(true);labEvent('end',null,{label:reason});lab.finished=true;paused=true;lab.data.status='finished';lab.data.endReason=reason;lab.data.elapsed=time;lab.accumulator=0;labUpdate(true);
}
function labExport(){
 if(!lab.data)return;const out=structuredClone(lab.data);out.status=lab.finished?'finished':'partial';out.elapsed=out.samples.at(-1)?.t||0;
 out.summary={samples:out.samples.length,events:out.events.length,boats:out.profiles.map(p=>{const a=out.samples.flatMap(s=>s.boats.filter(b=>b.boat===p.boat));return{boat:p.boat,maxSpeedKmh:Math.max(...a.map(b=>b.speed)),minSpeedKmh:Math.min(...a.map(b=>b.speed)),minAcceleration:Math.min(...a.map(b=>b.acceleration)),maxAbsYawDegS:Math.max(...a.map(b=>Math.abs(b.yaw))),final:a.at(-1)};})};
 const blob=new Blob([JSON.stringify(out,(k,v)=>typeof v==='number'?Number(v.toFixed(6)):v,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download=`d42-lab-seed${out.seed}-${Date.now()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function labUpdate(force=false){
 if(!lab.active)return;const now=performance.now();if(!force&&now-lab.uiAt<100)return;lab.uiAt=now;
 $('labTime').textContent=`${time.toFixed(3)} s`;$('labStatus').textContent=lab.finished?`終了：${lab.data.endReason}`:paused?'一時停止 / 記録を保持':'記録中 / 固定ステップ 120 Hz';
 $('labPause').textContent=paused?'再開':'一時停止';$('labPause').disabled=lab.finished;$('labStep').disabled=!paused||lab.finished;$('labStop').disabled=lab.finished;
 const r=focusRow(),s=r?.labSample;if(!s)return;
 $('labV').textContent=s.speed.toFixed(1);$('labAccel').textContent=s.acceleration.toFixed(1);$('labYaw').textContent=s.yaw.toFixed(1);
 const tr=s.trace,op=s.applied;
 $('labDetail').innerHTML=`<b>${r.no}号艇 · ${LAB_PHASES[Math.max(0,r.labPhase)][1]}</b><br>戦法：${labEscape(tr?.chosenTactic?(TACTIC_JA[tr.chosenTactic]||tr.chosenTactic):'—')} / ${tr?.contactAvoidance?.intervened?'接触回避を優先中':tr?.numericOverride?'操作指定あり':'CPU操作'}<br>${tr?.courseDecision?`基本：${labEscape(tr.courseDecision.baseLabel)} / ${labEscape(CPU_REASON_JA[tr.courseDecision.reason]||tr.courseDecision.reason)}<br>`:''}${tr?.squeezeDecision?`絞り：${tr.squeezeDecision.active?'内へ寄せる':({disabled:'しない',outside_window:'判定区間外',no_inner_boat:'対象なし',inner_turning:'内艇が旋回へ移行',line_reached:'進路到達',lead_short:'一艇身のリード待ち',lead_closing:'リード維持を見込めず見送り'})[tr.squeezeDecision.reason]}${tr.squeezeDecision.leadM!=null?` / リード ${tr.squeezeDecision.leadM.toFixed(1)}m`: ''}<br>`:''}アクセル ${(op.thr*100).toFixed(0)}% ・ 舵 ${(op.steer*100).toFixed(0)}%<br>傾き ${(op.roll*100).toFixed(0)}% ・ 姿勢 ${(op.pitch*100).toFixed(0)}%<br>${tr?.target?`狙い x=${tr.target.x.toFixed(1)}, y=${tr.target.y.toFixed(1)} m`:'目標点 —'}<br>${s.status.out||s.status.dq?'事故・失格':s.status.caution?'事故後の徐行':'航走中'} / 引き波 ${s.inWake.toFixed(2)} / 負荷 ${s.load.toFixed(2)}`;
 const events=lab.data.events.filter(e=>e.boat===r.no||e.boat==null).slice(-16).reverse();
 $('labEvents').innerHTML=events.map(e=>`<li><span style="color:#83caba">${e.t.toFixed(3)}s</span> ${labEscape(e.boat?`${e.boat}号艇 `:'')}${labEscape(e.label||e.type)}${e.trace?.targetInputs?` · 目標アクセル ${(e.trace.targetInputs.thr*100).toFixed(0)}%`:''}</li>`).join('');
 const canvas=$('labChart'),g=canvas.getContext('2d'),w=canvas.width,h=canvas.height;g.clearRect(0,0,w,h);g.strokeStyle='#284650';g.lineWidth=1;for(let i=0;i<=4;i++){g.beginPath();g.moveTo(0,15+i*55);g.lineTo(w,15+i*55);g.stroke();}
 const a=lab.data.samples.filter(s=>s.t>=time-10).map(s=>({t:s.t,b:s.boats.find(b=>b.boat===r.no)}));
 for(const [col,get] of [['#a5eed6',b=>b.speed/100],['#ffcf75',b=>b.applied.thr]]){g.strokeStyle=col;g.lineWidth=3;g.beginPath();a.forEach((s,i)=>{const x=(s.t-Math.max(0,time-10))/10*w,y=h-15-get(s.b)*(h-30);if(i)g.lineTo(x,y);else g.moveTo(x,y);});g.stroke();}
}
function labDrawGuides(){
 if(!$('labGuide').checked||!lab.data)return;
 const a=lab.data.samples.filter(s=>s.t>=time-15);
 for(const r of fleet.boats){
  ctx.strokeStyle=r.col[0];ctx.globalAlpha=.65;ctx.lineWidth=.15;ctx.setLineDash([]);ctx.beginPath();
  a.forEach((s,i)=>{const b=s.boats.find(b=>b.boat===r.no);if(i)ctx.lineTo(b.x,b.y);else ctx.moveTo(b.x,b.y);});ctx.stroke();
  const target=r.drv.mem.labTrace?.target;
  if(target&&!r.out){ctx.globalAlpha=.8;ctx.setLineDash([.8,.65]);ctx.beginPath();ctx.moveTo(r.b.x,r.b.y);ctx.lineTo(target.x,target.y);ctx.stroke();ctx.setLineDash([]);ctx.beginPath();ctx.arc(target.x,target.y,.9,0,Math.PI*2);ctx.stroke();}
 }
 ctx.globalAlpha=1;ctx.setLineDash([]);
}
function labExit(){
 if(!lab.finished&&lab.active)labFinish('通常モードへ移動');lab.active=false;lab.inSim=false;fleet=null;running=false;paused=false;keys.clear();ptrs.clear();
 $('labRun').hidden=true;$('labSetup').hidden=true;document.body.classList.remove('lab-running');$('start').hidden=false;resetBoat();refreshFleetUi();resize();last=performance.now();
}
$('labLaunch').addEventListener('click',labOpen);$('labLaunchStart').addEventListener('click',labOpen);
$('labSetupClose').addEventListener('click',labCloseSetup);$('labConfigure').addEventListener('click',labOpen);
$('labBoats').addEventListener('change',labCount);$('labBoats').addEventListener('click',e=>{if(e.target.closest('label'))e.stopPropagation();});
$('labCoursePreset').addEventListener('click',()=>{const c=labDefault();for(const b of c.boats){b.enabled=true;b.x=0;b.st=.12;}c.boats[3].style='kado';labFill(c);});
$('labPreset').addEventListener('click',()=>labFill(labDefault()));
$('labAvoidAll').addEventListener('click',()=>{for(const e of $('labBoats').querySelectorAll('[data-f="contactMode"]'))e.value='priority';});
$('labAll').addEventListener('click',()=>{for(const e of $('labBoats').querySelectorAll('[data-f="enabled"]')){e.checked=true;e.closest('details').open=true;}labCount();});
$('labStart').addEventListener('click',()=>{try{labBegin(labRead());}catch(e){$('labError').textContent=e.message;}});
$('labPause').addEventListener('click',()=>{paused=!paused;lab.accumulator=0;last=performance.now();labUpdate(true);});
$('labStep').addEventListener('click',()=>{if(paused&&!lab.finished){labStep();labSample(true);labUpdate(true);draw();}});
$('labStop').addEventListener('click',()=>labFinish('手動終了'));$('labExit').addEventListener('click',labExit);
$('labRate').addEventListener('change',()=>{lab.rate=Number($('labRate').value);lab.accumulator=0;});
$('labView').addEventListener('change',()=>{lab.view=$('labView').value;});
$('labFocus').addEventListener('change',()=>{fleet.focus=Number($('labFocus').value);labUpdate(true);});
for(const id of ['labExport','labSetupExport'])$(id).addEventListener('click',labExport);
$('labRestart').addEventListener('click',()=>labBegin(lab.config));
$('labImport').addEventListener('click',()=>$('labFile').click());
$('labFile').addEventListener('change',async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>256*1024*1024)throw Error('読込上限は256MBです。');const d=JSON.parse(await file.text());if(d.schema!=='honor-for-gp.d42.behavior-log'||d.version!==1)throw Error('対応するd42挙動検証ログを選んでください。');labFill(labValidate(d.config));$('labError').textContent='条件を読み込みました。開始ボタンで再実行できます。';}catch(err){$('labError').textContent=err.message;}finally{e.target.value='';}});
labFill(labDefault());
try{setControlMode(localStorage.getItem('honorGP.controlMode')||(localStorage.getItem('honorGP.virtualPosture')==='1'?'pad':'tilt'),false);}catch(_){setControlMode('tilt',false);}

/* ---------- loop ---------- */
/* ---------- 節間モード (6日間: 前検 → 予選4日 → 準優 → 優勝戦) ----------
   48 riders (you + 47 CPU). 前検: motor lottery. 予選 days 1–4: 12 races a day, 6 rides each (1 or 2 a day,
   every 枠 about once), 着順点 10/8/6/4/2/1 → 得点率. F / L = 賞典除外. Day 5: top 18 → 準優 10–12R.
   Day 6: 準優 1・2着 → 優勝戦 12R. Races you are not in are worked out instantly (or watched on the water);
   your own you ride yourself or leave to おまかせ (safe riding: no F, but it costs places). */
