import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js';

const $ = id => document.getElementById(id);
const view = $('viewport'), overlay = $('overlay'), play = $('play');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a1522);
scene.fog = new THREE.FogExp2(0x0a1522, 0.0125);
const camera = new THREE.PerspectiveCamera(76, innerWidth / innerHeight, 0.08, 180);
camera.rotation.order = 'YXZ';
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.25;
view.appendChild(renderer.domElement);
scene.add(camera);

const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
const colliders = [], solidMeshes = [], shootables = [], enemies = [], projectiles = [], particles = [], pickups = [], tracers = [];
const keys = Object.create(null);
const v3 = (x=0,y=0,z=0) => new THREE.Vector3(x,y,z);
const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;
const metal = new THREE.MeshStandardMaterial({ color: 0x344455, metalness: .75, roughness: .4 });
const dark = new THREE.MeshStandardMaterial({ color: 0x151e29, metalness: .65, roughness: .47 });
const trim = new THREE.MeshStandardMaterial({ color: 0x697c8b, metalness: .75, roughness: .29 });
const concrete = new THREE.MeshStandardMaterial({ color: 0x52616a, metalness: .08, roughness: .93 });
const blueGlow = new THREE.MeshStandardMaterial({ color: 0x4ce9dc, emissive: 0x28bba9, emissiveIntensity: 3.5, metalness: .35, roughness: .3 });
const orangeGlow = new THREE.MeshStandardMaterial({ color: 0xff9962, emissive: 0xff6125, emissiveIntensity: 2.2 });
const redGlow = new THREE.MeshStandardMaterial({ color: 0xff5969, emissive: 0xdf213e, emissiveIntensity: 3 });
const groundSize = 61;
let audio = null, started = false, running = false, mouseDown = false, ads = false, time = 0, noticeTimer = 0, hitTimer = 0, damageTimer = 0, flashTimer = 0, nextWaveTimer = -1, best = 0;
try { best = Number(localStorage.getItem('neon-breach-best')) || 0; } catch {}
const player = {pos:v3(0,0,15),vel:v3(),yaw:0,pitch:0,eye:1.7,hp:100,stamina:100,mag:30,reserve:180,score:0,wave:0,kills:0,shots:0,hits:0,reload:0,fireCooldown:0,recoil:0,bob:0,stepCooldown:0};
const game = { elapsed:0 };

