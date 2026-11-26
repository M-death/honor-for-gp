/** glTF axes: +X starboard, +Y up, -Z bow. One clone per boat; textures/geometry shared. */
import * as THREE from 'three';
import { GLTFLoader } from '../viewer/vendor/GLTFLoader.js';
import { clone } from '../viewer/vendor/SkeletonUtils.js';
import { RacerPose } from './racer_pose.js';
export const LANE_COLORS=['#eeeeee','#20242a','#d73533','#2867bd','#e6c128','#20844f'];
/* d369 (まえ: 本編のレーサーをリプレイ作成に合わせたい): the realistic racers of replay 0.37 (material RacerReal). Their colours as in
   0.37 (realistic_colors.py): the outer vest = 勝負服 in the lane colour, the collar = the kapok (yellow, baked in the texture),
   the sleeves = the racer's own inner suit (SUITS, picked by racerId / name). The base texture has those zones cut out; the mask
   texture holds each zone's weight × shading / 2 (R vest, G suit, B stripe), added back here in the lane / suit colours. */
/* d376 (まえ: リプレイの最新ボートをゲームに、テクスチャーはファイルで貼る・会場ごとに固定): the boat of replay 0.43 (v4) and its
   paint sheet, standard hfgp-livery-v1 (09_designs/LIVERY_SPEC_JA.md — the same livery.json + images the replay app takes).
   No UVs: the painted parts (one material HullLivery) take their colour from a 3-panel sheet (starboard / port / top) picked by
   the surface normal, positions normalised by the hull's outer bounds. lane.png R/G = lane colour / its contrast, gloss.png =
   clear coat or matte, marks (lane number, surname, fixed text) are drawn per boat into a transparent sheet laid on top.
   The venue picks the sheet (not a setting): なにわ = liveries/naniwa, 練習場 = liveries/practice. 'lane' = no sheet, the
   whole hull in the lane colour (2D view sprites, ghosts take their tint the same way). */
