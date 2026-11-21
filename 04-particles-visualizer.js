/* ===== v0.4: PREMIUM PARTICLES & AUDIO VISUALIZER (طبقات مستقلة تُرسم على نفس القماش فتظهر في التصدير) ===== */
Object.assign(S,{full:true,bgBlur:55,pOn:true,pPal:'gold',pmode:'float',pdens:130,psize:1.1,pspd:.8,pop:.85,preact:1,vzOn:true,vzStyle:'wave',vzCol:'goldwhite',vzSize:1,vzH:1,vzTh:3,vzOp:.85,vzX:0,vzY:0,vzOver:true,vzOrn:true,aspd:1,perfK:1,exporting:false,expEnd:0});
const PAL={gold:[[255,208,110],[255,236,170],[255,255,255]],white:[[255,255,255],[235,240,255]],silver:[[205,212,225],[240,244,250]],warm:[[255,170,90],[255,214,150],[255,236,200]]};
const SPR={};
function spr(c){const k=c.join();if(SPR[k])return SPR[k];const s=document.createElement('canvas');s.width=s.height=64;const x=s.getContext('2d'),g=x.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.18,'rgba('+c+',.95)');g.addColorStop(.5,'rgba('+c+',.28)');g.addColorStop(1,'rgba('+c+',0)');x.fillStyle=g;x.fillRect(0,0,64,64);return SPR[k]=s}
['pOn','vzOn','vzOver','vzOrn'].forEach(k=>$('#'+k).onchange=e=>S[k]=e.target.checked);
['pPal','vzStyle','vzCol'].forEach(k=>$('#'+k).onchange=e=>S[k]=e.target.value);
$('#full').onchange=e=>{S.full=e.target.checked;process()};
document.querySelector('[data-k="bgBlur"]').addEventListener('input',()=>buildBg());
const PRE={royal:{pPal:'gold',pmode:'float',pdens:130,psize:1.1,pspd:.8,pop:.85},snow:{pPal:'white',pmode:'fall',pdens:170,psize:.8,pspd:.9,pop:.8},ember:{pPal:'warm',pmode:'rise',pdens:110,psize:1.2,pspd:1.3,pop:.9},dust:{pPal:'silver',pmode:'float',pdens:90,psize:.7,pspd:.6,pop:.7}};
$('#ppre').onchange=e=>{const p=PRE[e.target.value];if(!p)return;Object.assign(S,p);$('#pPal').value=p.pPal;['pdens','psize','pspd','pop'].forEach(k=>document.querySelector('[data-k="'+k+'"]').value=p[k])};
$('#vzprev').onclick=()=>{initAudio();AC.resume();if(!isPlaying())startDemo();$('#vzst').textContent='جارٍ المعاينة بالصوت الحقيقي الحالي.'};
$('#vzexp').onclick=()=>{
  if(mr&&mr.state==='recording'){mr.stop();S.exporting=false;return}
  initAudio();AC.resume();
  if(buf){pauseFile();off=0;playFile();S.exporting='file'}else{startDemo();S.exporting='demo';S.expEnd=performance.now()+20000}
  $('#rec').click();
};

/* أداء: تخفيف تلقائي لعدد الجزيئات عند بطء الإطارات، وإيقاف التصدير عند نهاية الأغنية */
let ema=.016,pAcc=0,lastLbl='';
function perfTick(dt){
  ema+=(dt-ema)*.05;pAcc+=dt;
  if(pAcc>.5){pAcc=0;if(ema>.03)S.perfK=Math.max(.35,S.perfK-.08);else if(ema<.02)S.perfK=Math.min(1,S.perfK+.04)}
  const rec=!!(mr&&mr.state==='recording');
  if(S.exporting&&rec&&((S.exporting==='file'&&!playing)||(S.exporting==='demo'&&performance.now()>S.expEnd))){if(S.exporting==='demo')stopDemo();mr.stop();S.exporting=false}
  const l=rec&&S.exporting?'Stop Export':'Export Video';if(l!==lastLbl){$('#vzexp').textContent=l;lastLbl=l}
}

