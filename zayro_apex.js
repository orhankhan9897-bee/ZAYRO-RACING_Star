'use strict';
/* ZAYRO APEX v1.0 — loads last (base game code untouched).
   REALISTIC : analogue speedometer + tachometer cluster (gear, shift light, redline), friction-circle G meter,
               wind rush, tyre squeal, turbo whistle and blow-off valve sound (WebAudio, no files).
   POWERFUL  : turbo spool (up to ~+15% mid-range pull, never above the car's normal top speed) and a launch kick.
   ADVANCED  : live telemetry (top/avg speed, peak G, drift time) shown on the finish screen, V = photo mode (hide HUD).
   Every block is wrapped in try/catch so a failure here can never stop the game. */
(function(){
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const S={spool:0,latG:0,lonG:0,pLV:0,pSp:0,gasPrev:false,lastTime:0,
  top:0,sum:0,n:0,maxLat:0,maxLon:0,drift:0,turbo:0,dSpeed:0,dRpm:900,trail:[]};
function resetStats(){S.top=S.sum=S.n=S.maxLat=S.maxLon=S.drift=S.turbo=0;S.spool=0;S.trail.length=0;}

/* ================================================================ POWER + G FORCE (after each update) */
function post(dt){
  if(!running||paused||finished)return;
  if(time<S.lastTime-.5)resetStats();
  S.lastTime=time;
  const inpt=fieldInputs(),spec=cars[selectedCar];
  const topRef=(spec.top+garageUpgrades.speed*2.5)*(1+(stage-1)*.025);
  const fwd=player.speed>=0;
  const target=inpt.gas&&fwd?clamp((engineRPM-2400)/3600,0,1):0;
  S.spool+=(target-S.spool)*Math.min(1,dt*(target>S.spool?1.3:3.2));
  if(S.gasPrev&&!inpt.gas&&S.spool>.5)bov();
  S.gasPrev=!!inpt.gas;
  if(inpt.gas&&fwd&&!tractionActive&&player.speed<topRef*.985){
    const launch=player.speed<14?1.8*(1-player.speed/14):0;
    const extra=S.spool*1.2*(1-player.speed/topRef)+launch;
    player.speed+=Math.max(0,extra)*dt;
    S.turbo+=dt*S.spool;
  }
  // G forces (smoothed)
  const d=Math.max(.001,dt);
  const lat=clamp((player.lateralVelocity-S.pLV)/d/9.81,-2.4,2.4),lon=clamp((player.speed-S.pSp)/d/9.81,-2.4,2.4);
  S.pLV=player.lateralVelocity;S.pSp=player.speed;
  const k=Math.min(1,dt*6);S.latG+=(lat-S.latG)*k;S.lonG+=(lon-S.lonG)*k;
  S.maxLat=Math.max(S.maxLat,Math.abs(S.latG));S.maxLon=Math.max(S.maxLon,Math.abs(S.lonG));
  const kmh=Math.abs(player.speed)*3.6;
  S.top=Math.max(S.top,kmh);S.sum+=kmh;S.n++;
  if(Math.abs(player.slip)>.28&&Math.abs(player.speed)>22)S.drift+=dt;
}
const _u=update;
update=function(dt){
  _u(dt);
  try{post(dt);}catch(e){if(!update.err){update.err=1;console.error('ZAYRO APEX update',e);}}
};

/* ================================================================ AUDIO */
let ac=null,wind,screech,whine,master,noiseBuf;
function initAudio(){
  if(ac)return;
  const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
  ac=new AC();
  const len=ac.sampleRate*2;noiseBuf=ac.createBuffer(1,len,ac.sampleRate);
  const ch=noiseBuf.getChannelData(0);let last=0;
  for(let i=0;i<len;i++){const w=Math.random()*2-1;last=(last+.06*w)/1.06;ch[i]=(w*.5+last*9)*.6;}
  master=ac.createGain();master.gain.value=.55;master.connect(ac.destination);
  const noise=(type,f,q)=>{const s=ac.createBufferSource();s.buffer=noiseBuf;s.loop=true;
    const fl=ac.createBiquadFilter();fl.type=type;fl.frequency.value=f;fl.Q.value=q;
    const g=ac.createGain();g.gain.value=0;s.connect(fl);fl.connect(g);g.connect(master);s.start();return {fl,g};};
  wind=noise('bandpass',500,.7);screech=noise('bandpass',2600,9);
  const o=ac.createOscillator(),og=ac.createGain();o.type='sine';o.frequency.value=1800;og.gain.value=0;
  o.connect(og);og.connect(master);o.start();whine={o,g:og};
}
['pointerdown','keydown','touchstart'].forEach(ev=>addEventListener(ev,()=>{try{initAudio();if(ac&&ac.state==='suspended')ac.resume();}catch(_){}},{passive:true}));
function bov(){
  try{
    if(!ac)return;const s=ac.createBufferSource();s.buffer=noiseBuf;
    const f=ac.createBiquadFilter();f.type='highpass';f.frequency.value=1900;
    const g=ac.createGain(),t=ac.currentTime;
    g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.16,t+.02);g.gain.exponentialRampToValueAtTime(.001,t+.4);
    s.connect(f);f.connect(g);g.connect(master);s.start(t);s.stop(t+.45);
  }catch(_){}
}
setInterval(()=>{
  try{
    if(!ac)return;
    const act=running&&!paused&&!finished,v=act?Math.abs(player.speed):0,t=ac.currentTime;
    wind.g.gain.setTargetAtTime(act?Math.pow(clamp(v/90,0,1),2)*.2:0,t,.1);
    wind.fl.frequency.setTargetAtTime(350+v*22,t,.1);
    const slide=clamp((Math.abs(player.slip)-.2)*2.4,0,1),brk=(act&&fieldInputs().brake&&v>34)?.35:0;
    screech.g.gain.setTargetAtTime(act&&v>14?clamp(slide+brk,0,1)*.1:0,t,.05);
    screech.fl.frequency.setTargetAtTime(2300+Math.min(1200,v*14),t,.08);
    whine.o.frequency.setTargetAtTime(1800+S.spool*4200,t,.08);
    whine.g.gain.setTargetAtTime(act?S.spool*.012:0,t,.08);
  }catch(_){}
},50);

/* ================================================================ INSTRUMENT CLUSTER */
const cl=document.createElement('div');cl.id='zaCluster';cl.setAttribute('aria-hidden','true');
cl.innerHTML='<canvas width="720" height="300"></canvas>';document.body.appendChild(cl);
const c=cl.firstChild.getContext('2d');
const A0=Math.PI*.75,SW=Math.PI*1.5,ang=(v,m)=>A0+clamp(v/m,0,1)*SW;
function dial(x,y,r,max,minor,major,labelStep,redFrom,val,rim){
  // bezel + face
  const bz=c.createLinearGradient(x-r,y-r,x+r,y+r);bz.addColorStop(0,rim||'#aab2b8');bz.addColorStop(.5,'#3a4147');bz.addColorStop(1,'#14181b');
  c.beginPath();c.arc(x,y,r,0,6.283);c.fillStyle=bz;c.fill();
  const fc=c.createRadialGradient(x,y-r*.2,r*.1,x,y,r*.92);fc.addColorStop(0,'#1c242a');fc.addColorStop(1,'#050708');
  c.beginPath();c.arc(x,y,r-8,0,6.283);c.fillStyle=fc;c.fill();
  // redline band
  c.beginPath();c.arc(x,y,r-18,ang(redFrom,max),ang(max,max));c.lineWidth=6;c.strokeStyle='#d8262c';c.stroke();
  // ticks + labels
  c.textAlign='center';c.textBaseline='middle';
  for(let v=0;v<=max+.01;v+=minor){
    const a=ang(v,max),mj=Math.abs(v/major-Math.round(v/major))<1e-6,l=mj?15:8;
    c.beginPath();c.moveTo(x+Math.cos(a)*(r-12),y+Math.sin(a)*(r-12));c.lineTo(x+Math.cos(a)*(r-12-l),y+Math.sin(a)*(r-12-l));
    c.lineWidth=mj?2.6:1.2;c.strokeStyle=v>=redFrom?'#ff5a5f':'#e9eef0';c.stroke();
  }
  c.font="700 15px 'Space Mono',monospace";c.fillStyle='#e9eef0';
  for(let v=0;v<=max+.01;v+=labelStep){const a=ang(v,max);c.fillText(String(Math.round(v)),x+Math.cos(a)*(r-40),y+Math.sin(a)*(r-40));}
  // needle
  const a=ang(val,max);
  c.save();c.shadowColor='#ff6a3a';c.shadowBlur=10;
  c.beginPath();c.moveTo(x-Math.cos(a)*18,y-Math.sin(a)*18);c.lineTo(x+Math.cos(a)*(r-22),y+Math.sin(a)*(r-22));
  c.lineWidth=4;c.lineCap='round';c.strokeStyle='#ff5a2a';c.stroke();c.restore();
  c.beginPath();c.arc(x,y,10,0,6.283);c.fillStyle='#222a2f';c.fill();c.lineWidth=2;c.strokeStyle='#8a949a';c.stroke();
  // glass glare
  const gl2=c.createLinearGradient(x-r,y-r,x,y);gl2.addColorStop(0,'rgba(255,255,255,.16)');gl2.addColorStop(1,'rgba(255,255,255,0)');
  c.beginPath();c.arc(x,y,r-8,Math.PI*1.05,Math.PI*1.75);c.lineTo(x,y);c.closePath();c.fillStyle=gl2;c.fill();
}
function bar(x,y,w,label,pct,col,warn){
  c.font="700 12px 'Space Mono',monospace";c.textAlign='left';c.fillStyle='#aab5b1';c.fillText(label,x,y);
  c.fillStyle='#000a';c.fillRect(x,y+6,w,9);c.strokeStyle='#4b565c';c.lineWidth=1;c.strokeRect(x+.5,y+6.5,w-1,8);
  c.fillStyle=warn?'#ff5a5f':col;c.fillRect(x+1,y+7,Math.max(0,(w-2)*clamp(pct,0,1)),7);
}
let lastDraw=0;
function draw(now){
  requestAnimationFrame(draw);
  if(now-lastDraw<33)return;lastDraw=now;
  const b=document.body;if(!b.classList.contains('zm-drive')||b.classList.contains('zm-touchui'))return;
  try{
    const kmh=Math.abs(player.speed)*3.6;
    S.dSpeed+=(kmh-S.dSpeed)*.35;S.dRpm+=(engineRPM-S.dRpm)*.4;
    c.clearRect(0,0,720,300);
    // panel plate
    const pl=c.createLinearGradient(0,0,0,300);pl.addColorStop(0,'rgba(18,24,28,.9)');pl.addColorStop(1,'rgba(6,9,11,.92)');
    c.fillStyle=pl;c.beginPath();c.roundRect?c.roundRect(2,2,716,296,22):c.rect(2,2,716,296);c.fill();
    c.lineWidth=2;c.strokeStyle='#4a555c';c.stroke();
    // speedo (0-360)
    dial(150,150,128,360,20,40,40,300,S.dSpeed,'#c3cbd0');
    c.fillStyle='#fff';c.font="900 italic 44px 'Barlow Condensed',Impact,sans-serif";c.textAlign='center';c.fillText(String(Math.round(S.dSpeed)).padStart(3,'0'),150,205);
    c.font="700 11px 'Space Mono',monospace";c.fillStyle='#d8ff38';c.fillText('KM/H',150,228);
    // tacho (x1000)
    const flash=S.dRpm>6500&&Math.floor(now/110)%2===0;
    dial(395,165,100,8,.5,1,1,6.6,S.dRpm/1000,flash?'#ff4a4f':'#aab2b8');
    c.fillStyle=flash?'#ff7a7f':'#f5d47d';c.font="900 italic 46px 'Barlow Condensed',Impact,sans-serif";c.textAlign='center';
    c.fillText(player.speed<-1?'R':String(currentGear),395,208);
    c.font="700 9px 'Space Mono',monospace";c.fillStyle='#aab5b1';c.fillText('x1000 RPM',395,230);
    // G meter (friction circle)
    const gx=625,gy=88,gr=58;
    c.beginPath();c.arc(gx,gy,gr,0,6.283);c.fillStyle='#070b0d';c.fill();c.lineWidth=2;c.strokeStyle='#4a555c';c.stroke();
    c.strokeStyle='#ffffff30';c.lineWidth=1;
    for(const f of [.5,1]){c.beginPath();c.arc(gx,gy,gr*f*.9,0,6.283);c.stroke();}
    c.beginPath();c.moveTo(gx-gr,gy);c.lineTo(gx+gr,gy);c.moveTo(gx,gy-gr);c.lineTo(gx,gy+gr);c.stroke();
    const px=gx-clamp(S.latG/2,-1,1)*gr*.9,py=gy+clamp(S.lonG/2,-1,1)*gr*.9;
    S.trail.push([px,py]);if(S.trail.length>18)S.trail.shift();
    S.trail.forEach((p,i)=>{c.fillStyle=`rgba(216,255,56,${i/S.trail.length*.35})`;c.beginPath();c.arc(p[0],p[1],3,0,6.283);c.fill();});
    c.save();c.shadowColor='#d8ff38';c.shadowBlur=10;c.fillStyle='#d8ff38';c.beginPath();c.arc(px,py,6,0,6.283);c.fill();c.restore();
    c.font="700 11px 'Space Mono',monospace";c.fillStyle='#aab5b1';c.textAlign='center';
    c.fillText(Math.hypot(S.latG,S.lonG).toFixed(1)+' G',gx,gy+gr+16);
    // bars
    bar(548,206,152,'NITRO',nitro/100,'#5de4ff',false);
    bar(548,236,152,'ENGINE '+Math.round(engineTemp)+'°',(engineTemp-72)/53,'#ffb62e',engineTemp>105);
    bar(548,266,152,'TYRES',1-tyreWear/100,'#a8ffb5',tyreWear>70);
    // turbo boost mini gauge
    c.font="700 10px 'Space Mono',monospace";c.fillStyle='#aab5b1';c.textAlign='left';c.fillText('TURBO',548,184);
    c.fillStyle='#000a';c.fillRect(600,176,100,7);c.fillStyle=S.spool>.85?'#ff7a4d':'#8fe3ff';c.fillRect(601,177,98*S.spool,5);
  }catch(e){if(!draw.err){draw.err=1;console.error('ZAYRO APEX cluster',e);}}
}
requestAnimationFrame(draw);

/* ================================================================ PHOTO MODE (V) */
addEventListener('keydown',e=>{
  if(e.repeat||(e.target&&/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)))return;
  if(e.key==='v'||e.key==='V'){
    const off=document.body.classList.toggle('za-hud-off');
    try{if(off)pop('HUD OFF · PRESS V');}catch(_){}
  }
});

