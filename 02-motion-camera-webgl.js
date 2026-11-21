/* ===== v0.2: حركة مستقلة، 2.5D، كاميرا متقدمة، جمهور ومؤثرات ===== */
Object.assign(S,{mspeed:1,mamp:1,head:1,mouthAmp:1,mouthW:.03,depth:1,perf:true,mouthOn:true,crowd:1,fx:1,camSpeed:1,trans:'auto',dof:true,q:1,env:0,voice:0,pulse:0,waveT:-9,cutF:0,whip:0,neck:{x:.5,y:.24},mouth:{x:.5,y:.14},neckT:{x:.5,y:.24},mouthT:{x:.5,y:.14},hon:true,hg:1,hrot:2.5,mmot:1,hspd:1,hint:1,prev:false,calZ:1,calC:{x:.5,y:.5},ptsSet:{mouth:false,neck:false}});
Object.assign(cam,{hx:0,hy:0,hr:0});
const nz=(t,a,b,c)=>Math.sin(t*a)*.5+Math.sin(t*b+1.3)*.3+Math.sin(t*c+2.1)*.2,clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const M={sway:0,tilt:0,nod:0,breath:0,shL:0,shR:0,open:0,jaw:0};
['perf','mouthOn','dof'].forEach(k=>$('#'+k).onchange=e=>S[k]=e.target.checked);
$('#trans').onchange=e=>S.trans=e.target.value;
$('#q').onchange=e=>{S.q=+e.target.value;cv.width=W*S.q;cv.height=H*S.q};

/* تحليل الصوت: قنوات مستقلة (بطيئة للإضاءة، سريعة للإيقاع، وصوت المغنية للفم) */
let aT=0,pT=0;
function analyse(now){
  const dt=Math.min(.05,Math.max(.001,(now-aT)/1000));aT=now;
  S.beat*=Math.exp(-dt*7.5);S.pulse*=Math.exp(-dt*3.5);
  if(an){
    an.getByteFrequencyData(fd);
    const av=(a,b)=>{let s=0;for(let i=a;i<b;i++)s+=fd[i];return s/(b-a)/255};
    const b=av(1,6);S.bass=b;S.mid=av(6,60);S.treb=av(60,300);S.avg=S.avg*.94+b*.06;
    if(b>S.avg*1.18+.04&&b>.45&&now-S.lastBeat>260){S.lastBeat=now;S.beats++;S.beat=1;S.pulse=1;S.waveT=T}
  }else{S.bass*=.9;S.mid*=.9;S.treb*=.9}
  S.env+=(S.bass-S.env)*(1-Math.exp(-dt*4));
  const tv=(S.prev&&!isPlaying())?clamp(Math.max(0,Math.sin(now/1000*22))*(.65+.35*Math.sin(now/1000*1.3)),0,1):clamp((S.mid-.16)*3.2,0,1);S.voice+=(tv-S.voice)*(1-Math.exp(-dt*(tv>S.voice?16:7)));
}

/* حركة المغنية: ضوضاء عضوية ناعمة مستقلة عن الباس */
function motion(t,dt){
  const tt=t*S.mspeed,a=S.mamp,hd=S.head,pf=S.perf?1:0;
  S.hg+=((S.hon?1:0)-S.hg)*(1-Math.exp(-dt*3));
  const kp=1-Math.exp(-dt*7);S.neck.x+=(S.neckT.x-S.neck.x)*kp;S.neck.y+=(S.neckT.y-S.neck.y)*kp;S.mouth.x+=(S.mouthT.x-S.mouth.x)*kp;S.mouth.y+=(S.mouthT.y-S.mouth.y)*kp;
  const ht=tt*S.hspd,gi=S.hint*S.hg*hd*a,hA=S.hrot*Math.PI/180*gi,kq=1-Math.exp(-dt*9);
  M.sway=nz(tt,.55,.93,1.4)*.02*a;
  M.tilt+=(nz(ht,.4,.71,1.1)*hA+pf*(S.voice-.3)*.3*hA+((S.beats%2)?1:-1)*S.pulse*.12*hA-M.tilt)*kq;
  M.nod+=((nz(ht,.62,1.05,.37)*.005-pf*S.voice*.005+S.pulse*.003)*gi-M.nod)*kq;
  M.breath=(Math.sin(tt*1.7)*.5+.5)*.008*a;
  M.shL=(nz(tt,.8,1.3,.5)*.006+S.env*.004)*a;M.shR=(nz(tt+2,.8,1.3,.5)*.006+S.env*.004)*a;
  M.open=(pf&&S.mouthOn&&S.img)?clamp(S.voice*S.mouthAmp*S.mmot*S.hint*S.hg,0,1):0;M.jaw=M.open*.008;
}
function headD(u,v){const asp=GW/GH,rx=(u-S.neck.x)*asp,ry=v-S.neck.y;return{x:M.sway*Math.pow(1-v,1.6)-ry*M.tilt/asp,y:rx*M.tilt+M.nod}}