function box(parent, w,h,d, x,y,z, material, solid=false, shadows=true) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);
  mesh.position.set(x,y,z);
  mesh.castShadow = shadows;
  mesh.receiveShadow = true;
  parent.add(mesh);
  if (solid) {
    colliders.push({x0:x-w/2,x1:x+w/2,z0:z-d/2,z1:z+d/2});
    solidMeshes.push(mesh);
  }
  return mesh;
}
function canMove(x,z,r=.34) {
  if (Math.abs(x)>29.8-r || Math.abs(z)>29.8-r) return false;
  for(const b of colliders) if(x+r>b.x0&&x-r<b.x1&&z+r>b.z0&&z-r<b.z1) return false;
  return true;
}
function proceduralFloor() {
  const cn=document.createElement('canvas');cn.width=cn.height=256;const g=cn.getContext('2d');
  g.fillStyle='#343c43';g.fillRect(0,0,256,256);
  let seed=31871;const rand=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
  for(let i=0;i<4300;i++){const v=Math.floor(38+rand()*95);g.fillStyle='rgba('+v+','+(v+5)+','+(v+8)+','+(rand()*.12)+')';g.fillRect(rand()*256,rand()*256,1+rand()*3,1+rand()*3)}
  g.strokeStyle='#171e25';g.lineWidth=2;g.strokeRect(1,1,254,254);g.strokeStyle='#75828c35';g.lineWidth=1;g.strokeRect(7,7,242,242);
  for(let x=26;x<255;x+=51){g.fillStyle='#7b8a8d';g.fillRect(x,4,2,2);g.fillRect(x,250,2,2)}
  const t=new THREE.CanvasTexture(cn);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(18,18);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());return t;
}
function strip(x,y,z,w,d,color=0x6ce9df) {
  const mat=new THREE.MeshBasicMaterial({color});
  return box(scene,w,.04,d,x,y,z,mat,false,false);
}
function sign(text,x,y,z,ry=0,color='#9dece4') {
  const cn=document.createElement('canvas');cn.width=512;cn.height=128;const ctx=cn.getContext('2d');
  ctx.fillStyle='#101c29';ctx.fillRect(0,0,512,128);ctx.strokeStyle='#568a92';ctx.strokeRect(4,4,504,120);
  ctx.font='bold 49px monospace';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=color;ctx.fillText(text,256,64);
  let tx=new THREE.CanvasTexture(cn);tx.colorSpace=THREE.SRGBColorSpace;
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(4,.95),new THREE.MeshBasicMaterial({map:tx,side:THREE.DoubleSide}));mesh.position.set(x,y,z);mesh.rotation.y=ry;scene.add(mesh);
}
function world() {
  scene.add(new THREE.HemisphereLight(0xc5d8ef,0x1e2733,2.15));
  const sun=new THREE.DirectionalLight(0xb5d9f7,2.55);sun.position.set(-18,33,13);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-44;sun.shadow.camera.right=44;sun.shadow.camera.top=44;sun.shadow.camera.bottom=-44;sun.shadow.camera.near=1;sun.shadow.camera.far=95;sun.shadow.bias=-.00022;sun.shadow.normalBias=.045;scene.add(sun);
  const floorMat = new THREE.MeshStandardMaterial({map:proceduralFloor(),roughness:.96,metalness:.1,color:0xb2b7bc});
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(groundSize,groundSize),floorMat);floor.rotation.x=-Math.PI/2;floor.position.y=-.06;floor.receiveShadow=true;scene.add(floor);solidMeshes.push(floor);
  const steel=new THREE.MeshStandardMaterial({color:0x2a3542,roughness:.66,metalness:.48});
  const panel=new THREE.MeshStandardMaterial({color:0x536574,roughness:.72,metalness:.45});
  const rust=new THREE.MeshStandardMaterial({color:0x6a4e40,roughness:.92,metalness:.3});
  for(let i=-5;i<=5;i++){
    for(const z of [-30.2,30.2]) {box(scene,5.53,6,1,i*5.52,3,z,steel,true);box(scene,5.2,.13,.08,i*5.52,4.45,z+(z>0?-.55:.55),panel);}
    for(const x of [-30.2,30.2]) {box(scene,1,6,5.53,x,3,i*5.52,steel,true);box(scene,.08,.14,5.1,x+(x>0?-.54:.54),4.45,i*5.52,panel);}
  }
  for(let x=-27;x<=27;x+=9)for(let z of [-28,28]) {
    box(scene,.68,8.2,.68,x,4.1,z,metal,false);box(scene,2,.28,1.1,x,8.1,z,trim,false);
  }
  for(let z=-24;z<=24;z+=12)for(let x of [-28,28])box(scene,.66,7.4,.66,x,3.7,z,metal,false);
  const blocks=[
    [-20,-17,4,2.2,8],[-9,-19,7,3.5,3],[6,-17,5,2.2,6],[19,-16,5,3.5,5],
    [-19,-4,6,2.2,4],[-7,-5,3,2,7],[9,-4,7,2.8,3],[21,-2,4,2.2,7],
    [-20,11,6,2.5,6],[-9,9,4,2.5,3],[8,9,5,2.5,5],[19,13,5,3.3,5],
    [-16,22,6,2.3,4],[1,23,5,2.1,4],[14,22,7,2.8,4]
  ];
  for(const [x,z,w,h,d] of blocks){
    box(scene,w,h,d,x,h/2,z,panel,true);
    box(scene,w+.08,.13,d+.08,x,h+.02,z,steel,false);
    for(let k=0;k<Math.floor(w/1.3);k++)box(scene,.07,h*.75,.07,x-w/2+.5+k*1.3,h*.48,z+d/2+.045,trim,false);
    box(scene,w*.65,.055,.08,x,h*.57,z+d/2+.06,orangeGlow,false);
  }
  const crates=[[-24,3,2],[-14,-10,2],[1,-11,1],[-3,1,2],[15,2,2],[25,20,2],[-24,22,2],[0,14,1],[14,-25,2],[-4,-25,2]];
  for(const [x,z,n] of crates)for(let i=0;i<n;i++){
    const ox=x+(i%2)*1.75,oz=z+Math.floor(i/2)*1.75;
    box(scene,1.6,1.55,1.6,ox,.775,oz,rust,true);
    box(scene,1.5,.16,1.65,ox,1.48,oz,trim,false);
    box(scene,.1,1.4,1.67,ox-.65,.8,oz,metal,false);
  }
  for(const z of [-26,-13,0,13,26])for(const x of [-26,26]){
    box(scene,.28,5,.28,x,2.5,z,metal,false);
    const lamp=box(scene,1.4,.22,.55,x,4.7,z,blueGlow,false);
    const light=new THREE.PointLight(0x55cce8,13,15,2);light.position.set(x,4.4,z);scene.add(light);
  }
  for(const x of [-24,-12,0,12,24])for(const z of [-24,0,24]) {
    if(!canMove(x,z,1))continue;
    strip(x,.005,z,1.7,.055,0xd6a05d);
  }
  sign('SECTOR 07',0,3.9,-29.58,0);
  sign('CAUTION',-29.6,3.8,0,Math.PI/2,'#ffc37f');
  // Distant industrial silhouettes and atmospheric depth.
  const far=new THREE.MeshStandardMaterial({color:0x131f2c,metalness:.25,roughness:.88});
  let seed=42;const random=()=>((seed=(seed*1103515245+12345)>>>0)/4294967296);
  for(let i=0;i<65;i++){
    const a=i/65*Math.PI*2,r=48+random()*31,h=5+random()*28;
    box(scene,3+random()*7,h,3+random()*7,Math.cos(a)*r,h/2-.05,Math.sin(a)*r,far,false,false);
  }
}
world();

