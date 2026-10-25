/* VLORA landing scene: live three.js emerald, scroll-scrubbed. Loaded on demand by site.js. */
(function(){
var TQ=(function(n,d){var m=new RegExp('[?&]'+n+'=([-0-9.]+)').exec(location.search);return m?+m[1]:d});
var cv=document.getElementById('gs3-gl'),run=document.getElementById('gs3-run');
var renderer;
try{renderer=new THREE.WebGLRenderer({canvas:cv,antialias:true,alpha:false});}catch(e){run.classList.add('is-static');return;}
var PR=Math.min(devicePixelRatio||1,1.5);renderer.setPixelRatio(PR);
renderer.outputEncoding=THREE.sRGBEncoding;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.95;
renderer.shadowMap.enabled=false;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
var scene=new THREE.Scene();scene.background=new THREE.Color(0xf4f0e8);
var cam=new THREE.PerspectiveCamera(28,1,.1,120);
function cl(x){return x<0?0:x>1?1:x}function sm(x){x=cl(x);return x*x*x*(x*(x*6-15)+10)}function rg(p,a,b){return cl((p-a)/(b-a))}function lerp(a,b,t){return a+(b-a)*t}

/* ================= studio environment: HDR cube for the gem, PMREM for metals ================= */
var envCube;
(function(){
  var es=new THREE.Scene();
  var boxM=new THREE.MeshBasicMaterial({color:new THREE.Color(.04,.04,.04),side:THREE.BackSide});es.add(new THREE.Mesh(new THREE.BoxGeometry(40,40,40),boxM));
  function panel(w,h,x,y,z,c,i){var m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color:new THREE.Color(c).multiplyScalar(i),side:THREE.DoubleSide}));m.position.set(x,y,z);m.lookAt(0,0,0);es.add(m);}
  /* a ring of strip lights and small hot sources: the hall of mirrors needs contrast to read */
  panel(6,3.2,-9,8,9,0xfff3dc,5.85);panel(2.2,8,11,1,5,0xffffff,5.2);panel(9,2,0,12,-1,0xfff1d9,4.55);panel(2.6,6,-12,-1,-3,0xcfe0ff,2.6);
  panel(10,1.4,0,-9,7,0xffe2b0,1.95);panel(1.2,1.2,5,7,10,0xffffff,5.85);panel(1,3,-5,-3,11,0xfff0d0,5.85);panel(1.4,1.4,-2,11,6,0xffffff,5.2);
  panel(1.6,5,9,-6,-6,0xd8ecff,3.25);panel(5,1.2,-8,-8,-6,0xffd9a0,2.6);panel(1,6,-14,3,6,0xffffff,3.9);[[-7,2.4],[-4.2,.35],[-1.6,1.9],[1.2,.25],[3.8,2.6],[6.8,.5]].forEach(function(b){panel(2.2,9,b[0],2,-15,0xf6efe2,b[1]);});panel(14,2,0,-6,-14,0xf4f0e8,.9);
  var pm=new THREE.PMREMGenerator(renderer);scene.environment=pm.fromScene(es,.02).texture;pm.dispose();boxM.color.setRGB(TQ('rm',.035),TQ('rm',.035)*.97,TQ('rm',.035)*.92);
  var cr=new THREE.WebGLCubeRenderTarget(512,{type:THREE.HalfFloatType,generateMipmaps:true,minFilter:THREE.LinearMipmapLinearFilter});
  var cc=new THREE.CubeCamera(.1,80,cr);es.add(cc);cc.update(renderer,es);envCube=cr.texture;
})();
var sun=new THREE.DirectionalLight(0xfff1dc,1.1);sun.position.set(-.4,2.2,15);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
var sc=sun.shadow.camera;sc.left=-9;sc.right=9;sc.top=9;sc.bottom=-9;sc.near=1;sc.far=40;sun.shadow.radius=8;sun.shadow.bias=-.0006;sun.shadow.normalBias=.05;scene.add(sun);var fill=new THREE.DirectionalLight(0xfff1dc,1.5);fill.position.set(-9,7,5);scene.add(fill);scene.add(new THREE.HemisphereLight(0xfff6ea,0x9c8a72,.28));