/* هندسة المغنية: contain كامل في وضع الصورة الكاملة (لا قص) */
function sgeom(){
  const c=S.cv,ar=c.width/c.height;let h=520*S.scale,by=585+S.yoff;
  if(S.full){h=Math.min(H*.94-(S.bars?128:0),W*.94/ar)*Math.min(1,S.scale);by=H/2+h/2+S.yoff*.2}
  return{h,w:h*ar,by};
}
const bgCv=document.createElement('canvas');
function buildBg(){
  const s=S.cv;if(!s)return;
  const w=Math.max(24,Math.round(320*(1-S.bgBlur/100*.92))),h=Math.round(w*9/16);
  bgCv.width=w;bgCv.height=h;const x=bgCv.getContext('2d'),k=Math.max(w/s.width,h/s.height),dw=s.width*k,dh=s.height*k;
  x.imageSmoothingQuality='high';x.drawImage(s,(w-dw)/2,(h-dh)/2,dw,dh);
}
function drawFullBg(t,A,B,L){
  ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
  ctx.drawImage(bgCv,-160,-90,W+320,H+180);
  ctx.fillStyle='rgba(6,3,14,.5)';ctx.fillRect(-300,-300,W+600,H+600);
  const g=ctx.createRadialGradient(640,360,50,640,360,760);g.addColorStop(0,col(A,.1+S.env*.18*L+S.pulse*.1*L));g.addColorStop(1,col(B,0));
  ctx.fillStyle=g;ctx.fillRect(-300,-300,W+600,H+600);
}

/* الجزيئات: طبقة خلف المغنية وطبقة أمامها تختفي تدريجياً فوق الجسم والوجه */
const PS=[];
function mkP(init){return{x:-120+Math.random()*1520,y:init?-80+Math.random()*900:(S.pmode==='fall'?-60:860),z:Math.random(),r:3+Math.random()*7,ph:Math.random()*6.28,ci:Math.random()}}
function partUpdate(t,dt){
  const n=S.pOn?Math.round(S.pdens*S.perfK):0;
  while(PS.length<n)PS.push(mkP(true));
  if(PS.length>n)PS.length=n;
  const sp=S.pspd*S.aspd,boost=1+(S.pulse*1.1+S.env*.5)*S.preact,vy=S.pmode==='fall'?22:S.pmode==='rise'?-20:-6;
  for(const p of PS){
    const dz=.35+p.z*.9;
    p.x+=(Math.sin(t*.35*sp+p.ph+p.y*.004)*14+8*Math.sin(p.ph))*dt*sp*dz;
    p.y+=vy*dt*sp*dz*boost;
    if(p.y<-100||p.y>860||p.x<-160||p.x>1440)Object.assign(p,mkP(false));
  }
}
function drawParts(t,pass){
  if(!PS.length)return;
  const pal=PAL[S.pPal]||PAL.gold,g=pass?sgeom():null,rx=g?(S.full?g.w/2:g.w*.34):0,ry=g?g.h/2:0,cy=g?g.by-g.h/2:0;
  ctx.save();ctx.globalCompositeOperation='lighter';
  for(const p of PS){
    if((p.z>=.55)!==!!pass)continue;
    const x=p.x+(cam.x-640)*(.3-.65*p.z),y=p.y+(cam.y-360)*(.2-.4*p.z);
    let a=S.pop*(.45+.55*(.5+.5*Math.sin(t*(1.2+p.ph*.3)*S.aspd+p.ph*7)))*(1+S.treb*1.4*S.preact)*(.35+p.z*.65);
    if(g){const dx=(x-640)/rx,dy=(y-cy)/ry,d=S.full?Math.max(Math.abs(dx),Math.abs(dy)):Math.hypot(dx,dy),u=clamp((d-1)/.3,0,1);a*=u*u*(3-2*u)}
    if(a<.02)continue;
    const sz=p.r*S.psize*(.5+p.z*.9)*(1+S.pulse*.4*S.preact+S.env*.2);
    ctx.globalAlpha=Math.min(1,a);ctx.drawImage(spr(pal[Math.floor(p.ci*pal.length)]),x-sz,y-sz,sz*2,sz*2);
  }
  ctx.restore();
}

