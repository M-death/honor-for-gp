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
 return {tier,boats,males,females,rest,textures,create(opts){return new BoatActor(this,opts)}};
}
export class BoatActor{
 constructor(set,{lane=1,sex='m',heightCm=165}={}){
  if(!Number.isInteger(lane)||lane<1||lane>6)throw new Error('lane must be 1–6');
  this.set=set;this.lane=lane;this.sex=sex;this.heightCm=heightCm;this.root=new THREE.Group();this.root.name=`RaceActor_${lane}`;this.levels=[];this.lod=0;this.materials=[];
  for(let l=0;l<3;l++){
   const boat=clone(set.boats[l].scene),racer=clone((sex==='f'?set.females:set.males)[l].scene);boat.updateMatrixWorld(true);racer.updateMatrixWorld(true);
   const pose=new RacerPose(racer,set.rest),mount=boat.getObjectByName('RacerMount');if(!mount)throw new Error('Missing RacerMount');mount.add(racer);
   const materialCopies=new Map();boat.traverse(o=>{if(!o.isMesh)return;o.castShadow=set.tier==='pc1080ti';o.receiveShadow=false;
    // Bounds must include every riding pose; avoid rest-pose skin culling.
    if(o.isSkinnedMesh)o.frustumCulled=false;
    const change=m=>{if(materialCopies.has(m))return materialCopies.get(m);const copy=m.clone(),n=copy.name.split('.')[0];
     if(n==='BoatPaint'||n==='RacerPaint')copy.color.set(LANE_COLORS[lane-1]);
     if(n==='RacerReal'){const rt=set.textures.real[sex==='f'?'female':'male'];if(rt&&rt.base&&rt.mask){copy.map=rt.base;copy.color.set('#ffffff');realShader(copy,rt.mask,lane);if(rt.rm){copy.roughnessMap=copy.metalnessMap=rt.rm;copy.roughness=1;copy.metalness=1;}if(rt.normal){copy.normalMap=rt.normal;copy.normalScale.set(1,-1);}copy.needsUpdate=true;}}
     if(n==='BoatNumber')copy.map=set.textures.boat_number[lane-1];if(n==='RacerNumber')copy.map=set.textures.racer_bib[lane-1];
     materialCopies.set(m,copy);this.materials.push(copy);return copy;};o.material=Array.isArray(o.material)?o.material.map(change):change(o.material);
   });
   this.root.add(boat);boat.visible=l===0;this.levels.push({boat,racer,pose,motor:boat.getObjectByName('MotorSteer'),prop:boat.getObjectByName('Propeller')});
  }
  this.updatePose({});
 }
 /** d369: the realistic racer's inner suit (sleeves) — by racerId / name, as in the replay */
 setSuit(key){const i=suitIndex(key);if(this.suit===i)return this;this.suit=i;for(const m of this.materials){const u=m.userData.real;if(u){u.realSuit.value.set(SUITS[i][0]);u.realAcc.value.set(SUITS[i][1]);}}return this;}
 setLOD(level){level=clamp(Math.round(level),0,2);if(this.lod!==level){this.levels[this.lod].boat.visible=false;this.lod=level;this.levels[level].boat.visible=true;this.updatePose(this.lastPose??{});}return this;}
 updatePose({pitch=0,roll=0,steer=0,propAngle=0,phase=0,turn=0,willie=0,wheel=null}={}){
  this.lastPose={pitch,roll,steer,propAngle,phase,turn,willie,wheel};const a=this.levels[this.lod];a.pose.update({heightCm:this.heightCm,pitch,roll,phase,turn,willie,steer:wheel});if(a.motor)a.motor.rotation.y=clamp(steer,-.6,.6);if(a.prop)a.prop.rotation.z=propAngle;return this;
 }
 /** Already resolved visual angles, in radians. Game +y down maps to glTF +Z. */
 setGameTransform({x=0,y=0,hop=0,modelYaw=0,modelBank=0,nose=0}={}){
  if(![x,y,hop,modelYaw,modelBank,nose].every(Number.isFinite))throw new TypeError('Non-finite game transform');
  this.root.position.set(x,hop,y);
  const qYaw=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),modelYaw),qBank=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,-1),modelBank),qPitch=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),nose);this.root.quaternion.copy(qYaw).multiply(qBank).multiply(qPitch);return this;
 }
 /** Approximate screen coverage, with hysteresis to prevent LOD flicker. */
 chooseLOD(projectedBoatPixels){const px=projectedBoatPixels,current=this.lod;let next=current;if(current===0&&px<100)next=1;else if(current===1&&px>130)next=0;else if(current===1&&px<38)next=2;else if(current===2&&px>52)next=1;return this.setLOD(next);}
 dispose(){this.root.removeFromParent();for(const m of this.materials)m.dispose();for(const l of this.levels)l.racer.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.dispose();});}
}
