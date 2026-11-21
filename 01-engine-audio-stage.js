const $=s=>document.querySelector(s),W=1280,H=720,cv=$('#stage'),ctx=cv.getContext('2d');
cv.width=W;cv.height=H;
const S={theme:0,cam:'auto',camAmt:1,light:1,strobe:true,haze:true,bars:true,key:false,tol:60,feather:45,scale:1,yoff:0,name:'',img:null,cv:null,mode:'none',bass:0,mid:0,treb:0,avg:0,beat:0,lastBeat:0,beats:0};
const THEMES=[{n:'نيون',a:[255,45,170],b:[40,220,255]},{n:'ذهبي',a:[255,190,60],b:[255,110,40]},{n:'جليدي',a:[110,185,255],b:[190,150,255]},{n:'ناري',a:[255,60,40],b:[255,170,30]}];
const col=(c,a)=>`rgba(${c[0]},${c[1]},${c[2]},${a})`;

/* ---------- Audio ---------- */
let AC,master,an,recDest,fd,noise,buf=null,srcNode=null,off=0,startAt=0,playing=false,demoOn=false,demoTimer,nextT=0,step=0,seeking=false;
function initAudio(){
  if(AC)return;
  AC=new (window.AudioContext||window.webkitAudioContext)();
  master=AC.createGain();master.gain.value=+$('#vol').value;
  an=AC.createAnalyser();an.fftSize=1024;an.smoothingTimeConstant=.55;
  recDest=AC.createMediaStreamDestination();
  master.connect(an);an.connect(AC.destination);an.connect(recDest);
  fd=new Uint8Array(an.frequencyBinCount);
  noise=AC.createBuffer(1,AC.sampleRate*.5,AC.sampleRate);
  const d=noise.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
}
const env=(g,t,pk,dur)=>{g.gain.setValueAtTime(pk,t);g.gain.exponentialRampToValueAtTime(.001,t+dur)};
function kick(t){const o=AC.createOscillator(),g=AC.createGain();o.frequency.setValueAtTime(160,t);o.frequency.exponentialRampToValueAtTime(42,t+.14);env(g,t,1,.38);o.connect(g).connect(master);o.start(t);o.stop(t+.4)}
function noiseHit(t,type,f,pk,dur){const s=AC.createBufferSource(),fl=AC.createBiquadFilter(),g=AC.createGain();s.buffer=noise;fl.type=type;fl.frequency.value=f;env(g,t,pk,dur);s.connect(fl).connect(g).connect(master);s.start(t);s.stop(t+dur)}
function bass(t,f){const o=AC.createOscillator(),g=AC.createGain();o.type='triangle';o.frequency.value=f;env(g,t,.5,.24);o.connect(g).connect(master);o.start(t);o.stop(t+.26)}
function sched(){
  const spb=60/112/4;
  while(nextT<AC.currentTime+.12){
    const s=step%16;
    if(s%4===0)kick(nextT);
    if(s%4===2)noiseHit(nextT,'highpass',7000,.18,.05);
    if(s===4||s===12)noiseHit(nextT,'bandpass',1800,.45,.16);
    if([0,3,6,10,14].includes(s))bass(nextT,[55,55,65.4,49][(step>>4)%4]);
    nextT+=spb;step++;
  }
}
function startDemo(){initAudio();AC.resume();pauseFile();S.mode='demo';demoOn=true;nextT=AC.currentTime+.05;step=0;clearInterval(demoTimer);demoTimer=setInterval(sched,25)}
function stopDemo(){demoOn=false;clearInterval(demoTimer)}
function playFile(){if(!buf)return;initAudio();AC.resume();stopDemo();srcNode=AC.createBufferSource();srcNode.buffer=buf;srcNode.connect(master);
  srcNode.onended=()=>{if(playing&&AC.currentTime-startAt>=buf.duration-.1){playing=false;off=0}};
  srcNode.start(0,off);startAt=AC.currentTime-off;playing=true;S.mode='file'}