/* WebGL: شبكة تشويه ناعمة (الرأس صلب حول الرقبة، الأكتاف والتنفس والفك موضعية) */
const gl_c=document.createElement('canvas'),gl=gl_c.getContext('webgl',{premultipliedAlpha:true,alpha:true});
let glP,glT,GLok=false,GW=1,GH=1,texSrc=null;const U={},PAD=.08;
function initGL(){
  if(!gl)return;
  const mk=(t,s)=>{const o=gl.createShader(t);gl.shaderSource(o,s);gl.compileShader(o);return o};
  const vs=`attribute vec2 p;uniform vec2 neck,mouth,par;uniform float asp,sway,tilt,nod,breath,shL,shR,shV,jaw,pad;varying vec2 uv;
void main(){vec2 d=vec2(0.);float v=p.y;
d.x+=sway*pow(1.-v,1.6);
float fr=max(.02,neck.y-mouth.y);float hw=1.-smoothstep(neck.y-fr*.45,neck.y+fr*.15,v);
vec2 r=vec2((p.x-neck.x)*asp,p.y-neck.y);
d+=hw*vec2(-r.y*tilt/asp,r.x*tilt+nod);
float a=(v-shV)/.05;float sh=exp(-a*a);
d.y+=sh*mix(shL,shR,smoothstep(.35,.65,p.x))-sh*breath*.5;
d.x+=sh*(p.x-.5)*breath*1.5;
vec2 m=vec2((p.x-mouth.x)*asp,p.y-mouth.y);
d.y+=jaw*fr*10.*exp(-dot(m,m)/(.125*fr*fr))*smoothstep(mouth.y-fr*.04,mouth.y+fr*.12,p.y);
vec2 e=vec2((p.x-.5)/.32,(p.y-.45)/.5);d+=par*exp(-dot(e,e));
vec2 q=((p+d)-.5)/(1.+2.*pad)+.5;
gl_Position=vec4(q.x*2.-1.,1.-q.y*2.,0.,1.);uv=p;}`;
  const fs='precision mediump float;uniform sampler2D t;varying vec2 uv;void main(){gl_FragColor=texture2D(t,uv);}';
  glP=gl.createProgram();gl.attachShader(glP,mk(gl.VERTEX_SHADER,vs));gl.attachShader(glP,mk(gl.FRAGMENT_SHADER,fs));gl.linkProgram(glP);
  if(!gl.getProgramParameter(glP,gl.LINK_STATUS))return;
  gl.useProgram(glP);
  const P=[],I=[],NX=36,NY=72;
  for(let j=0;j<=NY;j++)for(let i=0;i<=NX;i++)P.push(i/NX,j/NY);
  for(let j=0;j<NY;j++)for(let i=0;i<NX;i++){const a=j*(NX+1)+i;I.push(a,a+1,a+NX+1,a+1,a+NX+2,a+NX+1)}
  gl.bindBuffer(gl.ARRAY_BUFFER,gl.createBuffer());gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(P),gl.STATIC_DRAW);
  const loc=gl.getAttribLocation(glP,'p');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,gl.createBuffer());gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(I),gl.STATIC_DRAW);
  ['neck','mouth','par','asp','sway','tilt','nod','breath','shL','shR','shV','jaw','pad'].forEach(n=>U[n]=gl.getUniformLocation(glP,n));
  GLok=true;
}
function uploadTex(){
  if(!GLok)return;const c=S.cv;
  if(!glT)glT=gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D,glT);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);
  try{gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,c)}catch(e){GLok=false;return}
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  GW=c.width;GH=c.height;gl_c.width=Math.round(GW*(1+2*PAD));gl_c.height=Math.round(GH*(1+2*PAD));gl.viewport(0,0,gl_c.width,gl_c.height);texSrc=c;
}
function renderWarp(px,py){
  gl.useProgram(glP);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
  gl.uniform2f(U.neck,S.neck.x,S.neck.y);gl.uniform2f(U.mouth,S.mouth.x,S.mouth.y);gl.uniform2f(U.par,px,py);
  gl.uniform1f(U.asp,GW/GH);gl.uniform1f(U.sway,M.sway);gl.uniform1f(U.tilt,M.tilt);gl.uniform1f(U.nod,M.nod);gl.uniform1f(U.breath,M.breath);
  gl.uniform1f(U.shL,M.shL);gl.uniform1f(U.shR,M.shR);gl.uniform1f(U.shV,S.neck.y+.05);gl.uniform1f(U.jaw,M.jaw);gl.uniform1f(U.pad,PAD);
  gl.drawElements(gl.TRIANGLES,36*72*6,gl.UNSIGNED_SHORT,0);
}

