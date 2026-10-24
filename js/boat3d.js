/* d163 (made on d160 as "d161", merged into d162): GLB boats over the existing Canvas2D course.
 * One shared vertex buffer, one WebGL draw per boat, a small atlas per frame.
 * No race-state writes, RNG calls, CDN, fetch, or pre-rendered sprite frames.
 * Specialized untextured GLB loader for the bundled rigid-node model.
 */
(() => {
  'use strict';
  const finite = (v, fallback = 0) => Number.isFinite(v) ? v : fallback;
  const limit = (v, lo, hi) => Math.max(lo, Math.min(hi, finite(v)));
  const identity = () => new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
  function mul(a,b) {
    const o=new Float32Array(16);
    for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)o[c*4+r]+=a[k*4+r]*b[c*4+k];
    return o;
  }
  function transform(t=[0,0,0], rx=0, ry=0, rz=0, scale=[1,1,1]) {
    const cx=Math.cos(rx),sx=Math.sin(rx),cy=Math.cos(ry),sy=Math.sin(ry),cz=Math.cos(rz),sz=Math.sin(rz);
    const x=new Float32Array([1,0,0,0,0,cx,sx,0,0,-sx,cx,0,0,0,0,1]);
    const y=new Float32Array([cy,0,-sy,0,0,1,0,0,sy,0,cy,0,0,0,0,1]);
    const z=new Float32Array([cz,sz,0,0,-sz,cz,0,0,0,0,1,0,0,0,0,1]);
    const out=mul(z,mul(y,x));
    for(let c=0;c<3;c++)for(let r=0;r<3;r++)out[c*4+r]*=scale[c];
    out[12]=t[0];out[13]=t[1];out[14]=t[2];return out;
  }
  function hex(s) {
    const n=parseInt((s||'#f4f7f6').slice(1),16);
    return [(n>>16&255)/255,(n>>8&255)/255,(n&255)/255];
  }
  function decodeModel(base64) {
    const raw=atob(base64),bytes=new Uint8Array(raw.length);
    for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
    const dv=new DataView(bytes.buffer);
    if(dv.getUint32(0,true)!==0x46546c67||dv.getUint32(4,true)!==2||dv.getUint32(8,true)!==bytes.length)throw Error('Invalid GLB');
    let model,bin;
    for(let at=12;at<bytes.length;){
      const len=dv.getUint32(at,true),type=dv.getUint32(at+4,true);at+=8;
      if(at+len>bytes.length)throw Error('Truncated GLB');
      if(type===0x4e4f534a)model=JSON.parse(new TextDecoder().decode(bytes.subarray(at,at+len)));
      if(type===0x004e4942)bin=bytes.subarray(at,at+len);at+=len;
    }
    if(!model||!bin||model.skins)throw Error('Unsupported GLB');
    function read(index) {
      const a=model.accessors[index],v=model.bufferViews[a.bufferView];
      if(v.byteStride||a.sparse)throw Error('Unsupported accessor layout');
      const sizes={SCALAR:1,VEC2:2,VEC3:3,VEC4:4},types={5126:Float32Array,5123:Uint16Array,5125:Uint32Array};
      const T=types[a.componentType];if(!T||!sizes[a.type])throw Error('Unsupported accessor');
      return new T(bin.buffer,bin.byteOffset+(v.byteOffset||0)+(a.byteOffset||0),a.count*sizes[a.type]);
    }
    const parent=new Int16Array(model.nodes.length).fill(-1),names={};
    model.nodes.forEach((n,i)=>{names[n.name]=i;for(const c of n.children||[])parent[c]=i;});
    // pos(3), normal(3), color(3), node index, tint category, digit segment.
    const vertices=[];
    function vertex(p,n,c,node,tint,segment=0){vertices.push(...p,...n,...c,node,tint,segment);}
    model.nodes.forEach((node,ni)=>{
      if(node.mesh==null)return;
      for(const prim of model.meshes[node.mesh].primitives){
        const p=read(prim.attributes.POSITION),norm=read(prim.attributes.NORMAL),idx=read(prim.indices);
        const mi=prim.material,c=model.materials[mi].pbrMetallicRoughness.baseColorFactor.slice(0,3);
        const tint=mi===4||mi===7||(node.name==='Helmet'&&mi===0)?1:mi===5?2:0;
        for(let f=0;f<idx.length;f+=3){
          const indices=[idx[f],idx[f+1],idx[f+2]];
          // Remove the prototype's fixed number 1, retaining the actual GLB plate.
          const oldNumber=node.name==='Hull'&&mi===1&&indices.every(k=>Math.abs(p[k*3])<.03&&p[k*3+1]>.30&&p[k*3+1]<.60&&p[k*3+2]>.50&&p[k*3+2]<.75);
          if(oldNumber)continue;
          for(const k of indices)vertex(p.subarray(k*3,k*3+3),norm.subarray(k*3,k*3+3),c,ni,tint);
        }
      }
    });
    function quad(points,normal,tint,segment=0){for(const i of [0,1,2,0,2,3])vertex(points[i],normal,[1,1,1],names.Hull,tint,segment);}
    // A readable top-deck number plus both sides of the original upright plate.
    const bars=[[-.12,.16,.24,.038],[.10,.015,.038,.15],[.10,-.15,.038,.15],[-.12,-.18,.24,.038],[-.14,-.15,.038,.15],[-.14,.015,.038,.15],[-.12,-.012,.24,.038]];
    const deck=(u,v,h)=>[u,h,1.02+v];
    quad([deck(-.23,-.25,.265),deck(.23,-.25,.265),deck(.23,.25,.265),deck(-.23,.25,.265)],[0,1,0],1);
    for(let side of [-1,1])quad([[side*.024,.30,.45],[side*.024,.30,.79],[side*.024,.62,.79],[side*.024,.62,.45]],[side,0,0],1);
    bars.forEach(([x,y,w,h],k)=>{
      quad([deck(x,y,.27),deck(x+w,y,.27),deck(x+w,y+h,.27),deck(x,y+h,.27)],[0,1,0],3,k+1);
      for(let side of [-1,1]){
        const q=(u,v)=>[side*.029,.46+v*.72,.62+u*.85];
        quad([q(x,y),q(x+w,y),q(x+w,y+h),q(x,y+h)],[side,0,0],3,k+1);
      }
    });
    return {model,parent,names,vertices:new Float32Array(vertices)};
  }
  const api={ready:false,mode:'3d',reason:'',count:0,drawCalls:0,tiles:new WeakMap(),span:8};
  try{api.mode=localStorage.getItem('honorGP.boatRender')==='2d'?'2d':'3d';}catch(e){}
  let canvas,gl,program,data,buffer,uniforms,tile=0;
  const status=()=>{
    const el=document.getElementById('boatRenderStatus');
    if(el)el.textContent=api.mode==='2d'?'従来の2D表示':api.ready?'3D表示中：6艇の色・姿勢をレースに連動':`2D表示で継続中${api.reason?'（'+api.reason+'）':''}`;
  };
  function fail(reason){api.ready=false;api.reason=reason;api.tiles=new WeakMap();status();}
  function compile(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
  function init(){
    if(!canvas){
      canvas=document.createElement('canvas');
      canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();fail('3D描画の復帰待ち');});
      canvas.addEventListener('webglcontextrestored',()=>{try{init();}catch(e){fail('3Dを利用できません');}});
    }
    gl=canvas.getContext('webgl',{alpha:true,antialias:false,premultipliedAlpha:true,depth:true,stencil:false,preserveDrawingBuffer:false,powerPreference:'low-power'});
    if(!gl)throw Error('WebGL unavailable');
    data=decodeModel(window.HFGP_BOAT_GLB_BASE64);
    const N=data.model.nodes.length;
    if(gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS)<N*4+16)throw Error('Insufficient shader uniforms');
    const vs=compile(gl.VERTEX_SHADER,`
      precision highp float;
      attribute vec3 aPosition,aNormal,aColor;
      attribute float aNode,aTint,aSegment;
      uniform mat4 uNodes[${N}];
      uniform vec3 uTeam,uInk,uLight;
      uniform float uDigit[7];
      varying vec3 vColor;
      void main(){
        mat4 m=uNodes[int(aNode+0.5)];
        vec4 p=m*vec4(aPosition,1.0);
        vec3 n=normalize(mat3(m)*aNormal);
        vec3 c=aColor;
        if(aTint>0.5&&aTint<1.5)c=uTeam;
        if(aTint>1.5&&aTint<2.5)c=uTeam*.75;
        if(aTint>2.5)c=uInk;
        float light=.55+.45*max(dot(n,uLight),0.0);
        vColor=c*light;
        gl_Position=vec4(p.z/4.0,-p.x/4.0,-p.y/8.0,1.0);
        if(aSegment>.5&&uDigit[int(aSegment-.5)]<.5)gl_Position=vec4(3.0,3.0,3.0,1.0);
      }`);
    const fs=compile(gl.FRAGMENT_SHADER,`precision mediump float;varying vec3 vColor;void main(){gl_FragColor=vec4(vColor,1.0);}`);
    program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
    gl.deleteShader(vs);gl.deleteShader(fs);gl.useProgram(program);
    buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,data.vertices,gl.STATIC_DRAW);
    for(const [name,size,offset]of [['aPosition',3,0],['aNormal',3,3],['aColor',3,6],['aNode',1,9],['aTint',1,10],['aSegment',1,11]]){
      const loc=gl.getAttribLocation(program,name);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,size,gl.FLOAT,false,48,offset*4);
    }
    uniforms={};for(const n of ['uNodes[0]','uTeam','uInk','uLight','uDigit[0]'])uniforms[n]=gl.getUniformLocation(program,n);
    gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.CULL_FACE);gl.disable(gl.BLEND);gl.clearColor(0,0,0,0);
    api.ready=true;api.reason='';api.triangles=data.vertices.length/36;api.sourceTriangles=data.model.extras.triangleCount;status();
  }
  function pose(b,inp,t){
    const nodes=data.model.nodes,N=nodes.length,world=new Array(N),angles=Object.create(null),shifts=Object.create(null);
    const roll=limit(inp.roll,-1,1),pitch=limit(inp.pitch,-1,1),steer=limit(inp.steer,-1,1),speed=limit(b.v/23,0,1);
    const capsized=finite(b.cap)>0&&!b.fallen;
    // The race's bank value is already smoothed by the physics engine.
    const bank=capsized?Math.PI:-limit(b.bank,-.65,.65);
    const nose=capsized?0:-limit((b.wil||0)*.30+(b.trim||0)*.14+(b.porp||0)*.045*Math.sin(t*18)+(b.hv||0)*.025,-.12,.4);
    angles.BoatRoot=[nose,0,bank];
    angles.RacerHips=[0,0,-roll*.16];
    angles.RacerTorso=[pitch*.44,0,-roll*.30];
    angles.Helmet=[-pitch*.15,0,roll*.10];
    angles.LeftUpperArm=[-pitch*.22,0,roll*.08];
    angles.RightUpperArm=[-pitch*.22,0,roll*.08];
    angles.LeftForearm=[pitch*.18,0,0];angles.RightForearm=[pitch*.18,0,0];
    angles.OutboardSteer=[0,-steer*.30,0];angles.Propeller=[0,0,t*(12+speed*90)];
    shifts.RacerHips=[roll*.08,0,pitch*.045];
    const result=new Float32Array(N*16);
    const hidden=new Set();
    if(finite(b.cap)>0||b.fallen){
      const collect=i=>{hidden.add(i);for(const c of nodes[i].children||[])collect(c);};collect(data.names.RacerHips);
    }
    function get(i){
      if(world[i])return world[i];
      const n=nodes[i],a=angles[n.name]||[0,0,0],delta=shifts[n.name]||[0,0,0];
      const p=(n.translation||[0,0,0]).map((v,k)=>v+delta[k]);
      // Scale aligns the bow with the physics BOW_TIP of 2.25 m in the neutral pose.
      const scale=i===0?[1.4,1.4,1.5]:[1,1,1];if(i===0)p[2]=-.525;
      if(hidden.has(i))scale.fill(0);
      const local=transform(p,...a,scale),par=data.parent[i];world[i]=par<0?local:mul(get(par),local);return world[i];
    }
    for(let i=0;i<N;i++)result.set(get(i),i*16);
    return result;
  }
  const digits={1:[0,1,1,0,0,0,0],2:[1,1,0,1,1,0,1],3:[1,1,1,1,0,0,1],4:[0,1,1,0,0,1,1],5:[1,0,1,1,0,1,1],6:[1,0,1,1,1,1,1]};
  api.prepare=function(rows,scale,dpr,t){
    api.tiles=new WeakMap();api.drawCalls=0;api.count=0;
    if(!api.ready||api.mode!=='3d')return;
    try{
      const next=Math.min(384,Math.max(96,Math.ceil(scale*dpr*api.span/32)*32));
      const cols=Math.min(3,rows.length),rowCount=Math.ceil(rows.length/cols);
      if(next!==tile||canvas.width!==cols*next||canvas.height!==rowCount*next){tile=next;canvas.width=cols*tile;canvas.height=rowCount*tile;}
      gl.useProgram(program);gl.disable(gl.SCISSOR_TEST);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      rows.forEach((row,i)=>{
        const x=i%cols*tile,y=Math.floor(i/cols)*tile;
        gl.viewport(x,canvas.height-y-tile,tile,tile);
        const b=row.b,a=finite(b.a),lx=-.45,ly=-.35;
        const light=[-Math.sin(a)*lx+Math.cos(a)*ly,.82,Math.cos(a)*lx+Math.sin(a)*ly],length=Math.hypot(...light);
        gl.uniformMatrix4fv(uniforms['uNodes[0]'],false,pose(b,row.inp,t));
        gl.uniform3fv(uniforms.uTeam,hex(row.col[0]));gl.uniform3fv(uniforms.uInk,hex(row.col[1]));
        gl.uniform3fv(uniforms.uLight,light.map(v=>v/length));gl.uniform1fv(uniforms['uDigit[0]'],digits[row.no]||digits[1]);
        gl.drawArrays(gl.TRIANGLES,0,data.vertices.length/12);
        api.tiles.set(b,{x,y,tile});api.drawCalls++;api.count++;
      });
    }catch(e){console.warn('3D boat fallback:',e);fail('3D描画を利用できません');}
  };
  api.draw=function(ctx,b){
    const q=api.tiles.get(b);if(!api.ready||api.mode!=='3d'||!q)return false;
    ctx.drawImage(canvas,q.x,q.y,q.tile,q.tile,-api.span/2,-api.span/2,api.span,api.span);return true;
  };
  api.setMode=function(mode){api.mode=mode==='2d'?'2d':'3d';try{localStorage.setItem('honorGP.boatRender',api.mode);}catch(e){}status();};
  // Read-only diagnostics for smoke/regression checks. Poses are copied, never written to boats.
  api.inspectPose=(b,inp,t=0)=>api.ready?{matrices:Array.from(pose(b,inp,t)),names:{...data.names}}:null;
  api.inspectAtlas=()=>canvas;
  window.Boat3D=api;
  try{init();}catch(e){console.warn('3D boats unavailable:',e);fail('WebGLを利用できません');}
  const select=document.getElementById('boatRenderMode');if(select){select.value=api.mode;select.addEventListener('change',e=>api.setMode(e.target.value));}
})();
