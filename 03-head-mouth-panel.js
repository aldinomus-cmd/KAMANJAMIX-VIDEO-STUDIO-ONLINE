/* ===== v0.3: لوحة AI Singer Head & Mouth Motion ===== */
{const oc=$('#cal');$('#hmSlot').append(oc.previousElementSibling,oc,oc.nextElementSibling);
 const bs=$('#hmSlot').querySelectorAll('button');bs[0].textContent='Select Mouth Point';bs[1].textContent='Select Neck Pivot';
 const h=[...document.querySelectorAll('.card h2')].find(x=>x.textContent==='حركة المغنية');if(h)h.textContent='الجسم والعمق 2.5D';}
function setSt(){const p=S.ptsSet;$('#hmst').textContent=p.mouth&&p.neck?'تم تحديد النقطتين ✓':'اضغط على الصورة لتحديد: '+(p.mouth?'':'الفم ')+(p.neck?'':'الرقبة ')+(S.img?'':'(الصورة الحالية تجريبية)')}
function resetPts(snap){
  S.neckT={x:.5,y:.24};S.mouthT={x:.5,y:.14};
  if(snap){S.neck={...S.neckT};S.mouth={...S.mouthT}}
  S.ptsSet={mouth:false,neck:false};S.calZ=1;S.calC={x:.5,y:.5};$('#calz').value=1;setSt();drawCal();
}
$('#hon').onchange=e=>S.hon=e.target.checked;
$('#hreset').onclick=()=>resetPts(false);
$('#calz').oninput=e=>{S.calZ=+e.target.value;S.calC={x:S.mouthT.x,y:(S.mouthT.y+S.neckT.y)/2};drawCal()};
$('#hvbtn').onclick=e=>{S.prev=!S.prev;e.target.classList.toggle('on',S.prev);$('#hv').style.display=S.prev?'block':'none'};
$('#hauto').onclick=async()=>{
  const s=S.cv;let r=null;
  try{
    if(window.KMX_FACE_PROVIDER)r=await window.KMX_FACE_PROVIDER.detect(s);
    else if('FaceDetector' in window){
      const f=(await new FaceDetector({fastMode:false,maxDetectedFaces:1}).detect(s))[0];
      if(f){const m=f.landmarks&&f.landmarks.find(l=>l.type==='mouth'),b=f.boundingBox,L=m?m.locations:null;
        const mx=L?L.reduce((a,p)=>a+p.x,0)/L.length:b.x+b.width/2,my=L?L.reduce((a,p)=>a+p.y,0)/L.length:b.y+b.height*.8;
        r={mouth:{x:mx/s.width,y:my/s.height},neck:{x:(b.x+b.width/2)/s.width,y:(b.y+b.height*1.1)/s.height}}}
    }else{$('#hmst').textContent='الكشف التلقائي غير متاح في هذا المتصفح. حدّد النقطتين يدوياً.';return}
  }catch(e){}
  if(!r){$('#hmst').textContent='لم يُعثر على وجه. حدّد النقطتين يدوياً.';return}
  S.mouthT=r.mouth;S.neckT=r.neck;S.ptsSet={mouth:true,neck:true};S.calC={...r.mouth};setSt();drawCal();
};
/* معاينة مكبّرة للرأس من نفس إطار WebGL المشوَّه */
function drawPreview(){
  if(!S.prev||!GLok||texSrc!==S.cv)return;
  const c=$('#hv'),x=c.getContext('2d'),r=Math.max(.04,S.neck.y-S.mouth.y),s=r*4.2*GH,k=c.width/s;
  const sx=(S.mouth.x+PAD)*GW-s/2,sy=(S.mouth.y-r*.15+PAD)*GH-s/2;
  x.fillStyle='#1a1426';x.fillRect(0,0,c.width,c.height);x.imageSmoothingQuality='high';
  x.drawImage(gl_c,sx,sy,s,s,0,0,c.width,c.height);
  if(M.open>.03){
    const hd=headD(S.mouth.x,S.mouth.y),mx=((S.mouth.x+hd.x+PAD)*GW-sx)*k,my=((S.mouth.y+hd.y+PAD)*GH-sy)*k+M.jaw*GH*k*.3;
    const rx=S.mouthW*GH*k/2*(1+.2*M.open),ry=Math.max(.5,M.open*S.mouthW*GH*k*.28);
    x.globalAlpha=Math.min(1,M.open*1.4);x.fillStyle='#2a0509';x.beginPath();x.ellipse(mx,my+ry*.5,rx,ry,0,0,7);x.fill();x.globalAlpha=1;
  }
  x.strokeStyle='#35d4ff';x.lineWidth=2;x.beginPath();x.arc(((S.neck.x+PAD)*GW-sx)*k,((S.neck.y+PAD)*GH-sy)*k,5,0,7);x.stroke();
}
setSt();