/* الموجات: بيانات حقيقية من AnalyserNode (طيف + موجة زمنية) مع تنعيم هجوم/تلاشي */
const NB=64,NW=128,vb=new Float32Array(NB),pk=new Float32Array(NB),wv=new Float32Array(NW),BE=[];let td=null;
for(let i=0;i<=NB;i++)BE.push(2*Math.pow(210,i/NB));
function vzUpdate(t,dt){
  const live=!!(an&&fd),idle=!isPlaying();
  if(live&&!td)td=new Uint8Array(an.fftSize);
  if(live)an.getByteTimeDomainData(td);
  const ka=1-Math.exp(-dt*22),kr=1-Math.exp(-dt*7);
  for(let i=0;i<NB;i++){
    let v=0;
    if(live){const a=Math.floor(BE[i]),b=Math.max(a+1,Math.floor(BE[i+1]));let s=0;for(let j=a;j<b;j++)s+=fd[j];v=Math.pow(s/(b-a)/255,1.15)*(.85+i/NB*.9)}
    if(idle)v=Math.max(v,.04+.035*Math.sin(t*1.4*S.aspd+i*.35));
    vb[i]+=(v-vb[i])*(v>vb[i]?ka:kr);pk[i]=Math.max(vb[i],pk[i]-dt*.45);
  }
  for(let i=0;i<NW;i++){
    let s=live?(td[i*8]-128)/128*2.2:0;
    if(idle)s+=Math.sin(i*.22+t*2*S.aspd)*.12*Math.sin(Math.PI*i/NW);
    wv[i]+=(s-wv[i])*(1-Math.exp(-dt*24));
  }
}
function vg(x0,y0,x1,y1){
  const g=ctx.createLinearGradient(x0,y0,x1,y1),c=S.vzCol;
  if(c==='white'){g.addColorStop(0,'#ffffff');g.addColorStop(1,'#dfe7fb')}
  else if(c==='gold'){g.addColorStop(0,'#ffe08a');g.addColorStop(.5,'#f2b84b');g.addColorStop(1,'#c98a1f')}
  else{g.addColorStop(0,'#ffd877');g.addColorStop(.5,'#ffffff');g.addColorStop(1,'#ffd877')}
  return g;
}
function glow(p,th){const a=ctx.globalAlpha;ctx.globalAlpha=a*.2;ctx.lineWidth=th*4;ctx.stroke(p);ctx.globalAlpha=a;ctx.lineWidth=th;ctx.stroke(p)}
function star(cx,cy,r,rot,lw){const p=new Path2D();for(let k=0;k<2;k++)for(let i=0;i<=4;i++){const a=rot+k*Math.PI/4+i*Math.PI/2,x=cx+Math.cos(a)*r,y=cy+Math.sin(a)*r;i?p.lineTo(x,y):p.moveTo(x,y)}ctx.lineWidth=lw;ctx.stroke(p)}
function vzCirc(cx,cy,t){
  const R=150*S.vzSize,hh=S.vzH,rot=t*.06*S.aspd,pu=1+S.pulse*.05*S.preact,N=Math.round(160*S.perfK+20);
  ctx.strokeStyle=vg(cx-R*1.6,cy-R*1.6,cx+R*1.6,cy+R*1.6);
  const ring=new Path2D();
  for(let i=0;i<=N;i++){const a=i/N*6.2832+rot,u=Math.abs(i/N*2-1),r=(R+wv[Math.round(u*(NW-1))]*70*hh)*pu,x=cx+Math.cos(a)*r,y=cy+Math.sin(a)*r;i?ring.lineTo(x,y):ring.moveTo(x,y)}
  ring.closePath();glow(ring,S.vzTh);
  const tk=new Path2D(),M2=NB*2;
  for(let i=0;i<M2;i++){const k=i<NB?i:M2-1-i,a=i/M2*6.2832-rot*1.5,r0=R+24*S.vzSize,r1=r0+5+vb[k]*100*hh;tk.moveTo(cx+Math.cos(a)*r0,cy+Math.sin(a)*r0);tk.lineTo(cx+Math.cos(a)*r1,cy+Math.sin(a)*r1)}
  ctx.lineWidth=Math.max(1,S.vzTh*.8);ctx.stroke(tk);
  if(S.vzOrn){ctx.globalAlpha*=.6;star(cx,cy,R*.7,rot*3,Math.max(1,S.vzTh*.5));star(cx,cy,R*.42,-rot*4,1)}
}
function vzHoriz(cx,by){
  const Wd=W*.7*S.vzSize,hh=S.vzH;ctx.strokeStyle=vg(cx-Wd/2,0,cx+Wd/2,0);
  for(const sg of[1,-1]){
    ctx.save();if(sg<0)ctx.globalAlpha*=.3;
    const p=new Path2D();
    for(let i=0;i<NW;i++){const x=cx-Wd/2+i/(NW-1)*Wd,y=by+sg*wv[i]*130*hh*Math.sin(Math.PI*i/(NW-1));i?p.lineTo(x,y):p.moveTo(x,y)}
    glow(p,S.vzTh);ctx.restore();
  }
  ctx.save();ctx.globalAlpha*=.25;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(cx-Wd/2,by);ctx.lineTo(cx+Wd/2,by);ctx.stroke();ctx.restore();
}
function vzBars(cx,by){
  const Wd=W*.7*S.vzSize,st=Wd/NB,bw=Math.max(1.5,st*clamp(.12+S.vzTh*.07,.2,.9)),hh=S.vzH;
  ctx.lineCap='round';ctx.lineWidth=bw;ctx.strokeStyle=vg(0,by-260*hh,0,by);
  const p=new Path2D(),r=new Path2D(),d=new Path2D();
  for(let i=0;i<NB;i++){const x=cx-Wd/2+(i+.5)*st,h=3+vb[i]*250*hh,py=by-(3+pk[i]*250*hh)-8;p.moveTo(x,by);p.lineTo(x,by-h);r.moveTo(x,by+4);r.lineTo(x,by+4+h*.3);d.moveTo(x+.01,py);d.lineTo(x,py)}
  const a=ctx.globalAlpha;ctx.stroke(p);ctx.globalAlpha=a*.25;ctx.stroke(r);ctx.globalAlpha=a*.9;ctx.lineWidth=bw*.8;ctx.stroke(d);
}
function vzWave(cx,by,t){
  const Wd=W*.8*S.vzSize,hh=S.vzH,n=28,sp=S.aspd,a00=ctx.globalAlpha;
  for(let L=0;L<3;L++)for(const sg of[1,-1]){
    ctx.save();
    const pts=[];
    for(let i=0;i<=n;i++){const u=i/n,v=Math.abs(1-2*u),bi=Math.min(NB-1,Math.floor(Math.pow(v,1.3)*NB*.75)),tp=Math.pow(Math.sin(Math.PI*u),.8),a=(vb[bi]*150*(1-L*.25)+4)*hh*(.7+.3*Math.sin(t*sp*1.3+i*.5+L*2.1));pts.push([cx-Wd/2+u*Wd,by-sg*a*tp])}
    const p=new Path2D();p.moveTo(pts[0][0],pts[0][1]);
    for(let i=1;i<n;i++)p.quadraticCurveTo(pts[i][0],pts[i][1],(pts[i][0]+pts[i+1][0])/2,(pts[i][1]+pts[i+1][1])/2);
    p.lineTo(pts[n][0],pts[n][1]);
    const f=new Path2D(p);f.lineTo(cx+Wd/2,by);f.lineTo(cx-Wd/2,by);f.closePath();
    const a0=a00*(sg>0?1:.35)*(1-L*.28);
    ctx.globalAlpha=a0*.14;ctx.fillStyle=vg(0,by-160*hh,0,by);ctx.fill(f);
    ctx.globalAlpha=a0;ctx.strokeStyle=vg(cx-Wd/2,0,cx+Wd/2,0);glow(p,S.vzTh*(1-L*.2));
    ctx.restore();
  }
}
function drawViz(t){
  if(!S.vzOn)return;
  const st=S.vzStyle,cx=640+S.vzX,by=(st==='circ'?330:560)+S.vzY;
  ctx.save();ctx.globalAlpha=S.vzOp;ctx.lineCap='round';ctx.lineJoin='round';
  if(st==='circ')vzCirc(cx,by,t);else if(st==='horiz')vzHoriz(cx,by);else if(st==='bars')vzBars(cx,by);else vzWave(cx,by,t);
  ctx.restore();
}
function layersBack(t,dt){vzUpdate(t,dt);partUpdate(t,dt);drawParts(t,0);if(!(S.full&&S.vzOver))drawViz(t)}
function layersFront(t){if(S.full&&S.vzOver)drawViz(t);drawParts(t,1)}
buildBg();