/* ================= gem machinery: convex hull -> exact planes; ray-traced optics ================= */
function oct(w,l,c,y){var a=w/2,b=l/2;return [[-a+c,y,-b],[a-c,y,-b],[a,y,-b+c],[a,y,b-c],[a-c,y,b],[-a+c,y,b],[-a,y,b-c],[-a,y,-b+c]];}
function hullOf(P){
  var Q=[];P.forEach(function(p){if(!Q.some(function(q){return Math.abs(q[0]-p[0])+Math.abs(q[1]-p[1])+Math.abs(q[2]-p[2])<1e-4}))Q.push(p)});P=Q;var n=P.length,pl=[],keys={},E=1e-5;
  for(var i=0;i<n;i++)for(var j=i+1;j<n;j++){
    var ux=P[j][0]-P[i][0],uy=P[j][1]-P[i][1],uz=P[j][2]-P[i][2];
    for(var k=j+1;k<n;k++){
      var vx=P[k][0]-P[i][0],vy=P[k][1]-P[i][1],vz=P[k][2]-P[i][2];
      var nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx,l=Math.sqrt(nx*nx+ny*ny+nz*nz);if(l<1e-7)continue;
      nx/=l;ny/=l;nz/=l;var d=nx*P[i][0]+ny*P[i][1]+nz*P[i][2],pos=0,neg=0;
      for(var m=0;m<n;m++){var s=nx*P[m][0]+ny*P[m][1]+nz*P[m][2]-d;if(s>E)pos++;else if(s<-E)neg++;if(pos&&neg)break;}
      if(pos&&neg)continue;if(pos){nx=-nx;ny=-ny;nz=-nz;d=-d;}
      var key=[nx,ny,nz,d].map(function(v){return Math.round(v*400)}).join(',');if(keys[key])continue;keys[key]=1;pl.push({n:[nx,ny,nz],d:d});
    }}
  var pos_=[];
  pl.forEach(function(q){
    var vs=[];P.forEach(function(p){if(Math.abs(q.n[0]*p[0]+q.n[1]*p[1]+q.n[2]*p[2]-q.d)<E)vs.push(p);});
    if(vs.length<3)return;var c=[0,0,0];vs.forEach(function(p){c[0]+=p[0]/vs.length;c[1]+=p[1]/vs.length;c[2]+=p[2]/vs.length;});
    var u=[vs[0][0]-c[0],vs[0][1]-c[1],vs[0][2]-c[2]],ul=Math.hypot(u[0],u[1],u[2]);u=u.map(function(v){return v/ul});
    var w=[q.n[1]*u[2]-q.n[2]*u[1],q.n[2]*u[0]-q.n[0]*u[2],q.n[0]*u[1]-q.n[1]*u[0]];
    vs.forEach(function(p){var dx=p[0]-c[0],dy=p[1]-c[1],dz=p[2]-c[2];p.ang=Math.atan2(dx*w[0]+dy*w[1]+dz*w[2],dx*u[0]+dy*u[1]+dz*u[2]);});
    vs.sort(function(a,b){return a.ang-b.ang});
    for(var t=1;t<vs.length-1;t++){var ax_=vs[t][0]-vs[0][0],ay_=vs[t][1]-vs[0][1],az_=vs[t][2]-vs[0][2],bx_=vs[t+1][0]-vs[0][0],by_=vs[t+1][1]-vs[0][1],bz_=vs[t+1][2]-vs[0][2];if(Math.hypot(ay_*bz_-az_*by_,az_*bx_-ax_*bz_,ax_*by_-ay_*bx_)<1e-9)continue;pos_.push(vs[0][0],vs[0][1],vs[0][2],vs[t][0],vs[t][1],vs[t][2],vs[t+1][0],vs[t+1][1],vs[t+1][2]);}
  });
  var g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos_,3));g.computeVertexNormals();
  return {geo:g,planes:pl};
}
/* cuts */
function emeraldPts(){
  var P=[];
  function addRing(w,l,c,y,mid){var r=oct(w,l,c,y);r.forEach(function(p){P.push(p)});
    if(mid){/* twin the long step facets so each step splits into two slightly different mirrors */
      var a=w/2,b=l/2;P.push([-a-mid,y,0],[a+mid,y,0]);}}
  addRing(.04,.32,.015,-.54,0);addRing(.10,.46,.05,-.506,.004);addRing(.28,.64,.11,-.452,-.0+.006);addRing(.46,.82,.15,-.362,.006);addRing(.64,1.00,.18,-.272,.006);addRing(.82,1.18,.20,-.146,.006);addRing(1,1.36,.22,-.02,0);
  addRing(1,1.36,.22,.03,0);addRing(.86,1.22,.20,.09,.004);addRing(.72,1.08,.17,.15,.004);addRing(.60,.96,.14,.20,.003);addRing(.50,.86,.11,.235,0);
  return P;}
function brilliantPts(n,wx,wz,wy){var P=[];function ring(r,y,off){for(var i=0;i<n;i++){var a=(i+off)/n*Math.PI*2;P.push([Math.cos(a)*r*wx,y*wy,Math.sin(a)*r*wz]);}}
  ring(1,-.03,0);ring(1,.03,0);ring(.52,-.44,.5);P.push([0,-.86*wy,0]);ring(.80,.17,.5);ring(.56,.33,0);return P;}
var VS=["varying vec3 vOP;varying vec3 vN;varying vec3 vCam;varying mat3 vR;varying float vS;",
 "void main(){mat4 im=modelMatrix;",
 "#ifdef USE_INSTANCING\n im=modelMatrix*instanceMatrix;\n#endif\n",
 " vOP=position;vN=normal;vCam=(inverse(im)*vec4(cameraPosition,1.)).xyz;vS=length(im[0].xyz);",
 " vR=mat3(im[0].xyz/vS,im[1].xyz/vS,im[2].xyz/vS);gl_Position=projectionMatrix*viewMatrix*im*vec4(position,1.);}"].join("\n");
function FS(NP,MB){return [
 "#define NP "+NP,"#define MB "+MB,
 "uniform float uExt;uniform float uLam;uniform vec3 uGlow;uniform float uBase;uniform float uCloud;uniform float uZone;vec3 gO;",
 "float hh(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}",
 "float vn(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);return mix(mix(mix(hh(i),hh(i+vec3(1,0,0)),f.x),mix(hh(i+vec3(0,1,0)),hh(i+vec3(1,1,0)),f.x),f.y),mix(mix(hh(i+vec3(0,0,1)),hh(i+vec3(1,0,1)),f.x),mix(hh(i+vec3(0,1,1)),hh(i+vec3(1,1,1)),f.x),f.y),f.z);}",
 "uniform vec4 uPl[NP];uniform samplerCube uEnv;uniform vec3 uSig;uniform float uDisp;uniform float uExp;uniform float uLod;uniform float uIor;uniform float uGam;",
 "varying vec3 vOP;varying vec3 vN;varying vec3 vCam;varying mat3 vR;varying float vS;",
 "vec3 envw(vec3 d){return textureLod(uEnv,vR*d,uLod).rgb;}",
 "vec3 trace(vec3 V,vec3 N,float ior,out float path,out float live){",
 " vec3 o=vOP,d=refract(V,N,1./ior);path=0.;live=1.;",
 " for(int b=0;b<MB;b++){",
 "  float tm=1e5;vec3 nn=vec3(0.,1.,0.);",
 "  for(int k=0;k<NP;k++){vec4 pl=uPl[k];float dn=dot(pl.xyz,d);if(dn>1e-5){float t=(pl.w-dot(pl.xyz,o))/dn;if(t<tm-1e-6){tm=t;nn=pl.xyz;}}}",
 "  o+=d*tm;path+=tm;",
 "  vec3 r=refract(d,-nn,ior);",
 "  if(dot(r,r)>0.){gO=o;float f=pow(1.-clamp(dot(-d,-nn),0.,1.),5.)*.9+.04;live*=1.-f*.5;return r;}",
 "  d=reflect(d,nn);o-=nn*2e-4;",
 " }",
 " gO=o;live=.35;return d;}",
 "void main(){",
 " vec3 N=normalize(vN);vec3 V=normalize(vOP-vCam);",
 " float cs=clamp(dot(-V,N),0.,1.);float F=.04+.96*pow(1.-cs,5.);",
 " vec3 refl=envw(reflect(V,N));",
 " float pr,pg,pb,lr,lg,lb;vec3 eg=trace(V,N,uIor,pg,lg);vec3 ee=gO;float nn1=vn(ee*5.)*.6+vn(ee*13.)*.4;float cl1=smoothstep(.55,.78,nn1);float zn=1.+uZone*(vn(vOP*3.+2.)-.5)*2.;vec3 er=eg,eb=eg;pr=pg;pb=pg;lr=lg;lb=lg;if(uDisp>1e-6){er=trace(V,N,uIor-uDisp,pr,lr);eb=trace(V,N,uIor+uDisp,pb,lb);}",
 " vec3 sg=uSig*zn;vec3 T=vec3(envw(er).r*exp(-sg.r*(pr+uBase)*vS)*lr,envw(eg).g*exp(-sg.g*(pg+uBase)*vS)*lg,envw(eb).b*exp(-sg.b*(pb+uBase)*vS)*lb);T*=1.-uCloud*cl1*.55;T+=uCloud*cl1*.03;T*=1.-uExt*smoothstep(.48,.82,vn(ee*2.4+5.));float lm=.3+1.5*pow(max(dot(normalize(vR*N),normalize(vec3(-.35,.75,.55))),0.),1.3);lm=mix(1.,lm,uLam);T=T*lm+uGlow*(.3+lm*.7)*(.5+.8*(1.-cs));",
 " vec3 c=mix(T,refl,F)*uExp;",
 " c=vec3(1.)-exp(-c*1.5);c=pow(c,vec3(uGam/2.2));",
 " gl_FragColor=vec4(c,1.);}"].join("\n");}