export const LIVERY_DIRS={naniwa:'liveries/naniwa/',naniwa_cat:'liveries/naniwa_cat/',practice:'liveries/practice/'};   // d384: + naniwa_cat (replay side, trial period only)
const LANE_TEXT=['#111111','#f2f2ee','#f2f2ee','#f2f2ee','#111111','#f2f2ee'];
export function contrastColor(hex){   // spec 3: the lane colour's hue turned 180° (HLS); greys / white / black → near black / white
 const c=new THREE.Color(hex),hsl={};c.getHSL(hsl,THREE.SRGBColorSpace);const [r,g,b]=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);
 const mx=Math.max(r,g,b),mn=Math.min(r,g,b),l=(mx+mn)/2,s=mx===mn?0:l<=.5?(mx-mn)/(mx+mn):(mx-mn)/(2-mx-mn);
 if(s<.2||l>.9||l<.14)return l>.5?'#16181a':'#f2f2ee';
 const h=(hsl.h+.5)%1,L=Math.min(Math.max(l,.42),.56),S=Math.max(s,.6),q=L<.5?L*(1+S):L+S-L*S,p=2*L-q;
 const f=t=>{t=(t%1+1)%1;return t<1/6?p+(q-p)*6*t:t<.5?q:t<2/3?p+(q-p)*(2/3-t)*6:p;};
 return '#'+[f(h+1/3),f(h),f(h-1/3)].map(v=>Math.round(v*255).toString(16).padStart(2,'0')).join('');
}
export function surnameOf(name){name=String(name??'').trim();if(!name)return'';for(const sep of [' ','　'])if(name.includes(sep))return name.split(sep)[0].slice(0,5);return name.slice(0,4);}
const LIV_FONT='"Hiragino Kaku Gothic ProN","Hiragino Sans","Yu Gothic","YuGothic","Meiryo","Noto Sans JP","Noto Sans CJK JP",sans-serif';
const livLoads=new Map();
async function loadLivery(base,name,tier){
 const key=tier+'|'+name;if(livLoads.has(key))return livLoads.get(key);
 const p=(async()=>{
  const dir=new URL(LIVERY_DIRS[name],base),j=await fetch(new URL('livery.json',dir)).then(r=>{if(!r.ok)throw new Error('livery.json '+name);return r.json();});
  if(j.schema!=='hfgp-livery-v1')throw new Error('livery schema');
  // through fetch: the game answers it from the embedded copy (js/hfgp3d-glb.js) when it has one, else from the network
  const img=src=>fetch(new URL(src,dir)).then(r=>{if(!r.ok)throw new Error(src);return r.blob();}).then(b=>new Promise((ok,ng)=>{const u=URL.createObjectURL(b),i=new Image();i.onload=()=>{URL.revokeObjectURL(u);ok(i);};i.onerror=()=>{URL.revokeObjectURL(u);ng(new Error(src));};i.src=u;}));
  // sheet sizes: phone base 2048 / lane 1024 / no gloss (constant shine), PC base 4096 / lane, gloss 2048 (spec 7.5, 7.6)
  const tex=(im,max,srgb)=>{let t;const s=Math.min(max,im.naturalWidth);
   if(s<im.naturalWidth){const c=document.createElement('canvas');c.width=c.height=s;c.getContext('2d').drawImage(im,0,0,s,s);t=new THREE.CanvasTexture(c);}else{t=new THREE.Texture(im);t.needsUpdate=true;}
   t.colorSpace=srgb?THREE.SRGBColorSpace:THREE.NoColorSpace;t.wrapS=t.wrapT=THREE.ClampToEdgeWrapping;t.anisotropy=4;return t;};
  const pc=tier==='pc1080ti',I=j.images||{};
  const [b,l,g]=await Promise.all([img(I.base),I.lane?img(I.lane):null,I.gloss&&pc?img(I.gloss):null]);
  return {json:j,base:tex(b,pc?4096:2048,true),lane:l?tex(l,pc?2048:1024,false):null,gloss:g?tex(g,2048,false):null};
 })();
 livLoads.set(key,p);p.catch(e=>{console.warn('[livery]',e.message);livLoads.delete(key);});return p;
}
let livBlack=null,livWhite=null;
const px1=v=>{const t=new THREE.DataTexture(new Uint8Array([v,v,v,v]),1,1);t.needsUpdate=true;return t;};
function liveryShader(m,u){
 m.userData.liv=u;m.customProgramCacheKey=()=>'hfgpLivery';
 m.onBeforeCompile=sh=>{Object.assign(sh.uniforms,u);
  sh.vertexShader='varying vec3 vLivPos;\nvarying vec3 vLivNrm;\n'+sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n vLivPos = vec3( position.x, -position.z, position.y ); vLivNrm = vec3( objectNormal.x, -objectNormal.z, objectNormal.y );');
  sh.fragmentShader=`uniform sampler2D livBase, livLane, livGloss, livMarks;
uniform vec3 livLaneCol, livContrastCol; uniform vec4 livB; uniform float livHalf, livOn, livR;
varying vec3 vLivPos; varying vec3 vLivNrm;
vec4 livSample( sampler2D t, vec2 a, vec2 b, vec2 c, vec3 w ) { return texture2D( t, a ) * w.x + texture2D( t, b ) * w.y + texture2D( t, c ) * w.z; }
`+sh.fragmentShader.replace('#include <map_fragment>',`float livG = 1.0;
if ( livOn > 0.5 ) {
 vec3 ln = normalize( vLivNrm );
 float us = ( vLivPos.y - livB.x ) / ( livB.y - livB.x ), hs = ( vLivPos.z - livB.z ) / ( livB.w - livB.z ), xs = ( vLivPos.x + livHalf ) / ( 2.0 * livHalf );
 vec2 uvS = vec2( us, 0.75 + 0.25 * hs ), uvP = vec2( 1.0 - us, 0.5 + 0.25 * hs ), uvT = vec2( us, 0.5 * ( 1.0 - xs ) );
 vec3 lw = vec3( pow( max( ln.x, 0.0 ), 4.0 ), pow( max( -ln.x, 0.0 ), 4.0 ), pow( max( ln.z, 0.0 ), 4.0 ) + 0.5 * pow( abs( ln.y ), 4.0 ) );
 lw /= ( lw.x + lw.y + lw.z + 1e-4 );
 vec3 lc = livSample( livBase, uvS, uvP, uvT, lw ).rgb;
 vec2 lm = livSample( livLane, uvS, uvP, uvT, lw ).rg;
 lc = mix( mix( lc, livLaneCol, lm.r ), livContrastCol, lm.g );
 vec4 mk = livSample( livMarks, uvS, uvP, uvT, lw );
 lc = mix( lc, mk.rgb / max( mk.a, 1e-3 ), clamp( mk.a, 0.0, 1.0 ) );
 livG = livSample( livGloss, uvS, uvP, uvT, lw ).r;
 diffuseColor.rgb = lc;
}
#include <map_fragment>`).replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nif ( livOn > 0.5 ) roughnessFactor = mix( min( 0.85, livR + 0.5 ), livR, livG );')
   .replace('#include <lights_physical_fragment>','#include <lights_physical_fragment>\n#ifdef USE_CLEARCOAT\nif ( livOn > 0.5 ) material.clearcoat *= livG;\n#endif');};
}
/** the painted parts' outer bounds (spec 1, B), measured on the game hull like the replay measures its own: HullLivery + bottom */
function hullBounds(scene){
 const bb=new THREE.Box3(),v=new THREE.Vector3();let any=false;
 scene.traverse(o=>{if(!o.isMesh)return;const n=[].concat(o.material).map(m=>m.name.split('.')[0]);if(!n.some(k=>k==='HullLivery'||k==='BoatBottom'))return;
  const p=o.geometry.attributes.position;for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i);bb.expandByPoint(new THREE.Vector3(v.x,-v.z,v.y));}any=true;});
 return any?{ymin:bb.min.y,ymax:bb.max.y,zmin:bb.min.z,zmax:bb.max.z,half:Math.max(-bb.min.x,bb.max.x)}:null;
}
/** draws the marks of a livery for one boat into a transparent sheet (spec 5; same place on the sheet as the replay's ray-cast) */
function drawMarks(c,j,B,lane,name){
 const N=c.width,g=c.getContext('2d');g.clearRect(0,0,N,N);
 const L=B.ymax-B.ymin,H=B.zmax-B.zmin,W=2*B.half,laneHex=LANE_COLORS[lane-1];
 const col=r=>r==='lane'?laneHex:r==='contrast'?contrastColor(laneHex):r==='laneText'?LANE_TEXT[lane-1]:r;
 for(const mk of j.marks||[]){
  const text=mk.type==='number'?String(lane):mk.type==='surname'?surnameOf(name):String(mk.text||'');if(!text)continue;
  const T=mk.panel==='T',v0=mk.panel==='S'?0:mk.panel==='P'?.25:.5,vh=T?.5:.25;
  const sx=N/L,sy=vh*N/(T?W:H),hm=mk.height*(T?W:H);   // px per metre along / across, the letters' height (m)
  const K=1000;g.save();g.setTransform(sx/K,0,0,sy/K,mk.u*N,(v0+mk.v*vh)*N);   // work in mm, metre-true shapes on the stretched sheet
  if(mk.rotate)g.rotate(-mk.rotate*Math.PI/180);if(mk.italic)g.transform(1,0,-mk.italic,1,0,0);
  g.font=`900 ${K}px ${LIV_FONT}`;let me=g.measureText(text);const gh=(me.actualBoundingBoxAscent+me.actualBoundingBoxDescent)||K*.72;
  let fs=K*(hm*K)/gh;g.font=`900 ${fs}px ${LIV_FONT}`;me=g.measureText(text);
  if(mk.maxWidth&&me.width>mk.maxWidth*L*K){fs*=mk.maxWidth*L*K/me.width;g.font=`900 ${fs}px ${LIV_FONT}`;me=g.measureText(text);}
  const asc=me.actualBoundingBoxAscent||fs*.72,des=me.actualBoundingBoxDescent||0;g.textAlign='center';g.textBaseline='alphabetic';const y=(asc-des)/2;
  if(mk.edge){g.lineJoin='round';g.lineWidth=2*(mk.edgeWidth??.1)*hm*K;g.strokeStyle=col(mk.edge);g.strokeText(text,0,y);}
  g.fillStyle=col(mk.fill||'#ffffff');g.fillText(text,0,y);g.restore();
 }
}
export const SUITS=[['#1d2b4a','#e9ecef'],['#b3262e','#16181d'],['#eef0f2','#1f5fae'],['#16181d','#d4a52a'],['#1e7a55','#f1f1ec'],['#4b2a6e','#c9ccd2'],['#d8641e','#1b2740'],['#5fa8d8','#f4f4f2']];
export function suitIndex(key){let h=2166136261;for(const c of String(key??''))h=Math.imul(h^c.codePointAt(0),16777619)>>>0;return h%SUITS.length;}
function realShader(m,mask,lane){
 const u={realMask:{value:mask},realLane:{value:new THREE.Color(LANE_COLORS[lane-1])},realSuit:{value:new THREE.Color(SUITS[0][0])},realAcc:{value:new THREE.Color(SUITS[0][1])}};
 m.userData.real=u;m.customProgramCacheKey=()=>'hfgpRealRacer';
 m.onBeforeCompile=sh=>{Object.assign(sh.uniforms,u);sh.fragmentShader='uniform sampler2D realMask;\nuniform vec3 realLane;\nuniform vec3 realSuit;\nuniform vec3 realAcc;\n'+sh.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\n{ vec3 rm = texture2D( realMask, vMapUv ).rgb * 2.0; diffuseColor.rgb += ( rm.r * realLane + rm.g * realSuit + rm.b * realAcc ) * diffuse; }');};
}
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export async function loadAssetSet(baseURL='../',tier='mobile'){
 if(!['mobile','pc1080ti'].includes(tier))throw new Error('Unknown quality tier');
 const base=new URL(baseURL,document.baseURI),loader=new GLTFLoader(),tex=new THREE.TextureLoader();
 const rest=await fetch(new URL('runtime/rig_rest.json',base)).then(r=>{if(!r.ok)throw new Error('rig_rest.json');return r.json()});
 const [boats,males,females]=await Promise.all(['boat','racer_male','racer_female'].map(kind=>Promise.all([0,1,2].map(l=>loader.loadAsync(new URL(`${tier}/${kind}_lod${l}.glb`,base).href)))));
 const textures={};for(const type of ['boat_number','racer_bib'])textures[type]=await Promise.all([1,2,3,4,5,6].map(async n=>{const t=await tex.loadAsync(new URL(`textures/${type}_${n}.png`,base).href);t.colorSpace=THREE.SRGBColorSpace;t.flipY=false;return t;}));
 // d369: the realistic racers' base / mask textures (phone 1k, PC 2k); a racer set without RacerReal never uses them
 const rs=tier==='pc1080ti'?'2k':'1k',one=(f,srgb)=>tex.loadAsync(new URL(`textures/${f}`,base).href).then(t=>{t.colorSpace=srgb?THREE.SRGBColorSpace:THREE.NoColorSpace;t.flipY=false;return t;}).catch(()=>null);
 const real=[males,females].some(g=>{let y=false;g[0].scene.traverse(o=>{if(o.isMesh&&[].concat(o.material).some(m=>m.name.split('.')[0]==='RacerReal'))y=true;});return y;});
 textures.real={};if(real)for(const sx of ['male','female'])textures.real[sx]={base:await one(`racer_real_${sx}_base_${rs}.jpg`,true),mask:await one(`racer_real_${sx}_mask_${rs}.png`,false),
  // d370 (まえ: ポリゴンより艶やかなライティング): PC also takes Tripo's roughness/metal (G/B) and normal maps — helmet, visor, boots shine
  rm:tier==='pc1080ti'?await one(`racer_real_${sx}_rm_2k.jpg`,false):null,normal:tier==='pc1080ti'?await one(`racer_real_${sx}_normal_2k.jpg`,false):null};
 const bounds=hullBounds(boats[0].scene);
 return {tier,base,boats,males,females,rest,textures,bounds,livery(name){return loadLivery(base,name,tier);},create(opts){return new BoatActor(this,opts)}};
}
export class BoatActor{
 constructor(set,{lane=1,sex='m',heightCm=165}={}){
  if(!Number.isInteger(lane)||lane<1||lane>6)throw new Error('lane must be 1–6');
  this.set=set;this.lane=lane;this.sex=sex;this.heightCm=heightCm;this.root=new THREE.Group();this.root.name=`RaceActor_${lane}`;this.levels=[];this.lod=0;this.materials=[];this.hull=[];this.trim=[];this.livery='';this.liv=null;
  for(let l=0;l<3;l++){
   const boat=clone(set.boats[l].scene),racer=clone((sex==='f'?set.females:set.males)[l].scene);boat.updateMatrixWorld(true);racer.updateMatrixWorld(true);
   const pose=new RacerPose(racer,set.rest),mount=boat.getObjectByName('RacerMount');if(!mount)throw new Error('Missing RacerMount');mount.add(racer);
   const materialCopies=new Map();boat.traverse(o=>{if(!o.isMesh)return;o.castShadow=set.tier==='pc1080ti';o.receiveShadow=false;
    // Bounds must include every riding pose; avoid rest-pose skin culling.
    if(o.isSkinnedMesh)o.frustumCulled=false;
    const change=m=>{if(materialCopies.has(m))return materialCopies.get(m);const copy=m.clone(),n=copy.name.split('.')[0];
     if(n==='BoatPaint'||n==='RacerPaint')copy.color.set(LANE_COLORS[lane-1]);
     if(n==='RacerReal'){const rt=set.textures.real[sex==='f'?'female':'male'];if(rt&&rt.base&&rt.mask){copy.map=rt.base;copy.color.set('#ffffff');realShader(copy,rt.mask,lane);if(rt.rm){copy.roughnessMap=copy.metalnessMap=rt.rm;copy.roughness=1;copy.metalness=1;}if(rt.normal){copy.normalMap=rt.normal;copy.normalScale.set(1,-1);}copy.needsUpdate=true;}}
     if(n==='HullLivery'&&set.bounds){this.hull.push(copy);copy.envMapIntensity=1.6;liveryShader(copy,this.livU());}
     if(n==='HullLip'||n==='HullInner')this.trim.push([copy,n]);
     if(n==='BoatNumber')copy.map=set.textures.boat_number[lane-1];if(n==='RacerNumber')copy.map=set.textures.racer_bib[lane-1];
     materialCopies.set(m,copy);this.materials.push(copy);return copy;};o.material=Array.isArray(o.material)?o.material.map(change):change(o.material);
   });
   this.root.add(boat);boat.visible=l===0;this.levels.push({boat,racer,pose,motor:boat.getObjectByName('MotorSteer'),prop:boat.getObjectByName('Propeller')});
  }
  this.setLivery('lane');this.updatePose({});
 }
 livU(){if(this.liv)return this.liv;livBlack??=px1(0);livWhite??=px1(255);const B=this.set.bounds;
  return this.liv={livBase:{value:livWhite},livLane:{value:livBlack},livGloss:{value:livWhite},livMarks:{value:livBlack},livLaneCol:{value:new THREE.Color(LANE_COLORS[this.lane-1])},
   livContrastCol:{value:new THREE.Color(contrastColor(LANE_COLORS[this.lane-1]))},livB:{value:new THREE.Vector4(B.ymin,B.ymax,B.zmin,B.zmax)},livHalf:{value:B.half},livOn:{value:0},livR:{value:.26}};}
 /** d376: the venue's paint sheet (LIVERY_DIRS key: 'naniwa' | 'practice'), or 'lane' = plain lane colour. name = the racer's
  *  name (the surname mark). Loads once per venue; the hull stays in the lane colour until the sheet is in. */
 setLivery(name,racer){
  if(!this.hull.length)return this;
  const laneHex=name==='lane'&&this.lane===2?'#3a3f47':LANE_COLORS[this.lane-1];
  if(!LIVERY_DIRS[name]){this.livery='lane';this.liv.livOn.value=0;for(const m of this.hull)m.color.set(laneHex);for(const [m] of this.trim)m.color.set('#f3f4f1');return this;}
  const sur=surnameOf(racer);if(this.livery===name&&this.livName===sur)return this;this.livery=name;this.livName=sur;
  this.set.livery(name).then(L=>{if(this.livery!==name||this.livName!==sur)return;const j=L.json,u=this.liv,p=j.paint||{};
   u.livBase.value=L.base;u.livLane.value=L.lane||livBlack;u.livGloss.value=L.gloss||livWhite;u.livR.value=p.roughness??.26;
   const pc=this.set.tier==='pc1080ti';
   if(!this.marks){const c=document.createElement('canvas');c.width=c.height=pc?2048:1024;this.marks=new THREE.CanvasTexture(c);this.marks.colorSpace=THREE.SRGBColorSpace;this.marks.wrapS=this.marks.wrapT=THREE.ClampToEdgeWrapping;this.marks.anisotropy=4;this.marks.premultiplyAlpha=true;}
   drawMarks(this.marks.image,j,this.set.bounds,this.lane,racer);this.marks.needsUpdate=true;u.livMarks.value=this.marks;
   for(const m of this.hull){m.color.set('#ffffff');m.roughness=p.roughness??.26;if('clearcoat' in m&&pc){m.clearcoat=p.coat??.35;m.clearcoatRoughness=p.coatRoughness??.18;}}
   const parts=j.parts||{};for(const [m,n] of this.trim)m.color.set((n==='HullLip'?parts.lip:parts.inner)||'#f3f4f1');
   u.livOn.value=1;
  }).catch(()=>{});
  return this;
 }
 /** d369: the realistic racer's inner suit (sleeves) — by racerId / name, as in the replay */
 setSuit(key){const i=suitIndex(key);if(this.suit===i)return this;this.suit=i;for(const m of this.materials){const u=m.userData.real;if(u){u.realSuit.value.set(SUITS[i][0]);u.realAcc.value.set(SUITS[i][1]);}}return this;}
 setLOD(level){level=clamp(Math.round(level),0,2);if(this.lod!==level){this.levels[this.lod].boat.visible=false;this.lod=level;this.levels[level].boat.visible=true;this.updatePose(this.lastPose??{});}return this;}
 updatePose({pitch=0,roll=0,steer=0,propAngle=0,phase=0,turn=0,willie=0,wheel=null}={}){const low=this.low||0;   /* d403: 羽美の伏せ (set by the game per rider) */
  this.lastPose={pitch,roll,steer,propAngle,phase,turn,willie,wheel};const a=this.levels[this.lod];a.pose.update({heightCm:this.heightCm,pitch,roll,phase,turn,willie,steer:wheel,low});if(a.motor)a.motor.rotation.y=clamp(steer,-.6,.6);if(a.prop)a.prop.rotation.z=propAngle;return this;
 }
 /** Already resolved visual angles, in radians. Game +y down maps to glTF +Z. */
 setGameTransform({x=0,y=0,hop=0,modelYaw=0,modelBank=0,nose=0}={}){
  if(![x,y,hop,modelYaw,modelBank,nose].every(Number.isFinite))throw new TypeError('Non-finite game transform');
  this.root.position.set(x,hop,y);
  const qYaw=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),modelYaw),qBank=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,-1),modelBank),qPitch=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),nose);this.root.quaternion.copy(qYaw).multiply(qBank).multiply(qPitch);return this;
 }
 /** Approximate screen coverage, with hysteresis to prevent LOD flicker. */
 chooseLOD(projectedBoatPixels){const px=projectedBoatPixels,current=this.lod;let next=current;if(current===0&&px<100)next=1;else if(current===1&&px>130)next=0;else if(current===1&&px<38)next=2;else if(current===2&&px>52)next=1;return this.setLOD(next);}
 dispose(){this.root.removeFromParent();for(const m of this.materials)m.dispose();if(this.marks)this.marks.dispose();for(const l of this.levels)l.racer.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.dispose();});}
}