/* معايرة نقطتي الفم والرقبة */
let calTool='mouth';
const calWin=()=>{const v=1/S.calZ;return{x0:clamp(S.calC.x-v/2,0,1-v),y0:clamp(S.calC.y-v/2,0,1-v),vw:v,vh:v}};
function drawCal(){
  const c=$('#cal'),x=c.getContext('2d'),s=S.cv;if(!s)return;
  const w=calWin(),ar=s.width/s.height;let H0=420,W0=Math.round(H0*ar);if(W0>520){W0=520;H0=Math.round(W0/ar)}c.width=W0;c.height=H0;x.fillStyle='#222';x.fillRect(0,0,W0,H0);x.drawImage(s,w.x0*s.width,w.y0*s.height,w.vw*s.width,w.vh*s.height,0,0,W0,H0);
  [[S.neckT,'#35d4ff','NECK'],[S.mouthT,'#ff3fb4','MOUTH']].forEach(([p,cl,n])=>{const px=(p.x-w.x0)/w.vw*W0,py=(p.y-w.y0)/w.vh*H0;x.strokeStyle=cl;x.fillStyle=cl;x.lineWidth=2;x.beginPath();x.arc(px,py,7,0,7);x.moveTo(px-13,py);x.lineTo(px+13,py);x.moveTo(px,py-13);x.lineTo(px,py+13);x.stroke();x.font='11px system-ui,Arial';x.fillText(n,px+10,py-9)});
}
document.querySelectorAll('[data-cal]').forEach(b=>b.onclick=()=>{calTool=b.dataset.cal;document.querySelectorAll('[data-cal]').forEach(x=>x.classList.toggle('on',x===b))});
$('#cal').onclick=e=>{const r=e.target.getBoundingClientRect(),w=calWin(),p={x:w.x0+(e.clientX-r.left)/r.width*w.vw,y:w.y0+(e.clientY-r.top)/r.height*w.vh};S[calTool+'T']=p;S.ptsSet[calTool]=true;if(calTool==='mouth')S.calC={x:p.x,y:p.y};setSt();drawCal()};

