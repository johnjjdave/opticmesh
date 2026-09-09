import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const page=await browser.newPage();await page.goto('http://localhost:3000/');
 const result=await page.evaluate(async()=>{
  const {ProjectEncoder}=await import('/app/project-encoder.ts');
  const NativeWorker=window.Worker,patches=[];
  window.Worker=class extends NativeWorker{postMessage(data,...args){patches.push({project:Object.keys(data.project.set),simulation:Object.keys(data.simulation.set)});return super.postMessage(data,...args);}};
  const encoder=new ProjectEncoder(),decode=bytes=>JSON.parse(new TextDecoder().decode(bytes));
  const models=[{id:'model',geometries:{shape:{position:'A'.repeat(8*1024*1024)}},nodes:[]}];
  try{
   const first={format:'opticmesh-project',version:4,rawXml:'<Map/>',logoData:'old',simulation:{models,camera:{position:[1,2,3]},groups:[]}};
   const promise=encoder.encode(first);let busy=false;try{await encoder.encode(first);}catch{busy=true;}
   const saved=decode(await promise);
   const second={...first,simulation:{...first.simulation,camera:{position:[4,5,6]}}};
   const moved=decode(await encoder.encode(second));
   const replacement={format:'opticmesh-project',version:3,rawXml:'',simulation:{models:[],camera:undefined}};
   const fresh=decode(await encoder.encode(replacement));
   encoder.dispose();const restarted=decode(await encoder.encode(first));
   return {busy,patches,first:saved.simulation.models[0].geometries.shape.position.length,moved:moved.simulation.camera,assetRetained:moved.simulation.models[0].geometries.shape.position.length,fresh,restarted:restarted.simulation.models.length};
  }finally{encoder.dispose();window.Worker=NativeWorker;}
 });
 assert(result.busy);assert.equal(result.first,8*1024*1024);assert.equal(result.assetRetained,result.first);
 assert.deepEqual(result.patches[1],{project:[],simulation:['camera']});assert.deepEqual(result.moved.position,[4,5,6]);
 assert.equal(result.fresh.version,3);assert.deepEqual(result.fresh.simulation.models,[]);assert(!('logoData' in result.fresh));assert(!('camera' in result.fresh.simulation));assert(!('groups' in result.fresh.simulation));assert.equal(result.restarted,1);
 console.log('Worker serialization: large asset retained, camera-only delta, project replacement clears old data, one encode at a time, dispose/restart passed.');
}finally{await browser.close();}