function pauseFile(){if(playing){off=AC.currentTime-startAt;srcNode.onended=null;try{srcNode.stop()}catch(e){}playing=false}}
const curTime=()=>playing?AC.currentTime-startAt:off;
const isPlaying=()=>S.mode==='demo'?demoOn:playing;
function toggle(){
  initAudio();AC.resume();
  if(S.mode==='demo'){demoOn?stopDemo():startDemo()}
  else if(buf){playing?pauseFile():playFile()}
  else startDemo();
}
$('#play').onclick=toggle;
$('#demo').onclick=()=>{pauseFile();demoOn?stopDemo():startDemo()};
$('#vol').oninput=e=>{if(master)master.gain.value=+e.target.value};
$('#seek').onpointerdown=()=>seeking=true;
$('#seek').onchange=e=>{seeking=false;if(!buf)return;off=+e.target.value;if(playing){srcNode.onended=null;try{srcNode.stop()}catch(x){}playFile()}};
$('#mp3').onchange=async e=>{
  const f=e.target.files[0];if(!f)return;
  initAudio();AC.resume();$('#trk').textContent='جارٍ فك ترميز الملف…';
  try{
    const ab=await f.arrayBuffer();buf=await AC.decodeAudioData(ab);
    pauseFile();stopDemo();off=0;$('#seek').max=buf.duration;$('#trk').textContent='الملف: '+f.name;S.mode='file';playFile();
  }catch(err){$('#trk').textContent='تعذّر قراءة الملف. جرّب ملف MP3 آخر.'}
};

function analyse(now){
  if(!an){S.bass*=.9;S.mid*=.9;S.treb*=.9;S.beat*=.88;return}
  an.getByteFrequencyData(fd);
  const av=(a,b)=>{let s=0;for(let i=a;i<b;i++)s+=fd[i];return s/(b-a)/255};
  const b=av(1,6);S.bass=b;S.mid=av(6,60);S.treb=av(60,300);
  S.avg=S.avg*.94+b*.06;
  if(b>S.avg*1.18+.04&&b>.45&&now-S.lastBeat>260){S.beat=1;S.lastBeat=now;S.beats++}
  S.beat*=.88;
}

/* ---------- Singer image ---------- */
const demoSinger=(()=>{
  const c=document.createElement('canvas');c.width=400;c.height=900;const x=c.getContext('2d');
  const g=x.createLinearGradient(0,0,0,900);g.addColorStop(0,'#3a2f5c');g.addColorStop(1,'#0e0a1c');x.fillStyle=g;
  x.beginPath();x.ellipse(200,120,52,62,0,0,7);x.fill();
  x.beginPath();x.moveTo(150,110);x.quadraticCurveTo(110,300,140,430);x.lineTo(175,200);x.fill();
  x.beginPath();x.moveTo(250,110);x.quadraticCurveTo(290,300,260,430);x.lineTo(225,200);x.fill();
  x.fillRect(184,175,32,40);
  x.beginPath();x.moveTo(150,215);x.quadraticCurveTo(200,200,250,215);x.lineTo(270,420);x.lineTo(330,890);x.lineTo(70,890);x.lineTo(130,420);x.closePath();x.fill();
  x.lineWidth=26;x.lineCap='round';x.strokeStyle='#2c2350';
  x.beginPath();x.moveTo(250,235);x.quadraticCurveTo(310,260,262,150);x.stroke();
  x.beginPath();x.moveTo(150,235);x.quadraticCurveTo(110,330,160,400);x.stroke();
  x.fillStyle='#8f86b5';x.beginPath();x.arc(258,132,12,0,7);x.fill();
  return c;
})();
S.cv=demoSinger;
function process(){
  if(!S.img){S.cv=demoSinger;uploadTex();drawCal();buildBg();return}
  const im=S.img,sc=Math.min(1,1600/im.height),w=Math.round(im.width*sc),h=Math.round(im.height*sc);
  const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d',{willReadFrequently:true});
  x.drawImage(im,0,0,w,h);
  if(S.key&&!S.full){
    const d=x.getImageData(0,0,w,h),p=d.data;let r=0,g=0,b=0,n=0;
    for(const[cx,cy]of[[3,3],[w-4,3],[3,h-4],[w-4,h-4]])for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){const i=((cy+dy)*w+cx+dx)*4;r+=p[i];g+=p[i+1];b+=p[i+2];n++}
    r/=n;g/=n;b/=n;const lo=S.tol*.6,hi=S.tol;
    for(let i=0;i<p.length;i+=4){const dd=Math.hypot(p[i]-r,p[i+1]-g,p[i+2]-b);p[i+3]=dd<=lo?0:dd>=hi?p[i+3]:p[i+3]*(dd-lo)/(hi-lo)}
    x.putImageData(d,0,0);
  }
  if(S.feather>0&&!S.full){
    const f=Math.min(.95,S.feather/100*.7);
    x.save();x.globalCompositeOperation='destination-in';x.translate(w/2,h/2);x.scale(1,h/w);
    const g=x.createRadialGradient(0,0,0,0,0,w/2);g.addColorStop(0,'#000');g.addColorStop(1-f,'#000');g.addColorStop(1,'rgba(0,0,0,0)');
    x.fillStyle=g;x.fillRect(-w/2,-w/2,w,w);x.restore();
  }
  S.cv=c;uploadTex();drawCal();buildBg();
}
$('#img').onchange=e=>{
  const f=e.target.files[0];if(!f)return;
  const fr=new FileReader();
  fr.onload=()=>{const im=new Image();im.onload=()=>{S.img=im;resetPts(true);process()};im.src=fr.result};
  fr.readAsDataURL(f);
};