/* كاميرا: لقطات بحركة دولي داخلية وانتقالات (انسيابي / Whip / قطع) */
const ease=x=>x<.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2,mix=(a,b,p)=>({z:a.z+(b.z-a.z)*p,x:a.x+(b.x-a.x)*p,y:a.y+(b.y-a.y)*p,r:a.r+(b.r-a.r)*p});
SH.close2={z:2.1,x:652,y:205,r:.012};
const PLAN=[['wide','mid'],['mid','close'],['orbL','orbR'],['close','close2'],['low','mid'],['orbR','orbL'],['mid','wide']];
const shot={i:-1,t0:-99,dur:6,tr:1,kind:'ease',f:'wide',to:'mid',prev:{z:1,x:640,y:360,r:0}};
function nextShot(t){
  shot.i=(shot.i+1)%PLAN.length;shot.kind=S.trans==='auto'?['ease','whip','ease','cut'][shot.i%4]:S.trans;
  shot.f=PLAN[shot.i][0];shot.to=PLAN[shot.i][1];shot.t0=t;shot.dur=(5+Math.random()*3)/S.camSpeed;
  shot.tr=shot.kind==='cut'?0:(shot.kind==='whip'?.45:1.4)/S.camSpeed;
  shot.prev={z:cam.z,x:cam.x,y:cam.y,r:cam.r};if(shot.kind==='cut')S.cutF=.9;
}
function camUpdate(t,dt){
  const a=S.camAmt,sp=S.camSpeed;let g,direct=false;
  const sc=q=>({z:1+(q.z-1)*a,x:640+(q.x-640)*a,y:360+(q.y-360)*a,r:q.r*a});
  S.whip=0;
  if(S.cam==='auto'){
    if(t-shot.t0>shot.dur||(S.beat>.99&&S.beats%32===0&&t-shot.t0>3))nextShot(t);
    const el=t-shot.t0;g=sc(mix(SH[shot.f],SH[shot.to],ease(Math.min(1,el/shot.dur))));
    const tp=shot.tr>0?Math.min(1,el/shot.tr):1;
    if(tp<1){g=mix(shot.prev,g,ease(tp));if(shot.kind==='whip'){g.r+=Math.sin(tp*Math.PI)*.06;S.whip=Math.sin(tp*Math.PI)}}
    direct=true;
  }else{
    if(S.cam==='push'){const p=(Math.sin(t*.15*sp)+1)/2;g={z:1+p*.9,x:640,y:360-p*150,r:0}}
    else if(S.cam==='orbit'){const s=Math.sin(t*.4*sp);g={z:1.25,x:640+s*110,y:340,r:s*.04}}
    else g=SH[S.cam];
    g=sc(g);
  }
  if(direct){cam.z=g.z;cam.x=g.x;cam.y=g.y;cam.r=g.r}
  else{const k=1-Math.exp(-dt*2.2*sp);cam.z+=(g.z-cam.z)*k;cam.x+=(g.x-cam.x)*k;cam.y+=(g.y-cam.y)*k;cam.r+=(g.r-cam.r)*k}
  cam.hx=nz(t,.7,1.3,2.1)*2.5*a;cam.hy=nz(t,.9,1.7,2.3)*2*a;cam.hr=nz(t,.5,.9,1.6)*.003*a;
  if(S.full){cam.z=Math.min(cam.z,1.03);cam.x=640+(cam.x-640)*.15;cam.y=360+(cam.y-360)*.15;cam.r*=.3}
  S.cutF*=Math.exp(-dt*6);
}

