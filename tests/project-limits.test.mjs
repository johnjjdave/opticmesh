import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import vm from 'node:vm';
import compile from '../desktop/compile-project.cjs';
const limits=JSON.parse(await fs.readFile(new URL('../desktop/project-limits.json',import.meta.url),'utf8'));
const source=await fs.readFile(new URL('../desktop/electron-main.cjs',import.meta.url),'utf8');
const code=source.slice(source.indexOf('function projectBuffer('),source.indexOf('function ensureWorkspaceDirectoriesSync('));
const context={Buffer,MAX_PROJECT_BYTES:limits.projectMiB*1024*1024,SUPPORTED_PROJECT_SCHEMA:4,projectLimits:limits};vm.createContext(context);vm.runInContext(code,context);
const data=JSON.stringify({format:'opticmesh-project',version:4,rawXml:'<xml/>',config:{project:'Large project'},padding:'x'.repeat(150*1024*1024)});
test('a project carrying a 150 MiB payload passes native saving and compile validation',async()=>{
 assert(context.projectBuffer({data:Buffer.from(data)}).length>150*1024*1024);
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'opticmesh-limits-'));assert.equal(path.dirname(root),path.resolve(os.tmpdir()));
 try{const target=path.join(root,'Large project');await compile.writeCompiledProject(target,{project:data,files:[{filename:'Input.png',data:Buffer.from('89504e470d0a1a0a00000000','hex')}]});const saved=await fs.readFile(path.join(target,'Large project.lo2s'));assert(saved.length>150*1024*1024);assert.equal(context.projectBuffer({data:saved}).length,saved.length);}finally{await fs.rm(root,{recursive:true,force:true});}
});
test('the native full-project ceiling still rejects oversized files before parsing',()=>{
 assert.throws(()=>context.projectBuffer({data:Buffer.alloc(limits.projectMiB*1024*1024+1)}),/192 MiB/);
});
