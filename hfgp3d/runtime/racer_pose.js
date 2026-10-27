/** Visual-only IK. Three.js r180. Does not run or alter game physics. */
import * as THREE from 'three';
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const C=new THREE.Matrix4().makeRotationX(-Math.PI/2),CI=C.clone().invert();
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function ik2(a,target,l1,l2,pole){
 const axis=target.clone().sub(a);const distance=axis.length();if(distance<1e-7)axis.set(0,1,0);axis.normalize();
 const safe=clamp(distance,Math.abs(l1-l2)+1e-5,l1+l2-1e-5),along=(l1*l1-l2*l2+safe*safe)/(2*safe);
 const perp=pole.clone().sub(a);perp.addScaledVector(axis,-perp.dot(axis));if(perp.length()<1e-7)perp.crossVectors(axis,V(1,0,0));perp.normalize();
 return {joint:a.clone().addScaledVector(axis,along).addScaledVector(perp,Math.sqrt(Math.max(0,l1*l1-along*along))),reached:a.clone().addScaledVector(axis,safe),error:Math.abs(distance-safe)};
}
export class RacerPose {
 constructor(scene,rest){
  this.scene=scene;this.rest=rest;this.bones={};this.restG={};this.parentG={};this.rb={};this.invRest={};this.order=Object.keys(rest);scene.updateMatrixWorld(true);const inv=scene.matrixWorld.clone().invert();
  for(const name of this.order){
   const b=scene.getObjectByName(name);if(!b?.isBone)throw new Error('Missing racer joint: '+name);this.bones[name]=b;
   this.rb[name]=new THREE.Matrix4().set(...rest[name].matrix.flat());this.invRest[name]=this.rb[name].clone().invert();
   this.restG[name]=inv.clone().multiply(b.matrixWorld);this.parentG[name]=inv.clone().multiply(b.parent.matrixWorld);
  }
  this.gripLocal={};for(const side of ['L','R']){
   const n='Hand_'+side;this.gripLocal[side]=V(0,.065,0).applyMatrix4(this.rb[n]).applyMatrix4(C).applyMatrix4(this.restG[n].clone().invert());
  }
 }
 update({heightCm=165,pitch=0,roll=0,phase=0}={},reachAttempt=0){
  if(!Number.isFinite(heightCm)||heightCm<140||heightCm>200)throw new RangeError('heightCm must be within 140–200');
  if(![pitch,roll,phase].every(Number.isFinite))throw new TypeError('Non-finite pose');
  pitch=clamp(pitch,-1,1);roll=clamp(roll,-1,1);const scale=heightCm/165,lean=.98+pitch*.44,sideValue=Math.sin(roll*.30),ankleZ=.196+.084*scale;
  const hip=V(roll*.08,-.62+pitch*.045,.49+.004*Math.sin(phase));
  for(let i=0;i<16;i++){
   let correction=0;for(const sign of [-1,1]){
    const a=hip.clone().divideScalar(scale).add(V(sign*.09,0,0)),target=V(sign*.14,-.75,ankleZ).divideScalar(scale);
    const knee=ik2(a,target,.395126562,.400031249,a.clone().add(V(sign*.06,.8,-.15))).joint;correction=Math.max(correction,.196+.102*scale-knee.z*scale);
   }if(correction<.00005)break;hip.z+=correction*1.12;
  }
  const torso=V(sideValue,Math.sin(lean),Math.cos(lean)).normalize(),H=hip.clone().divideScalar(scale),sp=H.clone().addScaledVector(torso,.13),ch=sp.clone().addScaledVector(torso,.16),ne=ch.clone().addScaledVector(torso,.15);
  const neck=V(sideValue*.2,Math.sin(lean-.72),Math.cos(lean-.72)).normalize(),he=ne.clone().addScaledVector(neck,.10);
  const align=(name,head,direction)=>{
   const r=this.rest[name],rd=new THREE.Vector3().fromArray(r.tail).sub(new THREE.Vector3().fromArray(r.head)).normalize();
   const q=new THREE.Quaternion().setFromUnitVectors(rd,direction.clone().normalize());const m=new THREE.Matrix4().makeRotationFromQuaternion(q).multiply(this.rb[name]);m.setPosition(head);return m;
  };
  const desired={Root:this.rb.Root.clone(),Hips:align('Hips',H,torso),Spine:align('Spine',sp,torso),Chest:align('Chest',ch,torso),Neck:align('Neck',ne,neck),Head:align('Head',he,neck)};
  let error=0;
  const length=n=>new THREE.Vector3().fromArray(this.rest[n].head).distanceTo(new THREE.Vector3().fromArray(this.rest[n].tail));
  for(const [side,sign] of [['L',-1],['R',1]]){
   const shoulder=H.clone().addScaledVector(torso,.415).add(V(sign*.185,0,0)),clavroot=H.clone().addScaledVector(torso,.41);
   const clav=new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0,0,1),torso)).multiply(this.rb['Clavicle_'+side]);clav.setPosition(clavroot);desired['Clavicle_'+side]=clav;
   const grip=(side==='L'?V(-.245,-.055,.48):V(.10,-.03,.41)).divideScalar(scale),hand=V(0,.77,-.64).normalize(),wrist=grip.clone().addScaledVector(hand,-.065);
   const arm=ik2(shoulder,wrist,length('UpperArm_'+side),length('Forearm_'+side),shoulder.clone().add(V(sign*.6,-.32,-.30)));
   desired['UpperArm_'+side]=align('UpperArm_'+side,shoulder,arm.joint.clone().sub(shoulder));desired['Forearm_'+side]=align('Forearm_'+side,arm.joint,arm.reached.clone().sub(arm.joint));desired['Hand_'+side]=align('Hand_'+side,arm.reached,hand);error=Math.max(error,arm.error*scale);
   const thigh=H.clone().add(V(sign*.09,0,0)),ankle=V(sign*.14,-.75,ankleZ).divideScalar(scale),leg=ik2(thigh,ankle,length('Thigh_'+side),length('Shin_'+side),thigh.clone().add(V(sign*.06,.8,-.15)));
   desired['Thigh_'+side]=align('Thigh_'+side,thigh,leg.joint.clone().sub(thigh));desired['Shin_'+side]=align('Shin_'+side,leg.joint,leg.reached.clone().sub(leg.joint));desired['Foot_'+side]=align('Foot_'+side,leg.reached,V(0,-.97,-.20));
  }
  // Keep grip contact at extreme combinations of stature and lean.
  // Reduce only the visual lean toward Cruise; never alter boat physics.
  if(error>0.00001 && reachAttempt<16)return this.update({heightCm,pitch:pitch*.75,roll:roll*.75,phase},reachAttempt+1);
  const global={};for(const n of this.order)global[n]=C.clone().multiply(desired[n]).multiply(this.invRest[n]).multiply(CI).multiply(this.restG[n]);
  for(const n of this.order){const parent=this.rest[n].parent;const local=(parent?global[parent]:this.parentG[n]).clone().invert().multiply(global[n]);local.decompose(this.bones[n].position,this.bones[n].quaternion,this.bones[n].scale);this.bones[n].updateMatrix();}
  this.scene.scale.setScalar(scale);this.scene.updateMatrixWorld(true);return {maxSolverGripErrorM:error,reachLimited:reachAttempt>0,effectivePitch:pitch,effectiveRoll:roll};
 }
 gripError(){
  const inv=this.scene.matrixWorld.clone().invert();let error=0;
  for(const side of ['L','R']){
   const actual=this.gripLocal[side].clone().applyMatrix4(this.bones['Hand_'+side].matrixWorld).applyMatrix4(inv).multiplyScalar(this.scene.scale.x);
   const expected=(side==='L'?V(-.245,-.055,.48):V(.10,-.03,.41)).applyMatrix4(C);error=Math.max(error,actual.distanceTo(expected));
  }return error;
 }
}
