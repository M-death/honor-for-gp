/** Visual-only IK. Three.js r180. Does not run or alter game physics. */
import * as THREE from 'three';
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const C=new THREE.Matrix4().makeRotationX(-Math.PI/2),CI=C.clone().invert();
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const GRIPS={L:V(-.245,-.055,.48),R:V(.10,-.03,.41)};
const TURN_POSE={monkey:{pelvis:[.12,-.58,.84],lean:1.36,side:.55,head_up:1.18,ankle_in:[.12,-.42,.29],ankle_out:[.34,-.86,.29],toe_in:[.15,.95,-.28],toe_out:[.50,.80,-.30]},
 willie:{pelvis:[.08,-.74,.64],lean:.80,side:.30,head_up:.70,ankle_in:[.13,-.44,.29],ankle_out:[.24,-.58,.29],toe_in:[.05,.95,-.30],toe_out:[.15,.95,-.30]}};
const WHEEL={center:V(0,-.03,.41),axis:V(0,.77,-.64).normalize(),max:.9};
// the right hand on the wheel rim: turned round the wheel centre by steer × 0.9 rad (steer −1 = left = the hand goes up)
const wheelGrip=steer=>GRIPS.R.clone().sub(WHEEL.center).applyAxisAngle(WHEEL.axis,steer*WHEEL.max).add(WHEEL.center);
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
 update({heightCm=165,pitch=0,roll=0,phase=0,turn=0,willie=0,steer=null}={},reachAttempt=0){
  if(!Number.isFinite(heightCm)||heightCm<140||heightCm>200)throw new RangeError('heightCm must be within 140–200');
  if(![pitch,roll,phase,turn,willie].every(Number.isFinite))throw new TypeError('Non-finite pose');
  pitch=clamp(pitch,-1,1);roll=clamp(roll,-1,1);
  // d280: the replay's 0.28 turn poses (08_replay/source/racer_pose.py pose_racer): モンキーターン (turn 0–1: up off the
  // knees, hips and chest to the inside, the outside foot braced on the outer side), ウィリーターン (willie 0–1: hips back
  // and down, chest up, arms out) and the right hand on the wheel rim (steer −1…1). Looks only.
  const m=clamp(turn,0,1),w=clamp(willie,0,1),si=roll<=0?-1:1,scale=heightCm/165,ankleZ=.196+.084*scale;
  const sv=(v,sx=1)=>V(v[0]*si*sx,v[1],v[2]),mix=(a,b,t)=>a.clone().lerp(b,t),T=TURN_POSE.monkey,W=TURN_POSE.willie;
  const legs={};
  for(const [side,s] of [['L',-1],['R',1]]){
   const inner=s===si,k=Math.max(m,w);
   const a=mix(mix(V(s*.14,-.75,ankleZ),inner?sv(T.ankle_in):sv(T.ankle_out,-1),m),inner?sv(W.ankle_in):sv(W.ankle_out,-1),w);
   const d=mix(mix(V(0,-.97,-.20),inner?sv(T.toe_in):sv(T.toe_out,-1),m),inner?sv(W.toe_in):sv(W.toe_out,-1),w);d.z-=.9*Math.sin(Math.PI*Math.min(k,1)*.999)*(1-k);
   legs[side]={a,d:d.normalize(),pole:k<.5?V(s*.06,.8,-.15):V(s*(inner?.10:.30),.8,.05)};
  }
  const lean=(1-w)*((1-m)*(.98+pitch*.44)+m*(T.lean+pitch*.18))+w*(W.lean+pitch*.12);
  const sideValue=(1-w)*((1-m)*Math.sin(roll*.30)+m*si*T.side)+w*si*W.side;
  const headUp=(1-w)*((1-m)*.72+m*T.head_up)+w*W.head_up;
  const hip=mix(mix(V(roll*.08,-.62+pitch*.045,.49),sv(T.pelvis).add(V(0,pitch*.03,0)),m),sv(W.pelvis),w);hip.z+=.004*Math.sin(phase);
  for(let i=0;i<16;i++){
   let correction=0;for(const [side,sign] of [['L',-1],['R',1]]){
    const a=hip.clone().divideScalar(scale).add(V(sign*.09,0,0)),target=legs[side].a.clone().divideScalar(scale);
    const knee=ik2(a,target,.395126562,.400031249,a.clone().add(legs[side].pole)).joint;correction=Math.max(correction,.196+.102*scale-knee.z*scale);
   }if(correction<.00005)break;hip.z+=correction*1.12;
  }
  const torso=V(sideValue,Math.sin(lean),Math.cos(lean)).normalize(),H=hip.clone().divideScalar(scale),sp=H.clone().addScaledVector(torso,.13),ch=sp.clone().addScaledVector(torso,.16),ne=ch.clone().addScaledVector(torso,.15);
  const neck=V(sideValue*.2*(1-m)+si*.12*m,Math.sin(lean-headUp),Math.cos(lean-headUp)).normalize(),he=ne.clone().addScaledVector(neck,.10);
  const align=(name,head,direction)=>{
   const r=this.rest[name],rd=new THREE.Vector3().fromArray(r.tail).sub(new THREE.Vector3().fromArray(r.head)).normalize();
   const q=new THREE.Quaternion().setFromUnitVectors(rd,direction.clone().normalize());const m4=new THREE.Matrix4().makeRotationFromQuaternion(q).multiply(this.rb[name]);m4.setPosition(head);return m4;
  };
  const desired={Root:this.rb.Root.clone(),Hips:align('Hips',H,torso),Spine:align('Spine',sp,torso),Chest:align('Chest',ch,torso),Neck:align('Neck',ne,neck),Head:align('Head',he,neck)};
  let error=0;
  const length=n=>new THREE.Vector3().fromArray(this.rest[n].head).distanceTo(new THREE.Vector3().fromArray(this.rest[n].tail));
  this.grips={L:GRIPS.L.clone(),R:steer==null||!Number.isFinite(steer)?GRIPS.R.clone():wheelGrip(clamp(steer,-1,1))};
  for(const [side,sign] of [['L',-1],['R',1]]){
   const lat=V(1,0,0).addScaledVector(torso,-torso.x).normalize();
   const shoulder=H.clone().addScaledVector(torso,.415).addScaledVector(lat,sign*.185),clavroot=H.clone().addScaledVector(torso,.41);
   const clav=new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0,0,1),torso)).multiply(this.rb['Clavicle_'+side]);clav.setPosition(clavroot);desired['Clavicle_'+side]=clav;
   const grip=this.grips[side].clone().divideScalar(scale),hand=V(0,.77,-.64).normalize(),wrist=grip.clone().addScaledVector(hand,-.065);
   const arm=ik2(shoulder,wrist,length('UpperArm_'+side),length('Forearm_'+side),shoulder.clone().add(V(sign*.6,-.32,-.30)));
   desired['UpperArm_'+side]=align('UpperArm_'+side,shoulder,arm.joint.clone().sub(shoulder));desired['Forearm_'+side]=align('Forearm_'+side,arm.joint,arm.reached.clone().sub(arm.joint));desired['Hand_'+side]=align('Hand_'+side,arm.reached,hand);error=Math.max(error,arm.error*scale);
   const thigh=H.clone().add(V(sign*.09,0,0)),ankle=legs[side].a.clone().divideScalar(scale),leg=ik2(thigh,ankle,length('Thigh_'+side),length('Shin_'+side),thigh.clone().add(legs[side].pole));
   desired['Thigh_'+side]=align('Thigh_'+side,thigh,leg.joint.clone().sub(thigh));desired['Shin_'+side]=align('Shin_'+side,leg.joint,leg.reached.clone().sub(leg.joint));desired['Foot_'+side]=align('Foot_'+side,leg.reached,legs[side].d);
  }
  // Keep grip contact at extreme combinations of stature and lean.
  // Reduce only the visual lean toward Cruise; never alter boat physics.
  if(error>0.00001 && reachAttempt<16)return this.update({heightCm,pitch:pitch*.75,roll:roll*.75,phase,turn,willie,steer},reachAttempt+1);
  const global={};for(const n of this.order)global[n]=C.clone().multiply(desired[n]).multiply(this.invRest[n]).multiply(CI).multiply(this.restG[n]);
  for(const n of this.order){const parent=this.rest[n].parent;const local=(parent?global[parent]:this.parentG[n]).clone().invert().multiply(global[n]);local.decompose(this.bones[n].position,this.bones[n].quaternion,this.bones[n].scale);this.bones[n].updateMatrix();}
  this.scene.scale.setScalar(scale);this.scene.updateMatrixWorld(true);return {maxSolverGripErrorM:error,reachLimited:reachAttempt>0,effectivePitch:pitch,effectiveRoll:roll};
 }
 gripError(){
  const inv=this.scene.matrixWorld.clone().invert();let error=0;
  for(const side of ['L','R']){
   const actual=this.gripLocal[side].clone().applyMatrix4(this.bones['Hand_'+side].matrixWorld).applyMatrix4(inv).multiplyScalar(this.scene.scale.x);
   const expected=((this.grips&&this.grips[side])||GRIPS[side]).clone().applyMatrix4(C);error=Math.max(error,actual.distanceTo(expected));
  }return error;
 }
}