var gemMats=[];
function stone(pts,ior,sig,disp,expo,lod,mb){
  var h=hullOf(pts);
  var mat=new THREE.ShaderMaterial({uniforms:{uPl:{value:h.planes.map(function(q){return new THREE.Vector4(q.n[0],q.n[1],q.n[2],q.d)})},uEnv:{value:envCube},uSig:{value:new THREE.Vector3(sig[0],sig[1],sig[2])},uDisp:{value:disp},uExp:{value:expo},uLod:{value:lod},uIor:{value:ior},uGam:{value:1},uBase:{value:0},uLam:{value:0},uExt:{value:0},uGlow:{value:new THREE.Vector3()},uCloud:{value:0},uZone:{value:0}},vertexShader:VS,fragmentShader:FS(h.planes.length,mb),side:THREE.FrontSide});
  mat.userData.disp=disp;gemMats.push(mat);return {geo:h.geo,mat:mat};
}
var E1=stone(emeraldPts(),1.575,[TQ('sr',3.3),TQ('sg',.28),TQ('sb',.8)],TQ('dp',.0025),TQ('ex',3.2),TQ('lod',.5),7);
E1.mat.uniforms.uBase.value=TQ('eb',.3);E1.mat.uniforms.uCloud.value=.3;E1.mat.uniforms.uZone.value=.35;
E1.mat.uniforms.uGam.value=TQ('gg',1.75);E1.mat.uniforms.uLam.value=1;E1.mat.uniforms.uExt.value=.55;E1.mat.uniforms.uGlow.value.set(.0,.05,.035);
var gem=new THREE.Mesh(E1.geo,E1.mat);gem.castShadow=true;
var gold=new THREE.MeshStandardMaterial({color:TQ('gc',0xeaa93c),metalness:1,roughness:TQ('gr',.11),envMapIntensity:TQ('gi',2.1)});
var DIA=stone(brilliantPts(8,1,1,1),2.42,[0,0,0],.012,TQ('dx',15),.2,6);DIA.mat.uniforms.uGam.value=TQ('dg',2.1);

/* ================= setting: diamond halo, gold rims, four claws, diamond-set bail ================= */
var BAIL=1.20;
var setting=new THREE.Group();
function tube(pts,r,closed,seg){var cu=new THREE.CatmullRomCurve3(pts.map(function(p){return new THREE.Vector3(p[0],p[1],p[2]);}),closed,'catmullrom',closed?.5:.4);var m=new THREE.Mesh(new THREE.TubeGeometry(cu,seg||60,r,12,closed),gold);m.castShadow=true;return m;}
/* gallery rails under the stone */
setting.add(tube(oct(.50,.84,.15,-.36),.026,true,90));
/* halo: gold bed, outer and inner rims, ring of small round brilliants */
var HP=oct(1.36,1.72,.30,-.045);
setting.add(tube(oct(1.36,1.72,.30,-.105),.066,true,120));
setting.add(tube(oct(1.54,1.90,.32,-.07),.022,true,120));
setting.add(tube(oct(1.10,1.46,.23,-.035),.02,true,100));
var hc=new THREE.CatmullRomCurve3(HP.map(function(p){return new THREE.Vector3(p[0],p[1],p[2])}),true,'catmullrom',.5);
var NH=Math.round(hc.getLength()/.118),hr=hc.getLength()/NH*.5*.94;
var halo=new THREE.InstancedMesh(DIA.geo,DIA.mat,NH);halo.frustumCulled=false;
(function(){var d=new THREE.Object3D();for(var i=0;i<NH;i++){var p=hc.getPointAt(i/NH);d.position.copy(p);d.rotation.set(0,i*.61,0);d.scale.setScalar(hr);d.updateMatrix();halo.setMatrixAt(i,d.matrix);}halo.instanceMatrix.needsUpdate=true;})();
setting.add(halo);
var bedS=new THREE.Shape(oct(1.50,1.86,.30,0).map(function(p){return new THREE.Vector2(p[0],p[2])}));
bedS.holes.push(new THREE.Path(oct(.80,1.16,.20,0).map(function(p){return new THREE.Vector2(p[0],p[2])}).reverse()));
var bed=new THREE.Mesh(new THREE.ShapeGeometry(bedS,6),new THREE.MeshStandardMaterial({color:0xe6b04a,metalness:1,roughness:.14,envMapIntensity:1.7,side:THREE.DoubleSide}));bed.rotation.x=Math.PI/2;bed.position.y=-.115;setting.add(bed);
function taperTube(pts,r0,r1,seg){var cu=new THREE.CatmullRomCurve3(pts.map(function(p){return new THREE.Vector3(p[0],p[1],p[2]);}),false,'catmullrom',.4);var g=new THREE.TubeGeometry(cu,seg,1,14,false),P=g.attributes.position,R=15,i,j;
  for(i=0;i<=seg;i++){var c=cu.getPointAt(i/seg),t=i/seg,r=r1+(r0-r1)*Math.pow(1-t,1.35);for(j=0;j<R;j++){var k=i*R+j;P.setXYZ(k,c.x+(P.getX(k)-c.x)*r,c.y+(P.getY(k)-c.y)*r,c.z+(P.getZ(k)-c.z)*r);}}
  g.computeVertexNormals();var m=new THREE.Mesh(g,gold);m.castShadow=true;return m;}