const gun=new THREE.Group();camera.add(gun);
const weaponMat=new THREE.MeshStandardMaterial({color:0x192633,metalness:.86,roughness:.27});
const weaponRubber=new THREE.MeshStandardMaterial({color:0x0e141a,metalness:.15,roughness:.85});
const weaponMark=new THREE.MeshStandardMaterial({color:0xa4bcce,metalness:.92,roughness:.18});
function gbox(w,h,d,x,y,z,mat=weaponMat){return box(gun,w,h,d,x,y,z,mat,false,false)}
gbox(.17,.17,.57,.0,-.02,-.31);gbox(.145,.105,.62,0,.075,-.29,weaponMark);
gbox(.18,.24,.25,0,-.15,-.1,weaponRubber);gbox(.13,.31,.12,0,-.23,-.44,weaponMat);
gbox(.14,.16,.23,0,-.08,.12,weaponRubber);gbox(.09,.065,.3,0,.15,-.36,weaponRubber);
gbox(.115,.12,.22,0,.045,-.63,weaponMark);
const barrel=new THREE.Mesh(new THREE.CylinderGeometry(.045,.045,.44,12),weaponRubber);barrel.rotation.x=Math.PI/2;barrel.position.set(0,-.01,-.74);gun.add(barrel);
const ring=new THREE.Mesh(new THREE.TorusGeometry(.055,.02,8,12),weaponMark);ring.position.set(0,-.01,-.96);gun.add(ring);
gbox(.075,.07,.03,0,.19,-.62,blueGlow);
gbox(.09,.035,.38,.105,.05,-.3,blueGlow);
const glove=new THREE.MeshStandardMaterial({color:0x202c35,roughness:.97});
gbox(.23,.17,.3,.11,-.28,-.08,glove);gbox(.23,.18,.33,-.11,-.27,-.45,glove);
gun.position.set(.38,-.29,-.66);
const muzzleLight=new THREE.PointLight(0xffc68e,0,5,2);muzzleLight.position.set(0,-.01,-.97);gun.add(muzzleLight);
const muzzleSprite=new THREE.Mesh(new THREE.SphereGeometry(.18,10,8),new THREE.MeshBasicMaterial({color:0xffdf9c,transparent:true,opacity:.8,depthWrite:false}));muzzleSprite.position.copy(muzzleLight.position);muzzleSprite.visible=false;gun.add(muzzleSprite);
const localMuzzle=v3(0,-.01,-.99);