/* المغنية: لا تكبير ولا اهتزاز كامل مع الباس. الحركة كلها داخل شبكة التشويه */
function drawSinger(t,A,B,L){
  const c=S.cv;if(!c)return;
  const sgm=sgeom(),h=sgm.h,w=sgm.w,by=sgm.by;
  ctx.save();ctx.globalCompositeOperation='lighter';
  const g=ctx.createRadialGradient(640,by-h*.55,0,640,by-h*.55,h*.85);g.addColorStop(0,col(A,.12+S.env*.3*L+S.pulse*.12*L));g.addColorStop(1,col(A,0));
  ctx.fillStyle=g;ctx.fillRect(640-h,by-h*1.5,h*2,h*2);ctx.restore();
  let img=c,ix=-w/2,iy=-h,iw=w,ih=h;
  if(GLok&&texSrc===c){
    renderWarp(-(cam.x-640)/640*.025*S.depth,-(cam.y-360)/360*.012*S.depth);
    img=gl_c;const mp=PAD*h;iw=w*(1+2*PAD);ih=h*(1+2*PAD);ix=-iw/2;iy=-h-mp;
  }
  ctx.imageSmoothingQuality='high';
  ctx.save();ctx.translate(640,by);ctx.scale(1,-.3);ctx.globalAlpha=.2;ctx.drawImage(img,ix,iy,iw,ih);ctx.restore();
  ctx.save();ctx.translate(640,by);
  ctx.shadowColor=col(A,.9);ctx.shadowBlur=16+S.env*30*L;ctx.drawImage(img,ix,iy,iw,ih);
  ctx.shadowColor=col(B,.5);ctx.shadowBlur=8+S.treb*30*L;ctx.shadowOffsetX=8;ctx.drawImage(img,ix,iy,iw,ih);
  ctx.shadowColor='transparent';ctx.shadowBlur=0;ctx.shadowOffsetX=0;drawPreview();
  if(M.open>.03&&GLok&&texSrc===c){
    const hd=headD(S.mouth.x,S.mouth.y),mx=(S.mouth.x+hd.x-.5)*w,my=(S.mouth.y+hd.y-1)*h+M.jaw*h*.3;
    const rx=S.mouthW*h/2*(1+.2*M.open),ry=Math.max(.5,M.open*S.mouthW*h*.28);
    const mg=ctx.createRadialGradient(mx,my+ry*.5,0,mx,my+ry*.5,rx);mg.addColorStop(0,'#2a0509');mg.addColorStop(1,'#12020a');
    ctx.globalAlpha=Math.min(1,M.open*1.4);ctx.fillStyle=mg;ctx.beginPath();ctx.ellipse(mx,my+ry*.5,rx,ry,0,0,7);ctx.fill();
  }
  ctx.restore();
}

/* الجمهور: صفّان، كل شخص بإيقاعه، وموجة أيادٍ تنتقل عند كل ضربة */
function drawCrowd(t){
  const E=S.crowd;
  for(const row of[1,0]){
    const n=row?30:22,sp=row?44:58,y0=row?690:722,rr=row?24:32;
    ctx.fillStyle=row?'#0a0614':'#04020a';
    for(let i=0;i<n;i++){
      const w=t-S.waveT-i*.025,rs=w>0?Math.exp(-w*3.5):0;
      const bob=(Math.sin(t*(1.6+(i%5)*.15)+i*1.7)*3+rs*14*E)*(.4+E*.6);
      const x=i*sp-20+(i%2)*14,y=y0+bob-(i%3)*8;
      ctx.beginPath();ctx.arc(x,y,rr+(i%4)*3,0,7);ctx.fill();
      if(i%2===row&&E>0){
        const up=(S.env*.8+rs)*E*55*(.5+((i*37)%10)/20);
        if(up>6){ctx.strokeStyle=ctx.fillStyle;ctx.lineWidth=9;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(x,y-rr+6);ctx.lineTo(x+Math.sin(t*2+i)*14,y-rr-up);ctx.stroke()}
      }
    }
  }
}
function drawLasers(t,A,B){
  const v=Math.max(0,S.treb*2-.15)*S.fx;if(v<.03)return;
  ctx.save();ctx.globalCompositeOperation='lighter';ctx.lineWidth=2;
  for(let i=0;i<7;i++){const x=640+(i-3)*150,a=Math.sin(t*.9+i)*.5+(i-3)*.12;ctx.strokeStyle=col(i%2?A:B,Math.min(.7,v*.5));ctx.beginPath();ctx.moveTo(x,44);ctx.lineTo(x+Math.sin(a)*800,44+Math.cos(a)*800);ctx.stroke()}
  ctx.restore();
}
const PT=[];
function confetti(t,dt,A,B){
  if(S.fx&&S.pulse>.97&&S.beats%8===0&&PT.length<260)for(let i=0;i<70;i++)PT.push({x:640+(Math.random()-.5)*900,y:-20,vx:(Math.random()-.5)*60,vy:60+Math.random()*120,r:Math.random()*6,s:Math.random()*5+3,c:Math.random()<.5?A:B,ph:Math.random()*6});
  for(let i=PT.length-1;i>=0;i--){
    const p=PT[i];p.x+=p.vx*dt+Math.sin(t*3+p.ph)*.6;p.y+=p.vy*dt;p.vy=Math.min(p.vy+40*dt,200);p.ph+=dt;
    if(p.y>H+20){PT.splice(i,1);continue}
    ctx.fillStyle=col(p.c,.85);ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.r+p.ph*2);ctx.fillRect(-p.s,-p.s/2,p.s*2,p.s);ctx.restore();
  }
}