/* four corner claws over the chamfered corners */
/* double claws at each corner, as on the reference ring: two chunky pointed teardrop claws flanking every corner */
var clawLG=(function(){var pr=[[0,0],[.20,.04],[.36,.2],[.40,.42],[.30,.66],[.15,.86],[0,1]].map(function(q){return new THREE.Vector2(q[0],q[1]);});return new THREE.LatheGeometry(pr,20);})();
function claw(sx,sz,path,anc,dir){
  setting.add(taperTube(path,.056,.05,40));
  var m=new THREE.Mesh(clawLG,gold);m.scale.set(.25,.32,.19);m.position.set(anc[0]*sx,anc[1],anc[2]*sz);
  var d=new THREE.Vector3(dir[0]*sx,dir[1],dir[2]*sz).normalize();m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d);m.castShadow=true;setting.add(m);}
var CL=(/[?&]claw=(\w)/.exec(location.search)||[0,'A'])[1];
function lathe(pr){return new THREE.LatheGeometry(pr.map(function(q){return new THREE.Vector2(q[0],q[1]);}),24);}
var LG={A:lathe([[0,0],[.20,.04],[.36,.2],[.40,.42],[.30,.66],[.15,.86],[0,1]]),
 C:lathe([[0,0],[.25,.03],[.42,.2],[.46,.45],[.34,.72],[.14,.92],[0,1]]),
 D:lathe([[0,0],[.3,.04],[.42,.3],[.42,.6],[.34,.86],[.18,.99],[0,1.0]])};
var CS={A:[.135,.38,.135],C:[.40,.34,.10],D:[.21,.30,.21]};
[-1,1].forEach(function(sx){[-1,1].forEach(function(sz){
  var X=function(x,y,z){return new THREE.Vector3(sx*x,y,sz*z);};
  if(CL==='B'){/* slim hook claw: thin, long, sharp tip curving over the girdle */
    setting.add(taperTube([[sx*.10,-.58,sz*.20],[sx*.26,-.40,sz*.40],[sx*.42,-.16,sz*.57],[sx*.455,.00,sz*.625],[sx*.45,.09,sz*.62],[sx*.39,.15,sz*.565],[sx*.33,.155,sz*.505],[sx*.285,.135,sz*.46]],.085,.010,80));
    return;}
  setting.add(taperTube([[sx*.10,-.58,sz*.20],[sx*.26,-.40,sz*.40],[sx*.42,-.16,sz*.57],[sx*.455,.0,sz*.63],[sx*.455,.09,sz*.63]],.046,.042,40));
  var m=new THREE.Mesh(LG[CL],gold),sc=CS[CL];m.scale.set(sc[0],sc[1],sc[2]);m.position.copy(X(.455,.105,.63));
  var d=X(-.7,-.04,-.7).normalize(),tg=new THREE.Vector3(sx,0,-sz).normalize(),zz=new THREE.Vector3().crossVectors(tg,d).normalize();tg.crossVectors(d,zz).normalize();
  m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(tg,d,zz));m.castShadow=true;setting.add(m);
});});
var stem=new THREE.Mesh(new THREE.CylinderGeometry(.03,.03,.14,12),gold);stem.position.set(0,-.62,0);setting.add(stem);
/* bail: pave bridge with three small diamonds, then the ring the chain runs through */
var brg=new THREE.Mesh(new THREE.SphereGeometry(1,24,16),gold);brg.scale.set(.12,.05,.20);brg.position.set(0,-.045,-1.0);brg.castShadow=true;setting.add(brg);
var bd=new THREE.InstancedMesh(DIA.geo,DIA.mat,3);bd.frustumCulled=false;
(function(){var d=new THREE.Object3D();[-.93,-1.0,-1.07].forEach(function(z,i){d.position.set(0,-.004,z);d.rotation.set(0,i,0);d.scale.setScalar(.036);d.updateMatrix();bd.setMatrixAt(i,d.matrix);});bd.instanceMatrix.needsUpdate=true;})();
setting.add(bd);
var bail=new THREE.Mesh(new THREE.TorusGeometry(.115,.026,14,40),gold);bail.position.set(0,-.02,-BAIL);bail.rotation.set(0,Math.PI/2-.62,0);bail.castShadow=true;setting.add(bail);
var pend=new THREE.Group();pend.add(gem);pend.add(setting);scene.add(pend);

