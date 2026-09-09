import * as THREE from "three";

/** A thin outer contour of the visible selection, never the mesh's polygon edges. */
export class SelectionOutline {
  private maskScene=new THREE.Scene();
  private proxies=new Map<THREE.Mesh,THREE.Mesh>();
  private selectedMaterial=new THREE.MeshBasicMaterial({color:0xffffff,side:THREE.DoubleSide,toneMapped:false});
  private occluderMaterial=new THREE.MeshBasicMaterial({color:0x000000,side:THREE.DoubleSide,toneMapped:false});
  private target:THREE.WebGLRenderTarget|null=null;
  private quadScene=new THREE.Scene();
  private camera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
  private geometry=new THREE.PlaneGeometry(2,2);
  private material=new THREE.ShaderMaterial({
    transparent:true,depthTest:false,depthWrite:false,toneMapped:false,
    uniforms:{mask:{value:null},texel:{value:new THREE.Vector2()}},
    vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`,
    fragmentShader:`uniform sampler2D mask;uniform vec2 texel;varying vec2 vUv;
      void main(){
        float center=texture2D(mask,vUv).r;
        if(center>.5)discard;
        float edge=0.;
        for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
          vec2 p=vUv+vec2(float(x),float(y))*texel;
          if(p.x>=0.&&p.y>=0.&&p.x<=1.&&p.y<=1.)edge=max(edge,texture2D(mask,p).r);
        }
        if(edge<.5)discard;
        gl_FragColor=vec4(vec3(.85),.45);
      }`,
  });
  constructor(){this.maskScene.background=new THREE.Color(0);this.quadScene.add(new THREE.Mesh(this.geometry,this.material));}
  render(renderer:THREE.WebGLRenderer,camera:THREE.Camera,objects:THREE.Mesh[],selected:Set<THREE.Mesh>,width:number,height:number){
    if(!selected.size){this.maskScene.clear();this.proxies.clear();return;}
    const alive=new Set(objects.filter(object=>object.visible));
    for(const [source,proxy] of this.proxies)if(!alive.has(source)){proxy.removeFromParent();this.proxies.delete(source);}
    for(const source of alive){
      let proxy=this.proxies.get(source);
      if(!proxy){proxy=new THREE.Mesh();proxy.matrixAutoUpdate=false;this.proxies.set(source,proxy);this.maskScene.add(proxy);}
      proxy.geometry=source.geometry;proxy.matrix.copy(source.matrixWorld);proxy.matrixWorldNeedsUpdate=true;
      proxy.material=selected.has(source)?this.selectedMaterial:this.occluderMaterial;
    }
    // One mask pixel per CSS pixel keeps thickness stable without a DPR-sized postprocess.
    width=Math.max(1,Math.round(width));height=Math.max(1,Math.round(height));
    if(!this.target)this.target=new THREE.WebGLRenderTarget(width,height,{minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter});
    else if(this.target.width!==width||this.target.height!==height)this.target.setSize(width,height);
    const previousTarget=renderer.getRenderTarget(),viewport=renderer.getViewport(new THREE.Vector4()),scissor=renderer.getScissor(new THREE.Vector4()),scissorTest=renderer.getScissorTest(),autoClear=renderer.autoClear;
    try{
      renderer.setRenderTarget(this.target);renderer.setScissorTest(false);renderer.autoClear=true;
      renderer.render(this.maskScene,camera);
      renderer.setRenderTarget(previousTarget);renderer.setViewport(viewport);renderer.setScissor(scissor);renderer.setScissorTest(scissorTest);renderer.autoClear=false;
      this.material.uniforms.mask.value=this.target.texture;this.material.uniforms.texel.value.set(1/width,1/height);
      renderer.render(this.quadScene,this.camera);
    }finally{
      renderer.setRenderTarget(previousTarget);renderer.setViewport(viewport);renderer.setScissor(scissor);renderer.setScissorTest(scissorTest);renderer.autoClear=autoClear;
    }
  }
  dispose(){this.target?.dispose();this.target=null;this.maskScene.clear();this.proxies.clear();this.selectedMaterial.dispose();this.occluderMaterial.dispose();this.geometry.dispose();this.material.dispose();}
}