/* ================================================================ TELEMETRY on the finish screen */
function showTele(){
  const box=document.querySelector('#finish .pause-box');if(!box)return;
  const old=document.getElementById('zaTele');if(old)old.remove();
  const avg=S.n?S.sum/S.n:0,el=document.createElement('div');el.id='zaTele';
  const cell=(k,v,u)=>`<div><small>${k}</small><b>${v}<i>${u||''}</i></b></div>`;
  el.innerHTML='<div class="za-tt">TELEMETRY</div><div class="za-tg">'+
    cell('TOP SPEED',Math.round(S.top),' KM/H')+cell('AVG SPEED',Math.round(avg),' KM/H')+
    cell('PEAK CORNER G',S.maxLat.toFixed(2),' G')+cell('PEAK BRAKE G',S.maxLon.toFixed(2),' G')+
    cell('DRIFT TIME',S.drift.toFixed(1),' S')+cell('TURBO PULL',S.turbo.toFixed(1),' S')+'</div>';
  const cert=document.getElementById('zayroCertificatePanel');
  if(cert&&cert.parentNode===box)box.insertBefore(el,cert);else box.appendChild(el);
}
const _fs=finishStage;
finishStage=function(){
  const was=finished;_fs();
  if(!was&&finished){try{showTele();}catch(e){console.error('ZAYRO APEX telemetry',e);}}
};
})();