/* ================= opening: loose stones on a beige felt ================= */
var deco=new THREE.Group();scene.add(deco);
var PLY=-.56;
var tc=document.createElement('canvas');tc.width=tc.height=256;var tx=tc.getContext('2d'),tg_=tx.createRadialGradient(110,95,0,128,128,200);tg_.addColorStop(0,'#f3eadb');tg_.addColorStop(.45,'#e3d6c1');tg_.addColorStop(1,'#bba98f');tx.fillStyle=tg_;tx.fillRect(0,0,256,256);for(var gi=0;gi<9000;gi++){tx.fillStyle='rgba('+(gi%2?'255,250,240':'90,70,40')+','+(Math.random()*.07)+')';tx.fillRect(Math.random()*256,Math.random()*256,1.2,1.2);}
var felt=new THREE.CanvasTexture(tc);felt.encoding=THREE.sRGBEncoding;
var floor=new THREE.Mesh(new THREE.PlaneGeometry(140,140),new THREE.MeshBasicMaterial({map:felt,toneMapped:false,transparent:true,depthWrite:false}));floor.rotation.x=-Math.PI/2;floor.position.y=PLY;floor.renderOrder=-2;deco.add(floor);
var sh=document.createElement('canvas');sh.width=sh.height=128;var sx=sh.getContext('2d'),gr=sx.createRadialGradient(64,64,0,64,64,64);gr.addColorStop(0,'rgba(60,45,25,.34)');gr.addColorStop(1,'rgba(60,45,25,0)');sx.fillStyle=gr;sx.fillRect(0,0,128,128);
var shTex=new THREE.CanvasTexture(sh);
function blob(w,l,x,z,parent){var m=new THREE.Mesh(new THREE.PlaneGeometry(w,l),new THREE.MeshBasicMaterial({map:shTex,transparent:true,depthWrite:false,toneMapped:false}));m.rotation.x=-Math.PI/2;m.position.set(x,PLY+.004,z);m.renderOrder=-1;parent.add(m);return m;}
function tint(r,g,b,a){var c=document.createElement('canvas');c.width=c.height=64;var x=c.getContext('2d'),q=x.createRadialGradient(32,32,0,32,32,32);q.addColorStop(0,'rgba('+r+','+g+','+b+','+a+')');q.addColorStop(1,'rgba('+r+','+g+','+b+',0)');x.fillStyle=q;x.fillRect(0,0,64,64);return new THREE.CanvasTexture(c);}
function glow(tex,w,l,x,z,parent){var m=new THREE.Mesh(new THREE.PlaneGeometry(w,l),new THREE.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false,toneMapped:false}));m.rotation.x=-Math.PI/2;m.position.set(x,PLY+.006,z);m.renderOrder=-1;parent.add(m);return m;}
var shadowE=blob(2.3,2.8,0,.05,scene);
var SA=stone(brilliantPts(12,.42,.54,.62),1.77,[TQ('bR',3.0),TQ('bG',1.7),TQ('bB',.05)],0,TQ('bx',3.6),.15,6);
SA.mat.uniforms.uGam.value=1.55;SA.mat.uniforms.uLam.value=1;SA.mat.uniforms.uExt.value=.6;SA.mat.uniforms.uGlow.value.set(.0,.01,.06);SA.mat.uniforms.uBase.value=.6;SA.mat.uniforms.uCloud.value=.15;SA.mat.uniforms.uZone.value=.55;
var sap=new THREE.Mesh(SA.geo,SA.mat);sap.position.set(-1.62,PLY+.86*.62,-.55);sap.rotation.y=.6;sap.castShadow=false;deco.add(sap);blob(1.5,1.8,-1.62,-.5,deco);
var RU=stone(brilliantPts(12,.36,.46,.60),1.77,[TQ('rR',.12),TQ('rG',3.0),TQ('rB',2.2)],0,TQ('rx',3.8),.15,6);
RU.mat.uniforms.uGam.value=1.55;RU.mat.uniforms.uLam.value=1;RU.mat.uniforms.uExt.value=.5;RU.mat.uniforms.uGlow.value.set(.07,.0,.01);RU.mat.uniforms.uBase.value=.6;RU.mat.uniforms.uCloud.value=.2;RU.mat.uniforms.uZone.value=.5;
glow(tint(20,150,110,.32),1.25,1.25,.5,.4,deco);glow(tint(30,60,200,.3),1.0,1.0,-1.35,-.2,deco);glow(tint(220,30,70,.3),.9,.9,1.8,.15,deco);
var rub=new THREE.Mesh(RU.geo,RU.mat);rub.position.set(1.58,PLY+.86*.60,-.15);rub.rotation.y=-.5;deco.add(rub);blob(1.3,1.6,1.58,-.1,deco);
var loose=new THREE.InstancedMesh(DIA.geo,DIA.mat,7);loose.frustumCulled=false;
(function(){var d=new THREE.Object3D();[[-.7,.95,.075],[.55,1.15,.06],[-.4,-1.15,.08],[.95,-1.0,.06],[-1.0,.35,.055],[1.05,.7,.07],[.05,1.55,.05]].forEach(function(q,i){d.position.set(q[0],PLY+.86*q[2],q[1]);d.rotation.set((i%3-1)*.25,i*1.3,(i%2?.2:-.15));d.scale.setScalar(q[2]);d.updateMatrix();loose.setMatrixAt(i,d.matrix);});loose.instanceMatrix.needsUpdate=true;})();

/* jeweller's tweezers and loupe, as in the reference photograph */
var steel=new THREE.MeshStandardMaterial({color:0xdde1e6,metalness:1,roughness:.2,envMapIntensity:1.4});
[0,1].forEach(function(k){var arm=new THREE.Mesh(new THREE.CylinderGeometry(.013,.05,4.4,14),steel);arm.rotation.z=Math.PI/2;arm.rotation.y=.0;
  var g=new THREE.Group();g.add(arm);g.position.set(-4.3,PLY+.05+k*.015,.45+k*.22);g.rotation.y=-.34+k*.07;g.rotation.z=0;arm.position.x=0;deco.add(g);});
blob(4.6,.5,-4.0,.7,deco);
var loupe=new THREE.Group();
var lr=new THREE.Mesh(new THREE.TorusGeometry(.66,.2,28,56),new THREE.MeshStandardMaterial({color:0x17181c,metalness:.7,roughness:.32,envMapIntensity:1.2}));lr.rotation.x=Math.PI/2-.0;loupe.add(lr);
var lg=new THREE.Mesh(new THREE.CircleGeometry(.62,48),new THREE.MeshStandardMaterial({color:0x1b2430,metalness:.9,roughness:.05,envMapIntensity:2.2}));lg.rotation.x=-Math.PI/2;lg.position.y=.02;loupe.add(lg);
var larm=new THREE.Mesh(new THREE.CylinderGeometry(.16,.2,1.6,20),new THREE.MeshStandardMaterial({color:0x141518,metalness:.6,roughness:.4}));larm.rotation.z=Math.PI/2;larm.position.set(.95,.18,-.55);larm.rotation.y=.5;loupe.add(larm);
loupe.scale.setScalar(.62);loupe.position.set(3.55,PLY+.14,-1.0);loupe.rotation.set(.0,-.5,.2);deco.add(loupe);blob(1.3,1.3,3.6,-.85,deco);
deco.add(loose);

/* ================= display bust: shield-shaped navy velvet form on a gold plinth ================= */
function ssm(a,b,x){x=cl((x-a)/(b-a));return x*x*(3-2*x)}
var YT=3.5,HH=10.2,YB=YT-HH;
function prof(y){var s=cl((YT-y)/HH)*HH,sh=ssm(.7,4.3,s),top=1.5+(4.7-1.5)*sh,t=cl((s-4.3)/(HH-4.3)),f=Math.sqrt(Math.max(0,1-t*t));
  return [top*f,(1.05+.28*sh)*Math.pow(f,.5),2.3+1.1*sh];}