function draw(t){
  const k=S.q,th=THEMES[S.theme],A=th.a,B=th.b,L=S.light,dt=Math.min(.05,Math.max(.001,t-pT));pT=t;
  ctx.setTransform(k,0,0,k,0,0);perfTick(dt);motion(t,dt);
  ctx.fillStyle='#05030a';ctx.fillRect(0,0,W,H);
  ctx.save();ctx.translate(W/2,H/2);ctx.rotate(cam.r+cam.hr);ctx.scale(cam.z,cam.z);ctx.translate(-cam.x-cam.hx,-cam.y-cam.hy);
  const dof=S.dof&&('filter' in ctx)&&cam.z>1.4;
  ctx.save();ctx.translate((cam.x-640)*.3,(cam.y-360)*.3);
  if(dof)ctx.filter='blur('+((cam.z-1.4)*4).toFixed(1)+'px)';
  if(S.full)drawFullBg(t,A,B,L);else{drawBack(t,A,B,L);drawLasers(t,A,B)}if(dof)ctx.filter='none';ctx.restore();
  if(!S.full)drawFloor(A,L);
  layersBack(t,dt);drawSinger(t,A,B,L);layersFront(t);
  if(!S.full){ctx.save();ctx.translate(-(cam.x-640)*.35,-(cam.y-360)*.2);drawCrowd(t);ctx.restore()}
  if(!S.full)confetti(t,dt,A,B);
  ctx.restore();
  if(S.strobe&&S.beat>.6){ctx.fillStyle=col([255,255,255],(S.beat-.6)*.35*L);ctx.fillRect(0,0,W,H)}
  if(S.whip>.05){const g=ctx.createLinearGradient(0,0,W,0);g.addColorStop(0,'rgba(255,255,255,0)');g.addColorStop(.5,'rgba(255,255,255,'+S.whip*.25+')');g.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=g;ctx.fillRect(0,0,W,H)}
  const v=ctx.createRadialGradient(W/2,H/2,H*.35,W/2,H/2,H*.95);v.addColorStop(0,'rgba(0,0,0,0)');v.addColorStop(1,'rgba(0,0,0,.6)');
  ctx.fillStyle=v;ctx.fillRect(0,0,W,H);
  if(S.cutF>.02){ctx.fillStyle='rgba(0,0,0,'+S.cutF+')';ctx.fillRect(0,0,W,H)}
  if(S.bars){ctx.fillStyle='#000';ctx.fillRect(0,0,W,64);ctx.fillRect(0,H-64,W,64)}
  if(S.name){ctx.font='700 38px system-ui,Arial,sans-serif';ctx.textAlign='left';ctx.fillStyle=col(A,1);ctx.fillRect(60,H-158,6,56);ctx.fillStyle='#fff';ctx.fillText(S.name,82,H-112)}
  ctx.font='700 16px system-ui,Arial,sans-serif';ctx.textAlign='right';ctx.fillStyle='rgba(255,255,255,.55)';ctx.fillText('KAMANJAMIX',W-40,S.bars?92:40);
}
initGL();uploadTex();drawCal();