/* ---------- UI bindings ---------- */
document.querySelectorAll('input[data-k]').forEach(el=>el.oninput=()=>{S[el.dataset.k]=+el.value;if(el.dataset.p)process()});
$('#key').onchange=e=>{S.key=e.target.checked;process()};
$('#bars').onchange=e=>S.bars=e.target.checked;
$('#strobe').onchange=e=>S.strobe=e.target.checked;
$('#haze').onchange=e=>S.haze=e.target.checked;
$('#name').oninput=e=>S.name=e.target.value.trim();
const CAMS=[['auto','تلقائي'],['wide','واسعة'],['close','قريبة'],['push','تقريب بطيء'],['orbit','دوران']];
CAMS.forEach(([k,n])=>{const b=document.createElement('button');b.textContent=n;b.dataset.k=k;b.onclick=()=>{S.cam=k;mark('#cams',b)};$('#cams').append(b)});
THEMES.forEach((t,i)=>{const b=document.createElement('button');b.innerHTML=`<span class="sw" style="background:linear-gradient(90deg,${col(t.a,1)},${col(t.b,1)})"></span>${t.n}`;b.onclick=()=>{S.theme=i;mark('#themes',b)};$('#themes').append(b)});
function mark(sel,b){document.querySelectorAll(sel+' button').forEach(x=>x.classList.toggle('on',x===b))}
mark('#cams',$('#cams button'));mark('#themes',$('#themes button'));
addEventListener('keydown',e=>{if(e.code==='Space'&&!/INPUT|TEXTAREA|BUTTON/.test(e.target.tagName)){e.preventDefault();toggle()}});

/* ---------- Recording ---------- */
let mr,chunks=[];
$('#rec').onclick=()=>{
  if(mr&&mr.state==='recording'){mr.stop();return}
  if(!window.MediaRecorder||!cv.captureStream){$('#recs').textContent='المتصفح لا يدعم التسجيل.';return}
  initAudio();AC.resume();
  const st=cv.captureStream(30);recDest.stream.getAudioTracks().forEach(t=>st.addTrack(t));
  const mt=['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'].find(m=>MediaRecorder.isTypeSupported(m));
  mr=new MediaRecorder(st,mt?{mimeType:mt,videoBitsPerSecond:6e6}:{});chunks=[];
  mr.ondataavailable=e=>e.data.size&&chunks.push(e.data);
  mr.onstop=()=>{
    const u=URL.createObjectURL(new Blob(chunks,{type:'video/webm'}));
    $('#pv').src=u;$('#pv').style.display='block';$('#dl').href=u;$('#dl').style.display='inline-block';
    $('#rec').textContent='بدء التسجيل';$('#rec').classList.remove('on');$('#recs').textContent='تم التسجيل. إن لم يعمل التحميل هنا، افتح التطبيق في نافذة مستقلة.';
  };
  mr.start();$('#rec').textContent='إيقاف التسجيل';$('#rec').classList.add('on');$('#recs').textContent='جارٍ التسجيل…';
};

/* ---------- Camera ---------- */
const SH={wide:{z:1,x:640,y:360,r:0},mid:{z:1.3,x:640,y:380,r:0},close:{z:1.95,x:640,y:215,r:0},orbL:{z:1.25,x:565,y:340,r:-.035},orbR:{z:1.25,x:715,y:340,r:.035},low:{z:1.5,x:640,y:470,r:.02}};
const cam={z:1,x:640,y:360,r:0},AUTO=['wide','mid','orbL','close','orbR','low'];let ai=0,shotT=0;
function camUpdate(t,dt){
  let g;
  if(S.cam==='auto'){if(t-shotT>5.5||(S.beat>.99&&S.beats%32===0&&t-shotT>2.5)){ai=(ai+1)%AUTO.length;shotT=t}g=SH[AUTO[ai]]}
  else if(S.cam==='push'){const p=(Math.sin(t*.15)+1)/2;g={z:1+p*.9,x:640,y:360-p*150,r:0}}
  else if(S.cam==='orbit'){const s=Math.sin(t*.4);g={z:1.25,x:640+s*110,y:340,r:s*.04}}
  else g=SH[S.cam];
  const a=S.camAmt,k=1-Math.exp(-dt*2.2);
  const tz=1+(g.z-1)*a,tx=640+(g.x-640)*a,ty=360+(g.y-360)*a,tr=g.r*a;
  cam.z+=(tz-cam.z)*k;cam.x+=(tx-cam.x)*k;cam.y+=(ty-cam.y)*k;cam.r+=(tr-cam.r)*k;
}