function sgnp(v,e){return (v<0?-1:1)*Math.pow(Math.abs(v),e)}
function bodyPt(y,th,off){var p=prof(y),e=2/p[2];return new THREE.Vector3(sgnp(Math.sin(th),e)*(p[0]+off),y,sgnp(Math.cos(th),e)*(p[1]+off));}
var NU=160,NV=170,bpos=[],bidx=[],uvs=[];
for(var iv=0;iv<=NV;iv++){var tt=iv/NV,yy=YT-HH*(1-Math.pow(1-tt,2));for(var iu=0;iu<=NU;iu++){var th=iu/NU*Math.PI*2;var q=bodyPt(yy,th,0);bpos.push(q.x,q.y,q.z);uvs.push(iu/NU*20*(20/3.0)*.45,(YT-yy)*.9);}}
for(iv=0;iv<NV;iv++)for(iu=0;iu<NU;iu++){var a=iv*(NU+1)+iu,b=a+1,c=a+NU+1,d=c+1;bidx.push(a,b,c,b,d,c);}
var bg=new THREE.BufferGeometry();bg.setAttribute('position',new THREE.Float32BufferAttribute(bpos,3));bg.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));bg.setIndex(bidx);bg.computeVertexNormals();
var bustMat=new THREE.ShaderMaterial({
 uniforms:{uBase:{value:new THREE.Color(TQ('bc',.005),.014,.055)},uSheen:{value:new THREE.Color(.08,.17,.46)},uRim:{value:TQ('rim',1.0)}},
 vertexShader:"varying vec3 vNw;varying vec3 vWp;void main(){vNw=normalize(mat3(modelMatrix)*normal);vec4 w=modelMatrix*vec4(position,1.);vWp=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}",
 fragmentShader:[
 "uniform vec3 uBase;uniform vec3 uSheen;uniform float uRim;varying vec3 vNw;varying vec3 vWp;",
 "float hh(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}",
 "float vn(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);return mix(mix(mix(hh(i),hh(i+vec3(1,0,0)),f.x),mix(hh(i+vec3(0,1,0)),hh(i+vec3(1,1,0)),f.x),f.y),mix(mix(hh(i+vec3(0,0,1)),hh(i+vec3(1,0,1)),f.x),mix(hh(i+vec3(0,1,1)),hh(i+vec3(1,1,1)),f.x),f.y),f.z);}",
 "void main(){",
 " vec3 N=normalize(vNw),V=normalize(cameraPosition-vWp);float nv=clamp(dot(N,V),0.,1.);",
 " vec3 L1=normalize(vec3(-.45,.75,.65)),L2=normalize(vec3(.7,.15,.55));",
 " float d1=max(dot(N,L1),0.),d2=max(dot(N,L2),0.);",
 /* pile lies in drifting directions: patches that turn lighter or darker with the view, as when velvet is stroked */
 " float nap=vn(vWp*.55)*.65+vn(vWp*1.7+3.)*.35;",
 " float R=pow(1.-nv,2.3);",
 " vec3 col=uBase*(.5+.9*d1+.4*d2);",
 " col+=uSheen*uRim*R*(.35+.8*d1+.5*d2)*(.75+.6*nap);",
 " col+=uSheen*.12*(nap-.4)*(1.-R)*(.3+d1);",
 /* fibre tips: fine grain that fades out when too small to resolve */
 " vec3 gp=vWp*110.;float fw=length(fwidth(gp));float ga=1.-smoothstep(.7,1.6,fw);",
 " float g=hh(floor(gp))-.5;float g2=hh(floor(gp*.5)+7.)-.5;",
 " col*=1.+ga*(.34*g+.18*g2)*(.5+R*1.2);",
 " gl_FragColor=vec4(col,1.);",
 " #include <tonemapping_fragment>",
 " #include <encodings_fragment>",
 "}"].join("\n")});
var bust=new THREE.Mesh(bg,bustMat);bust.receiveShadow=true;
var bustG=new THREE.Group();bustG.add(bust);bustG.visible=false;scene.add(bustG);
var goldDS=gold.clone();goldDS.side=THREE.DoubleSide;
/* thin rounded gold rim swept around the neck outline: nothing but the rim shows from any angle */
(function(){
  var K=160,Q=18,pos=[],ix=[],A=.05,B=.075,yc=YT+.01,k,q;
  for(k=0;k<K;k++){var th=k/K*Math.PI*2,c0=bodyPt(YT,th,.012),c1=bodyPt(YT,th,.012+.01);var nx=c1.x-c0.x,nz=c1.z-c0.z,nl=Math.hypot(nx,nz)||1;nx/=nl;nz/=nl;
    for(q=0;q<Q;q++){var a=q/Q*Math.PI*2;pos.push(c0.x+nx*Math.cos(a)*A,yc+Math.sin(a)*B,c0.z+nz*Math.cos(a)*A);}}
  for(k=0;k<K;k++){var k2=(k+1)%K;for(q=0;q<Q;q++){var q2=(q+1)%Q,a0=k*Q+q,a1=k*Q+q2,a2=k2*Q+q,a3=k2*Q+q2;ix.push(a0,a2,a1,a1,a2,a3);}}
  var cg=new THREE.BufferGeometry();cg.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));cg.setIndex(ix);cg.computeVertexNormals();
  var rimM=gold.clone();rimM.side=THREE.DoubleSide;bustG.add(new THREE.Mesh(cg,rimM));
  var pos2=[];for(k=0;k<K;k++){var pp=bodyPt(YT,k/K*Math.PI*2,-.02),pn=bodyPt(YT,(k+1)/K*Math.PI*2,-.02);pos2.push(0,YT-.02,0,pp.x,YT-.02,pp.z,pn.x,YT-.02,pn.z);}
  var cg2=new THREE.BufferGeometry();cg2.setAttribute('position',new THREE.Float32BufferAttribute(pos2,3));cg2.computeVertexNormals();
  bustG.add(new THREE.Mesh(cg2,new THREE.MeshStandardMaterial({color:0xece4d4,roughness:.6,side:THREE.DoubleSide})));
})();
/* stem and hexagonal plinth, joined: flared foot, chamfered plate */
var PL_TOP=YB-1.15;
var STT=YB-.34;var stem2=new THREE.Mesh(new THREE.CylinderGeometry(.26,.3,STT-PL_TOP,28),gold);stem2.position.y=(PL_TOP+STT)/2;bustG.add(stem2);
var cup=new THREE.Mesh(new THREE.CylinderGeometry(.5,.26,.26,32),gold);cup.position.y=STT+.12;bustG.add(cup);
var foot=new THREE.Mesh(new THREE.CylinderGeometry(.3,.7,.22,28),gold);foot.position.y=PL_TOP+.11;bustG.add(foot);
var plin=new THREE.Mesh(new THREE.CylinderGeometry(3.05,3.3,.34,6),gold);plin.rotation.y=Math.PI/6;plin.position.y=PL_TOP-.17;bustG.add(plin);
var plinTop=new THREE.Mesh(new THREE.CylinderGeometry(2.85,3.05,.05,6),gold);plinTop.rotation.y=Math.PI/6;plinTop.position.y=PL_TOP+.025;bustG.add(plinTop);

