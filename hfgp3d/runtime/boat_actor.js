/** glTF axes: +X starboard, +Y up, -Z bow. One clone per boat; textures/geometry shared. */
import * as THREE from 'three';
import { GLTFLoader } from '../viewer/vendor/GLTFLoader.js';
import { clone } from '../viewer/vendor/SkeletonUtils.js';
import { RacerPose } from './racer_pose.js';
export const LANE_COLORS=['#eeeeee','#20242a','#d73533','#2867bd','#e6c128','#20844f'];
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export async function loadAssetSet(baseURL='../',tier='mobile'){
 if(!['mobile','pc1080ti'].includes(tier))throw new Error('Unknown quality tier');
 const base=new URL(baseURL,document.baseURI),loader=new GLTFLoader(),tex=new THREE.TextureLoader();
 const rest=await fetch(new URL('runtime/rig_rest.json',base)).then(r=>{if(!r.ok)throw new Error('rig_rest.json');return r.json()});
 const [boats,males,females]=await Promise.all(['boat','racer_male','racer_female'].map(kind=>Promise.all([0,1,2].map(l=>loader.loadAsync(new URL(`${tier}/${kind}_lod${l}.glb`,base).href)))));
 const textures={};for(const type of ['boat_number','racer_bib'])textures[type]=await Promise.all([1,2,3,4,5,6].map(async n=>{const t=await tex.loadAsync(new URL(`textures/${type}_${n}.png`,base).href);t.colorSpace=THREE.SRGBColorSpace;t.flipY=false;return t;}));
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
     if(n==='BoatNumber')copy.map=set.textures.boat_number[lane-1];if(n==='RacerNumber')copy.map=set.textures.racer_bib[lane-1];
     materialCopies.set(m,copy);this.materials.push(copy);return copy;};o.material=Array.isArray(o.material)?o.material.map(change):change(o.material);
   });
   this.root.add(boat);boat.visible=l===0;this.levels.push({boat,racer,pose,motor:boat.getObjectByName('MotorSteer'),prop:boat.getObjectByName('Propeller')});
  }
  this.updatePose({});
 }
 setLOD(level){level=clamp(Math.round(level),0,2);if(this.lod!==level){this.levels[this.lod].boat.visible=false;this.lod=level;this.levels[level].boat.visible=true;this.updatePose(this.lastPose??{});}return this;}
 updatePose({pitch=0,roll=0,steer=0,propAngle=0,phase=0}={}){
  this.lastPose={pitch,roll,steer,propAngle,phase};const a=this.levels[this.lod];a.pose.update({heightCm:this.heightCm,pitch,roll,phase});if(a.motor)a.motor.rotation.y=clamp(steer,-.6,.6);if(a.prop)a.prop.rotation.z=propAngle;return this;
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