/* ---------- Scene ---------- */
const haze=Array.from({length:60},()=>({x:Math.random()*1500-110,y:Math.random()*600,r:60+Math.random()*120,s:3+Math.random()*8}));
function drawBack(t,A,B,L){
  ctx.fillStyle='#08041a';ctx.fillRect(-400,-400,W+800,1100);
  let g=ctx.createRadialGradient(640,300,20,640,300,560);g.addColorStop(0,col(A,.1+S.bass*.28*L));g.addColorStop(1,col(A,0));
  ctx.fillStyle=g;ctx.fillRect(-400,-400,W+800,1100);
  ctx.globalCompositeOperation='lighter';
  for(let i=0;i<26;i++){
    const v=fd?fd[2+i*3]/255:.12+.08*Math.sin(t*2+i*.5),h=50+v*270*L;
    ctx.fillStyle=col(i%2?A:B,.2+v*.3);ctx.fillRect(100+i*43,520-h,28,h);
  }
  const xs=[140,390,640,890,1140],P=1+S.beat*.5;
  xs.forEach((x,i)=>{
    const ang=Math.sin(t*.8+i*1.7)*.45+(i-2)*.12,len=720,sp=80,ex=x+Math.sin(ang)*len,ey=40+Math.cos(ang)*len;
    const gr=ctx.createLinearGradient(x,40,ex,ey),c=i%2?B:A,al=Math.min(.6,.12*L*(1+S.bass*2.2)*P);
    gr.addColorStop(0,col(c,al));gr.addColorStop(1,col(c,0));
    ctx.fillStyle=gr;ctx.beginPath();ctx.moveTo(x-6,40);ctx.lineTo(x+6,40);ctx.lineTo(ex+sp,ey);ctx.lineTo(ex-sp,ey);ctx.fill();
  });
  ctx.globalCompositeOperation='source-over';
  ctx.fillStyle='#140d28';ctx.fillRect(-300,20,W+600,24);
  xs.forEach((x,i)=>{ctx.fillStyle=col(i%2?B:A,.6+S.bass*.4);ctx.beginPath();ctx.arc(x,40,7,0,7);ctx.fill()});
  if(S.haze){ctx.globalCompositeOperation='lighter';haze.forEach(p=>{
    p.x+=p.s*.016;if(p.x>W+200)p.x=-200;
    const q=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,p.r);q.addColorStop(0,col(B,.035+S.mid*.05));q.addColorStop(1,col(B,0));
    ctx.fillStyle=q;ctx.fillRect(p.x-p.r,p.y-p.r,p.r*2,p.r*2)});ctx.globalCompositeOperation='source-over'}
}
function drawFloor(A,L){
  const g=ctx.createLinearGradient(0,560,0,900);g.addColorStop(0,'#0c0720');g.addColorStop(1,col(A,.12));
  ctx.fillStyle=g;ctx.fillRect(-400,560,W+800,520);
  ctx.strokeStyle=col(A,.1+S.bass*.28*L);ctx.lineWidth=1.5;
  for(let i=-14;i<=14;i++){ctx.beginPath();ctx.moveTo(640+i*40,560);ctx.lineTo(640+i*200,900);ctx.stroke()}
  for(let k=1;k<9;k++){const y=560+k*k*4.5;ctx.beginPath();ctx.moveTo(-400,y);ctx.lineTo(W+400,y);ctx.stroke()}
  ctx.save();ctx.translate(640,585);ctx.scale(1,.16);
  const r=330+S.bass*150,q=ctx.createRadialGradient(0,0,0,0,0,r);q.addColorStop(0,col(A,.55*L));q.addColorStop(1,col(A,0));
  ctx.fillStyle=q;ctx.beginPath();ctx.arc(0,0,r,0,7);ctx.fill();ctx.restore();
}
function drawSinger(t,A,B,L){
  const c=S.cv;if(!c)return;
  const h=520*S.scale,w=h*c.width/c.height,by=585+S.yoff,bn=1+S.bass*.035+S.beat*.02,sw=Math.sin(t*1.3)*.012*(.5+S.mid*2);
  ctx.save();ctx.globalCompositeOperation='lighter';
  const g=ctx.createRadialGradient(640,by-h*.55,0,640,by-h*.55,h*.85);g.addColorStop(0,col(A,.12+S.bass*.35*L));g.addColorStop(1,col(A,0));
  ctx.fillStyle=g;ctx.fillRect(640-h,by-h*1.5,h*2,h*2);ctx.restore();
  ctx.save();ctx.translate(640,by);ctx.scale(1,-.3);ctx.globalAlpha=.2;ctx.drawImage(c,-w/2,-h,w,h);ctx.restore();
  ctx.save();ctx.translate(640,by);ctx.rotate(sw);ctx.scale(bn,bn);
  ctx.shadowColor=col(A,.95);ctx.shadowBlur=20+S.bass*55*L;ctx.drawImage(c,-w/2,-h,w,h);
  ctx.shadowColor=col(B,.6);ctx.shadowBlur=10+S.treb*40*L;ctx.shadowOffsetX=8;ctx.drawImage(c,-w/2,-h,w,h);
  ctx.restore();
}
function drawCrowd(t){
  ctx.fillStyle='#04020a';
  for(let i=0;i<24;i++){
    const bob=Math.sin(t*3+i)*6*(.3+S.bass*2.5),r=32+(i%4)*5;
    ctx.beginPath();ctx.arc(i*58-30+(i%2)*22,715+bob-(i%3)*10,r,0,7);ctx.fill();
  }
}
function draw(t){
  const th=THEMES[S.theme],A=th.a,B=th.b,L=S.light;
  ctx.fillStyle='#05030a';ctx.fillRect(0,0,W,H);
  ctx.save();ctx.translate(W/2,H/2);ctx.rotate(cam.r);ctx.scale(cam.z,cam.z);ctx.translate(-cam.x,-cam.y);
  ctx.save();ctx.translate((cam.x-640)*.3,(cam.y-360)*.3);drawBack(t,A,B,L);ctx.restore();
  drawFloor(A,L);drawSinger(t,A,B,L);
  ctx.save();ctx.translate(-(cam.x-640)*.35,-(cam.y-360)*.2);drawCrowd(t);ctx.restore();
  ctx.restore();
  if(S.strobe&&S.beat>.6){ctx.fillStyle=col([255,255,255],(S.beat-.6)*.35*L);ctx.fillRect(0,0,W,H)}
  const v=ctx.createRadialGradient(W/2,H/2,H*.35,W/2,H/2,H*.95);v.addColorStop(0,'rgba(0,0,0,0)');v.addColorStop(1,'rgba(0,0,0,.6)');
  ctx.fillStyle=v;ctx.fillRect(0,0,W,H);
  if(S.bars){ctx.fillStyle='#000';ctx.fillRect(0,0,W,64);ctx.fillRect(0,H-64,W,64)}
  if(S.name){
    ctx.font='700 38px system-ui,Arial,sans-serif';ctx.textAlign='left';
    ctx.fillStyle=col(A,1);ctx.fillRect(60,H-158,6,56);ctx.fillStyle='#fff';ctx.fillText(S.name,82,H-112);
  }
  ctx.font='700 16px system-ui,Arial,sans-serif';ctx.textAlign='right';ctx.fillStyle='rgba(255,255,255,.55)';ctx.fillText('KAMANJAMIX',W-40,S.bars?92:40);
}

/* ---------- Loop ---------- */
const fmt=s=>Math.floor(s/60)+':'+String(Math.floor(s%60)).padStart(2,'0');
const mt=[...document.querySelectorAll('#meters i')];
let last=performance.now(),T=0;
function frame(now){
  const dt=Math.min(.05,(now-last)/1000);last=now;T+=dt;
  analyse(now);camUpdate(T,dt);draw(T);
  const p=isPlaying();
  $('#play').textContent=p?'إيقاف مؤقت':'تشغيل';
  $('#demo').classList.toggle('on',S.mode==='demo'&&demoOn);
  $('#hint').style.opacity=p?0:1;
  if(S.mode==='file'&&buf){const c=Math.min(curTime(),buf.duration);if(!seeking)$('#seek').value=c;$('#cur').textContent=fmt(c);$('#dur').textContent=fmt(buf.duration)}
  [S.bass,S.mid,S.treb].forEach((v,i)=>mt[i].style.height=Math.max(3,Math.min(30,v*34))+'px');
  requestAnimationFrame(frame);
}
window.addEventListener('load',()=>{last=performance.now();requestAnimationFrame(frame)});