var pshT=(function(){var c=document.createElement('canvas');c.width=c.height=64;var x=c.getContext('2d'),g=x.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'rgba(0,0,8,.75)');g.addColorStop(1,'rgba(0,0,8,0)');x.fillStyle=g;x.fillRect(0,0,64,64);return new THREE.CanvasTexture(c);})();
var pshadow=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:pshT,transparent:true,depthWrite:false,toneMapped:false}));pshadow.visible=false;scene.add(pshadow);
/* ================= chain: fine constant-pitch links on a morphing curve ================= */
var PITCH=.047,NL=560;
var linkG=new THREE.TorusGeometry(.04,.017,10,24);linkG.scale(1,.62,1);
var links=new THREE.InstancedMesh(linkG,gold,NL);links.frustumCulled=false;links.castShadow=false;scene.add(links);
var dummy=new THREE.Object3D(),M4=new THREE.Matrix4(),ZERO=new THREE.Matrix4().makeScale(0,0,0);
var BZ=0,DS=1,MMS=null,PHI=0,qSw=new THREE.Quaternion(),ZAX=new THREE.Vector3(0,0,1);
function surfZ(x,y,off){var p=prof(y),hw=p[0]+off,hd=p[1]+off,v=Math.min(1,Math.abs(x)/hw);return hd*Math.pow(Math.max(0,1-Math.pow(v,p[2])),1/p[2]);}
function halfCurve(sgn,anchor,m){
  var pts=[],M1=14,M2=9,YN=YT-1.7,off=.17,xN=prof(YN)[0]+off,S=YN-anchor.y,i,V=new THREE.Vector3();
  function mix(t,wx,wy,wz){/* hanging V running off screen, blended into the draped chain */
    var vx=sgn*(t*7.2),vy=anchor.y+Math.pow(t,1.35)*3.9,vz=anchor.z-t*.1;
    pts.push(new THREE.Vector3(lerp(vx,wx,m),lerp(vy,wy,m),lerp(vz,wz,m)));}
  for(i=0;i<M1;i++){var u=i/(M1-1),t=i/(M1+M2-1);var x=xN*u,y=anchor.y+S*Math.pow(u,2.3);mix(t,sgn*x,y,surfZ(x,y,off)+BZ);}
  for(i=1;i<=M2;i++){var th=Math.PI/2+i/M2*1.25,t2=(M1-1+i)/(M1+M2-1);var w=bodyPt(YN,th,off);mix(t2,sgn*w.x,YN,w.z+BZ);}
  pts[0].copy(anchor);
  return new THREE.CatmullRomCurve3(pts,false,'centripetal');
}
function placeChain(anchor,m,reveal){
  var k=0;
  [1,-1].forEach(function(sgn){
    var cu=halfCurve(sgn,anchor,m),L=cu.getLength();
    var n=Math.floor(L/PITCH),vis=Math.floor(n*reveal);
    for(var j=0;j<n&&k<NL;j++,k++){
      if(j>=vis){links.setMatrixAt(k,ZERO);continue;}
      var u=(j*PITCH+PITCH*.5)/L;u=Math.min(u,.9999);
      var p=cu.getPointAt(u),t=cu.getTangentAt(u).normalize();
      var up=new THREE.Vector3(0,0,1),side=new THREE.Vector3().crossVectors(t,up);if(side.lengthSq()<1e-4)side.set(0,1,0);side.normalize();
      var x=t.clone(),y=(j%2?side:up).clone(),z=new THREE.Vector3().crossVectors(x,y).normalize();y.crossVectors(z,x).normalize();
      M4.makeBasis(x,y,z);M4.setPosition(p);links.setMatrixAt(k,M4);
    }
  });
  for(;k<NL;k++)links.setMatrixAt(k,ZERO);
  links.instanceMatrix.needsUpdate=true;
}

/* ================= camera path (one smooth spline) ================= */
var KF=[ /* p, dist, elev, ty, tx */
 [0,6.8,44,-.1,0],[.07,6.6,42,0,0],[.27,5.8,3,0,0],[.42,6.3,3,.1,0],[.54,6.3,3,.1,0],[.62,8.0,3,.3,0],[.72,14,3,.6,0],[.84,24,3,-.2,0],[.93,31,3,-.85,0],[1,31,3,-.85,0]];
function camAt(p){
  var i=0;while(i<KF.length-2&&p>KF[i+1][0])i++;
  var a=KF[Math.max(0,i-1)],b=KF[i],c=KF[i+1],d=KF[Math.min(KF.length-1,i+2)];
  var t=(p-b[0])/(c[0]-b[0]);t=cl(t);var t2=t*t,t3=t2*t,out=[];
  for(var k=1;k<5;k++){
    var m1=(c[k]-a[k])/(c[0]-a[0])*(c[0]-b[0]),m2=(d[k]-b[k])/(d[0]-b[0])*(c[0]-b[0]);
    if(i===0)m1=0;if(i===KF.length-2)m2=0;
    out.push((2*t3-3*t2+1)*b[k]+(t3-2*t2+t)*m1+(-2*t3+3*t2)*c[k]+(t3-t2)*m2);
  }
  return out;
}