function spawnEnemy(type='grunt') {
  let x=0,z=0,ok=false;
  for(let t=0;t<180;t++){x=(Math.random()-.5)*52;z=(Math.random()-.5)*52;if(canMove(x,z,.85)&&Math.hypot(x-player.pos.x,z-player.pos.z)>12){ok=true;break}}
  if(!ok)return;
  const elite=type==='elite', boss=type==='boss',scale=boss?1.45:elite?1.13:1;
  const root=new THREE.Group();root.position.set(x,0,z);root.scale.setScalar(scale);scene.add(root);
  const armor=new THREE.MeshStandardMaterial({color:boss?0x583744:elite?0x39404b:0x343e46,metalness:.6,roughness:.47});
  const under=new THREE.MeshStandardMaterial({color:0x161e27,metalness:.15,roughness:.85});
  const plates=new THREE.MeshStandardMaterial({color:elite?0x977e67:0x687d83,metalness:.75,roughness:.39});
  const eye=new THREE.MeshStandardMaterial({color:0xff7377,emissive:0xfa263c,emissiveIntensity:3.8});
  const parts=[];
  function part(w,h,d,px,py,pz,mat,zone='body',group=root){
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);mesh.position.set(px,py,pz);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);mesh.userData.zone=zone;parts.push(mesh);shootables.push(mesh);return mesh;
  }
  part(.5,.51,.29,0,1.02,0,under);
  part(.7,.87,.39,0,1.52,0,armor);
  part(.63,.55,.43,0,1.54,-.02,plates);
  part(.51,.36,.42,0,2.14,0,under,'head');
  part(.58,.18,.48,0,2.31,0,armor,'head');
  part(.46,.105,.055,0,2.15,-.225,eye,'head');
  const leftLeg=new THREE.Group(),rightLeg=new THREE.Group();leftLeg.position.set(-.2,.87,0);rightLeg.position.set(.2,.87,0);root.add(leftLeg,rightLeg);
  part(.245,.75,.25,0,-.4,0,under,'body',leftLeg);part(.26,.18,.36,0,-.75,-.075,armor,'body',leftLeg);
  part(.245,.75,.25,0,-.4,0,under,'body',rightLeg);part(.26,.18,.36,0,-.75,-.075,armor,'body',rightLeg);
  const leftArm=new THREE.Group(),rightArm=new THREE.Group();leftArm.position.set(-.49,1.81,0);rightArm.position.set(.49,1.81,0);root.add(leftArm,rightArm);
  part(.25,.67,.27,0,-.32,0,armor,'body',leftArm);part(.25,.67,.27,0,-.32,0,armor,'body',rightArm);
  part(.19,.17,.65,.26,1.42,-.44,under);
  part(.13,.13,.42,.26,1.42,-.92,plates);
  const maxHp=boss?540:elite?195:112;
  const e={root,parts,hp:maxHp,maxHp,elite,boss,scale,legs:[leftLeg,rightLeg],arms:[leftArm,rightArm],speed:(boss?1.05:elite?1.85:1.55)+Math.min(.65,player.wave*.035),cooldown:1+Math.random()*2,stagger:0,phase:Math.random()*10,strife:Math.random()<.5?1:-1,score:boss?1800:elite?450:175};
  for(const mesh of parts)mesh.userData.enemy=e;
  enemies.push(e);
}
function eraseEnemy(e) {
  const i=enemies.indexOf(e);if(i>=0)enemies.splice(i,1);
  for(const part of e.parts){const j=shootables.indexOf(part);if(j>=0)shootables.splice(j,1)}
  scene.remove(e.root);
  e.root.traverse(child=>{if(child.geometry)child.geometry.dispose();if(child.material&&!Array.isArray(child.material))child.material.dispose()});
}
function spawnWave(){
  player.wave++;nextWaveTimer=-1;
  const count=Math.min(19,4+player.wave*2);
  for(let i=0;i<count;i++)spawnEnemy(player.wave%5===0&&i===count-1?'boss':player.wave>=2&&Math.random()<.12+player.wave*.025?'elite':'grunt');
  notify('WAVE '+String(player.wave).padStart(2,'0')+' // HOSTILES INBOUND');
  beep(400,.22,'sawtooth',.04);updateHUD();
}
function notify(message){$('notification').textContent=message;$('notification').classList.add('show');noticeTimer=2.5}
function feed(message){const el=document.createElement('div');el.className='kill';el.innerHTML=message;$('killfeed').prepend(el);while($('killfeed').children.length>4)$('killfeed').lastChild.remove();setTimeout(()=>el.remove(),3500)}
function hitFx(pos,color=0xf8a86a,n=9){
  for(let i=0;i<n;i++){
    const mat=new THREE.MeshBasicMaterial({color,transparent:true,opacity:1});
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(.035,.035,.035),mat);mesh.position.copy(pos);scene.add(mesh);
    particles.push({mesh,vel:v3((Math.random()-.5)*5,Math.random()*4,(Math.random()-.5)*5),life:.35+Math.random()*.35,max:.7});
  }
}
const orbGeometry=new THREE.SphereGeometry(.1,9,7);
function drop(pos,kind){
  const mesh=new THREE.Mesh(new THREE.OctahedronGeometry(.28),new THREE.MeshBasicMaterial({color:kind==='health'?0x51eab1:0xffc478}));mesh.position.set(pos.x,.58,pos.z);scene.add(mesh);pickups.push({mesh,kind,time:0});
}
function lineVisible(from,to){
  const direction=to.clone().sub(from),distance=direction.length();
  raycaster.set(from,direction.normalize());raycaster.far=distance;
  const hits=raycaster.intersectObjects(solidMeshes,false);raycaster.far=180;
  return !hits.length||hits[0].distance>distance-.3;
}
function enemyShoot(e){
  const from=e.root.position.clone().add(v3(0,1.48*e.scale,0)), to=player.pos.clone().add(v3(0,player.eye-.16,0));
  if(!lineVisible(from,to))return;
  const direction=to.sub(from).normalize();
  direction.x+=(Math.random()-.5)*.06;direction.y+=(Math.random()-.5)*.025;direction.z+=(Math.random()-.5)*.06;direction.normalize();
  const mesh=new THREE.Mesh(orbGeometry,new THREE.MeshBasicMaterial({color:e.boss?0xffb35f:0xff4d65}));
  mesh.position.copy(from).addScaledVector(direction,.65);scene.add(mesh);
  projectiles.push({mesh,dir:direction,life:3.5,speed:e.boss?20:15,damage:e.boss?17:e.elite?12:8});
  beep(105,.11,'square',.014);
}
function takeDamage(amount){
  player.hp=Math.max(0,player.hp-amount);damageTimer=.8;
  beep(80,.22,'triangle',.07);updateHUD();
  if(player.hp<=0)endGame();
}
function enemyDeath(e,headshot){
  hitFx(e.root.position.clone().add(v3(0,1.1*e.scale,0)),e.boss?0xffb566:0xff6877,24);
  if(Math.random()<(player.hp<65?.35:.18))drop(e.root.position,player.hp<65&&Math.random()<.65?'health':'ammo');
  player.score+=e.score+(headshot?100:0);player.kills++;
  feed('<b>'+ (headshot?'HEADSHOT':'ELIMINATED')+'</b> &nbsp; '+(e.boss?'COMMANDER':e.elite?'ELITE':'OPERATIVE')+' &nbsp; +'+(e.score+(headshot?100:0)));
  eraseEnemy(e);updateHUD();
}
function tracer(from,to){
  const geometry=new THREE.BufferGeometry().setFromPoints([from,to]);
  const material=new THREE.LineBasicMaterial({color:0xffd8a6,transparent:true,opacity:.8});
  const line=new THREE.Line(geometry,material);scene.add(line);tracers.push({line,life:.08});
}
function shoot(){
  if(!running||player.reload>0||player.fireCooldown>0)return;
  if(player.mag<=0){reload();return}
  player.fireCooldown=.11;player.mag--;player.shots++;player.recoil=Math.min(1.3,player.recoil+.29);flashTimer=.065;
  muzzleLight.intensity=16;muzzleSprite.visible=true;
  player.pitch=clamp(player.pitch+.009+(Math.random()*.008),-1.38,1.38);
  beep(75,.08,'sawtooth',.09);noise(.07,.1);updateHUD();
  camera.updateMatrixWorld(true);
  const direction=new THREE.Vector3();camera.getWorldDirection(direction);
  const spread=ads?.0035:(Object.values(keys).some(Boolean)?.011:.007);
  direction.x+=(Math.random()-.5)*spread;direction.y+=(Math.random()-.5)*spread;direction.z+=(Math.random()-.5)*spread;direction.normalize();
  raycaster.set(camera.position,direction);raycaster.far=100;
  const intersections=raycaster.intersectObjects([...solidMeshes,...shootables],false);
  const hit=intersections[0];
  const target=hit?hit.point:camera.position.clone().addScaledVector(direction,85);
  const origin=gun.localToWorld(localMuzzle.clone());tracer(origin,target);
  if(hit){
    const e=hit.object.userData.enemy;
    if(e){
      const headshot=hit.object.userData.zone==='head',damage=headshot?107:39;
      e.hp-=damage;e.stagger=.2;
      player.hits++;hitTimer=.16;$('hitmarker').textContent=headshot?'✕':'×';$('hitmarker').classList.toggle('critical',headshot);$('hitmarker').classList.add('show');
      hitFx(hit.point,headshot?0xffe4b9:0xff6877,headshot?16:9);
      beep(headshot?860:590,.06,'sine',.04);
      if(e.hp<=0)enemyDeath(e,headshot);
    }else hitFx(hit.point,0xffc783,6);
  }
}
function reload(){
  if(!running||player.reload>0||player.mag>=30||player.reserve<=0)return;
  player.reload=1.75;beep(240,.09,'triangle',.034);
  $('reloadbar').style.display='block';
}
function beep(hz,duration=.1,type='sine',volume=.025){
  if(!audio)return;
  const t=audio.currentTime,osc=audio.createOscillator(),gain=audio.createGain();osc.type=type;osc.frequency.setValueAtTime(hz,t);osc.frequency.exponentialRampToValueAtTime(Math.max(35,hz*.4),t+duration);gain.gain.setValueAtTime(volume,t);gain.gain.exponentialRampToValueAtTime(.0001,t+duration);osc.connect(gain);gain.connect(audio.destination);osc.start(t);osc.stop(t+duration);
}
function noise(duration=.1,volume=.035){
  if(!audio)return;
  const sr=audio.sampleRate,len=Math.floor(sr*duration),buffer=audio.createBuffer(1,len,sr),data=buffer.getChannelData(0);
  for(let i=0;i<len;i++)data[i]=(Math.random()*2-1)*(1-i/len);
  const source=audio.createBufferSource(),gain=audio.createGain();source.buffer=buffer;gain.gain.value=volume;source.connect(gain);gain.connect(audio.destination);source.start();
}
function updateHUD(){
  $('health').textContent=Math.ceil(player.hp);$('healthbar').style.width=player.hp+'%';
  $('rounds').textContent=String(player.mag).padStart(2,'0');$('reserve').textContent=String(player.reserve).padStart(3,'0');
  $('wave').textContent=String(player.wave).padStart(2,'0');$('score').textContent=String(player.score).padStart(6,'0');$('kills').textContent=player.kills;
  $('staminabar').style.width=player.stamina+'%';
}
function minimap(){
  const c=$('minimap'),ctx=c.getContext('2d'),size=c.width,s=size/66;
  ctx.clearRect(0,0,size,size);ctx.fillStyle='#091521ee';ctx.fillRect(0,0,size,size);
  ctx.strokeStyle='#8fdfea17';ctx.lineWidth=1;for(let i=0;i<=66;i+=11){let p=i*s;ctx.beginPath();ctx.moveTo(p,0);ctx.lineTo(p,size);ctx.moveTo(0,p);ctx.lineTo(size,p);ctx.stroke()}
  for(const b of colliders){ctx.fillStyle='#7498a15d';ctx.fillRect((b.x0+33)*s,(b.z0+33)*s,(b.x1-b.x0)*s,(b.z1-b.z0)*s)}
  for(const e of enemies){ctx.fillStyle=e.boss?'#ffad63':'#fe6d78';ctx.beginPath();ctx.arc((e.root.position.x+33)*s,(e.root.position.z+33)*s,e.boss?4:2.6,0,Math.PI*2);ctx.fill()}
  for(const p of pickups){ctx.fillStyle=p.kind==='health'?'#80ffd1':'#ffcb85';ctx.fillRect((p.mesh.position.x+33)*s-2,(p.mesh.position.z+33)*s-2,4,4)}
  ctx.save();ctx.translate((player.pos.x+33)*s,(player.pos.z+33)*s);ctx.rotate(player.yaw);ctx.fillStyle='#affff0';ctx.beginPath();ctx.moveTo(0,-8);ctx.lineTo(-5,5);ctx.lineTo(5,5);ctx.fill();ctx.restore();
}
function movement(dt) {
  const forward=Number(!!(keys.KeyW||keys.ArrowUp))-Number(!!(keys.KeyS||keys.ArrowDown));
  const lateral=Number(!!keys.KeyD)-Number(!!keys.KeyA);
  const moving=!!(forward||lateral);
  const crouch=!!keys.KeyC;
  const sprint=!!(keys.ShiftLeft||keys.ShiftRight)&&forward>0&&!ads&&!crouch&&player.stamina>2;
  const speed=crouch?2.15:ads?2.8:sprint?7:4.5;
  player.stamina=clamp(player.stamina+(sprint?-26:18)*dt,0,100);
  const norm=Math.max(1,Math.hypot(forward,lateral));
  const dx=(Math.sin(player.yaw)*forward+Math.cos(player.yaw)*lateral)/norm*speed;
  const dz=(-Math.cos(player.yaw)*forward+Math.sin(player.yaw)*lateral)/norm*speed;
  const blend=1-Math.exp(-dt*9);
  player.vel.x=lerp(player.vel.x,dx,blend);player.vel.z=lerp(player.vel.z,dz,blend);
  const mx=player.vel.x*dt,mz=player.vel.z*dt;
  if(canMove(player.pos.x+mx,player.pos.z))player.pos.x+=mx;else player.vel.x=0;
  if(canMove(player.pos.x,player.pos.z+mz))player.pos.z+=mz;else player.vel.z=0;
  const speedNow=Math.hypot(player.vel.x,player.vel.z);
  if(speedNow>.7){player.bob+=dt*(sprint?13:9);player.stepCooldown-=dt;if(player.stepCooldown<=0){noise(.035,sprint?.017:.009);player.stepCooldown=sprint?.28:.4}}
  player.eye=lerp(player.eye,crouch?1.12:1.7,Math.min(1,dt*9));
  camera.position.set(player.pos.x,player.eye+(speedNow>.5?Math.sin(player.bob)*.033:0),player.pos.z);
  camera.rotation.set(player.pitch,player.yaw,0,'YXZ');
  camera.fov=lerp(camera.fov,ads?53:sprint?83:76,Math.min(1,dt*12));camera.updateProjectionMatrix();
  const target=ads?v3(0,-.215,-.40):v3(.38+player.vel.x*.002,-.30+(moving?Math.sin(player.bob)*.01:0),-.66);
  gun.position.lerp(target,Math.min(1,dt*10));
  gun.rotation.x=lerp(gun.rotation.x,player.reload>0?-.44:player.recoil*.21,Math.min(1,dt*12));
  gun.rotation.z=lerp(gun.rotation.z,ads?0:-player.vel.x*.013,Math.min(1,dt*9));
  $('crosshair').style.opacity=ads?'.14':'1';
  $('crosshair').style.setProperty('--gap',Math.round(7+player.recoil*20+(speedNow>1?5:0))+'px');
  $('staminabar').style.width=player.stamina+'%';
  $('direction').textContent=Math.round(((player.yaw*180/Math.PI)%360+360)%360)+'° // '+(sprint?'SPRINT':'TACTICAL');
}
function updateEnemies(dt){
  for(const e of [...enemies]){
    if(e.stagger>0)e.stagger-=dt;
    const dx=player.pos.x-e.root.position.x,dz=player.pos.z-e.root.position.z,d=Math.max(.01,Math.hypot(dx,dz)),dirx=dx/d,dirz=dz/d;
    e.cooldown-=dt;
    let vx=0,vz=0;
    if(d>7){vx=dirx;vz=dirz}
    else if(d<3.8){vx=-dirx*.65+dirz*e.strife*.4;vz=-dirz*.65-dirx*e.strife*.4}
    else{vx=dirz*e.strife*.65;vz=-dirx*e.strife*.65}
    const move=e.speed*dt*(e.stagger>0?.35:1),x=e.root.position.x+vx*move,z=e.root.position.z+vz*move;
    if(canMove(x,e.root.position.z,.38*e.scale))e.root.position.x=x;else e.strife*=-1;
    if(canMove(e.root.position.x,z,.38*e.scale))e.root.position.z=z;else e.strife*=-1;
    e.root.rotation.y=Math.atan2(dirx,-dirz);
    e.legs[0].rotation.x=Math.sin(time*e.speed*6+e.phase)*.32;e.legs[1].rotation.x=-e.legs[0].rotation.x;
    e.arms[0].rotation.x=Math.sin(time*3+e.phase)*.06;e.arms[1].rotation.x=-e.arms[0].rotation.x;
    if(d<1.3&&e.cooldown<=0){takeDamage(e.boss?22:e.elite?14:9);e.cooldown=1.1}
    else if(d<24&&d>=1.3&&e.cooldown<=0){enemyShoot(e);e.cooldown=Math.max(.65,(e.boss?1.2:e.elite?1.6:2.05)-player.wave*.035)+Math.random()*.6}
  }
}
function updateProjectiles(dt) {
  for(let i=projectiles.length-1;i>=0;i--){
    const p=projectiles[i];p.life-=dt;const prev=p.mesh.position.clone(),move=p.dir.clone().multiplyScalar(dt*p.speed);
    p.mesh.position.add(move);
    let dead=p.life<=0;
    const to=p.mesh.position.clone().sub(prev);
    raycaster.set(prev,to.clone().normalize());raycaster.far=to.length();
    if(raycaster.intersectObjects(solidMeshes,false).length)dead=true;
    if(p.mesh.position.distanceTo(player.pos.clone().add(v3(0,1.25,0)))<.72){takeDamage(p.damage);dead=true}
    if(dead){hitFx(p.mesh.position,0xff5f74,4);scene.remove(p.mesh);projectiles.splice(i,1)}
  }
}
function updatePickups(dt) {
  for(let i=pickups.length-1;i>=0;i--){
    const p=pickups[i];p.time+=dt;p.mesh.rotation.y+=dt*1.6;p.mesh.position.y=.58+Math.sin(p.time*2.5)*.12;
    if(p.mesh.position.distanceTo(player.pos.clone().add(v3(0,.6,0)))<1.15){
      if(p.kind==='health'){player.hp=Math.min(100,player.hp+38);notify('MEDICAL SUPPLY // +38 HEALTH')}
      else{player.reserve=Math.min(330,player.reserve+60);notify('AMMUNITION // +60')}
      beep(780,.2,'sine',.06);scene.remove(p.mesh);pickups.splice(i,1);updateHUD();
    }
  }
}
function updateEffects(dt){
  flashTimer=Math.max(0,flashTimer-dt);muzzleLight.intensity=flashTimer>0?18:0;muzzleSprite.visible=flashTimer>0;
  player.recoil=Math.max(0,player.recoil-dt*3.4);
  hitTimer-=dt;if(hitTimer<=0)$('hitmarker').classList.remove('show');
  damageTimer=Math.max(0,damageTimer-dt);$('damage').style.opacity=Math.min(.83,damageTimer*.75);
  noticeTimer-=dt;if(noticeTimer<=0)$('notification').classList.remove('show');
  for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.life-=dt;p.vel.y-=dt*9;p.mesh.position.addScaledVector(p.vel,dt);p.mesh.material.opacity=Math.max(0,p.life/p.max);if(p.life<=0){scene.remove(p.mesh);p.mesh.geometry.dispose();p.mesh.material.dispose();particles.splice(i,1)}}
  for(let i=tracers.length-1;i>=0;i--){const t=tracers[i];t.life-=dt;t.line.material.opacity=Math.max(0,t.life/.08);if(t.life<=0){scene.remove(t.line);t.line.geometry.dispose();t.line.material.dispose();tracers.splice(i,1)}}
}
function update(dt){
  time+=dt;
  if(!running)return;
  game.elapsed+=dt;
  player.fireCooldown=Math.max(0,player.fireCooldown-dt);
  if(player.reload>0){player.reload-=dt;$('reloadbar').firstElementChild.style.width=(100*(1-player.reload/1.75))+'%';if(player.reload<=0){let n=Math.min(30-player.mag,player.reserve);player.mag+=n;player.reserve-=n;player.reload=0;$('reloadbar').style.display='none';beep(550,.08);updateHUD()}}
  movement(dt);if(mouseDown)shoot();
  updateEnemies(dt);updateProjectiles(dt);updatePickups(dt);updateEffects(dt);
  if(enemies.length===0&&player.wave>0&&nextWaveTimer<0){
    nextWaveTimer=4;player.hp=Math.min(100,player.hp+22);player.reserve=Math.min(330,player.reserve+50);player.score+=700;notify('SECTOR SECURED // +700');updateHUD()
  }
  if(nextWaveTimer>=0){nextWaveTimer-=dt;if(nextWaveTimer<0)spawnWave()}
  if(Math.floor(time*12)%3===0)minimap();
}
function reset(){
  for(const e of [...enemies])eraseEnemy(e);
  for(const arr of [projectiles,particles,pickups,tracers]){for(const o of arr){const obj=o.mesh||o.line;scene.remove(obj);if(o!==undefined&&obj.geometry&&obj!==o.mesh)obj.geometry.dispose()}arr.length=0}
  Object.assign(player,{pos:v3(0,0,15),vel:v3(),yaw:0,pitch:0,eye:1.7,hp:100,stamina:100,mag:30,reserve:180,score:0,wave:0,kills:0,shots:0,hits:0,reload:0,fireCooldown:0,recoil:0,bob:0,stepCooldown:0});
  game.elapsed=0;nextWaveTimer=-1;time=0;ads=false;mouseDown=false;$('killfeed').innerHTML='';$('reloadbar').style.display='none';updateHUD();spawnWave();started=true;running=true;overlay.classList.add('hidden');$('hud').classList.add('visible');
}
function showMenu(title,desc,buttonText){
  $('menuTitle').innerHTML=title;$('menuDescription').textContent=desc;play.textContent=buttonText;overlay.classList.remove('hidden');
}
function endGame(){
  running=false;mouseDown=false;
  if(player.score>best){best=player.score;try{localStorage.setItem('neon-breach-best',String(best))}catch{}}
  document.exitPointerLock?.();
  showMenu('MISSION<br><span>FAILED</span>','You survived '+player.wave+' waves, eliminated '+player.kills+' hostiles and scored '+player.score+' points. Personal best: '+best+'.','REDEPLOY');
}
function playGame(){
  if(!audio){const AC=window.AudioContext||window.webkitAudioContext;if(AC)audio=new AC()}
  audio?.resume?.();
  if(!started||player.hp<=0)reset();else{overlay.classList.add('hidden');running=true}
  renderer.domElement.requestPointerLock?.();
}
play.addEventListener('click',playGame);
document.addEventListener('pointerlockchange',()=>{
  const locked=document.pointerLockElement===renderer.domElement;
  if(!locked&&running){running=false;mouseDown=false;showMenu('MISSION<br><span>PAUSED</span>','Your progress is preserved. Return to the arena when ready.','RESUME MISSION')}
});
renderer.domElement.addEventListener('click',()=>{if(started&&running&&document.pointerLockElement!==renderer.domElement)renderer.domElement.requestPointerLock?.()});
document.addEventListener('mousemove',e=>{
  if(document.pointerLockElement!==renderer.domElement||!running)return;
  player.yaw-=e.movementX*.0018*(ads?.72:1);player.pitch=clamp(player.pitch-e.movementY*.0016*(ads?.72:1),-1.38,1.38);
});
document.addEventListener('mousedown',e=>{if(e.button===0)mouseDown=true;if(e.button===2)ads=true});
document.addEventListener('mouseup',e=>{if(e.button===0)mouseDown=false;if(e.button===2)ads=false});
document.addEventListener('contextmenu',e=>e.preventDefault());
document.addEventListener('keydown',e=>{keys[e.code]=true;if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();if(e.code==='KeyR')reload()});
document.addEventListener('keyup',e=>{keys[e.code]=false});
window.addEventListener('blur',()=>{mouseDown=false;ads=false;for(const k of Object.keys(keys))delete keys[k]});
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});
let frames=0;function animate(){requestAnimationFrame(animate);const dt=Math.min(.05,clock.getDelta());update(dt);renderer.render(scene,camera);if(++frames%90===0&&renderer.info.render.calls>1200)console.warn('High draw call count',renderer.info.render.calls)}
requestAnimationFrame(animate);
window.__neonReady=true;