/* ================= timeline ================= */
var H=[document.getElementById('gs3-h0'),document.getElementById('gs3-h1'),document.getElementById('gs3-h2')],hint=document.getElementById('gs3-hint');
function fade(el,o,dir){el.style.opacity=o;el.style.transform='translate3d(0,'+((1-o)*14*dir)+'px,0)';}
var qStand=new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI/2,0,0));
var Vpend=new THREE.Vector3(),qYaw=new THREE.Quaternion(),qPitch=new THREE.Quaternion(),qId=new THREE.Quaternion(),qTmp=new THREE.Quaternion(),tmpV=new THREE.Vector3(),YAX=new THREE.Vector3(0,1,0),XAX=new THREE.Vector3(1,0,0);
function frame(p){
  var up=sm(rg(p,.07,.27)),sIn=sm(rg(p,.27,.44));
  var psi=lerp(-.35,.45,sm(rg(p,.02,.36)))-.45*sm(rg(p,.42,.58));
  /* the emerald lifts from the felt and turns to face the viewer; the rest of the table falls away */
  var fall=sm(rg(p,.08,.28));
  deco.position.y=-7*fall;deco.visible=fall<.999;floor.material.opacity=1-sm(rg(p,.07,.29));floor.visible=floor.material.opacity>.003;
  shadowE.visible=floor.visible;shadowE.material.opacity=(1-up)*1;shadowE.position.y=PLY+.004;
  var lift=.62*Math.sin(Math.PI*up);
  /* setting assembles from behind the stone */
  setting.visible=sIn>.001;setting.rotation.y=lerp(2.2,0,sIn);setting.scale.setScalar(lerp(.55,1,sIn));
  /* chain / neck state */
  var rev=sm(rg(p,.54,.66)),neck=sm(rg(p,.60,.78)),mmR=sm(rg(p,.77,.92));var mmx=(MMS===null)?mmR:MMS,mm=Math.min(1,Math.max(0,mmx));
  var wScale=.7,ay=YT-4.8,rzAt=bodyPt(ay,0,.09).z;
  BZ=-4.5*(1-mm);var wPos=new THREE.Vector3(0,ay-BAIL*wScale,rzAt+.38+BZ);
  var pPos=Vpend.clone().lerp(wPos,mmx),pScale=lerp(1,wScale,mm);
  var slope=Math.atan((bodyPt(ay-1,0,0).z-bodyPt(ay,0,0).z)/1)*mm;qPitch.setFromAxisAngle(XAX,-slope);
  qYaw.setFromAxisAngle(YAX,psi);qSw.setFromAxisAngle(ZAX,PHI*Math.min(1,mm*3));
  qTmp.copy(qId).slerp(qStand,up);
  pend.quaternion.copy(qYaw).multiply(qSw).multiply(qPitch).multiply(qTmp);
  var bailW=pPos.clone().add(new THREE.Vector3(0,BAIL*pScale,0));
  tmpV.copy(pPos).sub(bailW).applyQuaternion(qSw.clone().multiply(qPitch));pend.position.copy(bailW).add(tmpV);pend.position.y+=lift;
  pend.scale.setScalar(pScale);
  tmpV.set(0,0,-lerp(5,0,sIn)).applyQuaternion(qTmp.copy(pend.quaternion).invert());setting.position.copy(tmpV);
  pshadow.visible=mm>.02;pshadow.material.opacity=mm;pshadow.scale.set(2.0*pScale*1.6,2.4*pScale*1.6,1);pshadow.position.set(pend.position.x+.1,pend.position.y-.2*pScale*2,pend.position.z-.30*pScale/.7*.7);
  links.visible=rev>.001;if(links.visible)placeChain(bailW.clone(),mm,rev);
  bustG.visible=neck>.001;bustG.position.set(0,lerp(-14,0,neck),BZ);
  /* camera */
  var ck=camAt(p),lowPow=cam.aspect<.8||devicePixelRatio>2.2;
  gemMats.forEach(function(m){m.uniforms.uDisp.value=lowPow?0:m.userData.disp*(m.userData.disp>.005?1:DS);});
  var dist=ck[0],elev=ck[1]*Math.PI/180,ty=ck[2];
  dist*=cam.aspect<.8?1.45:1;
  cam.position.set(0,ty+Math.sin(elev)*dist,Math.cos(elev)*dist);cam.lookAt(0,ty,0);
  /* copy */
  fade(H[0],1-rg(p,.09,.16),-1);fade(H[1],Math.min(rg(p,.30,.36),1-rg(p,.55,.60)),1);fade(H[2],rg(p,.65,.71),1);
  hint.style.opacity=1-rg(p,.005,.04);
}
function size(){var r=cv.parentNode.getBoundingClientRect();renderer.setSize(r.width,r.height,false);cam.aspect=r.width/r.height;cam.fov=cam.aspect<.8?40:28;cam.updateProjectionMatrix();}
addEventListener('resize',size);size();
var cur=0,tg=0,last=performance.now(),ema=16,settle=1,MV=0,PV=0,SW=6.2,SZ=.42,PW=4.6,PZ=.16,PK=.55;
function prog(){var r=run.getBoundingClientRect(),t=r.height-innerHeight;return t>0?cl(-r.top/t):0;}
var qp=null;
if(qp)cur=parseFloat(qp[1]);else cur=prog();
/* warm-up: compile every shader and upload every texture before the first scroll, so nothing hitches mid-scroll */
if(!qp)(function(){var prev=cur;[.45,.7,.97,0].forEach(function(p){frame(p);renderer.render(scene,cam);});frame(prev);})();
var HOLD=/[?&]hold=1/.test(location.search);var VIS=true;if('IntersectionObserver' in window)new IntersectionObserver(function(e){VIS=e[0].isIntersecting;},{rootMargin:'300px 0px'}).observe(run);
function tick(now){if(HOLD||(!VIS&&!qp)){last=now;requestAnimationFrame(tick);return;}tg=qp?parseFloat(qp[1]):prog();
  var dt=Math.min(.05,Math.max(.001,(now-last)/1000));last=now;
  /* frame-rate independent critically-damped follow */
  cur+=(tg-cur)*(1-Math.exp(-dt*7.5));if(Math.abs(tg-cur)<.00008)cur=tg;
  var moving=Math.abs(tg-cur)>.0004;settle+=((moving?0:1)-settle)*(1-Math.exp(-dt*(moving?20:4)));
  DS=settle;
  if(!qp){var mT=sm(rg(cur,.77,.92));if(MMS===null){MMS=mT;MV=0;PV=0;}
    for(var sub=0,hs=dt/3;sub<3;sub++){var a1=-SW*SW*(MMS-mT)-2*SZ*SW*MV;MV+=a1*hs;var xo=MMS;MMS+=MV*hs;
      var a2=-PW*PW*PHI-2*PZ*PW*PV+PK*MV;PV+=a2*hs;PHI+=PV*hs;}}
  frame(cur);renderer.render(scene,cam);
  /* adaptive resolution: hold ~60fps by trading pixels, never stutter */
  ema+=(dt*1000-ema)*.08;
  if(ema>22&&PR>.7){PR=Math.max(.7,PR-.1);renderer.setPixelRatio(PR);size();ema=16;}
  else if(ema<11&&PR<Math.min(devicePixelRatio||1,1.5)){PR=Math.min(Math.min(devicePixelRatio||1,1.5),PR+.05);renderer.setPixelRatio(PR);size();ema=16;}
  requestAnimationFrame(tick);}
if(window.__vlGo)window.__go=function(p){cur=p;MMS=null;frame(p);renderer.render(scene,cam);};
requestAnimationFrame(tick);
})();
