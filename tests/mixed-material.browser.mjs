import { confirmProjectReplacement } from "./browser-fixture.mjs";
import {createRequire} from 'node:module';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1800,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>window.showSaveFilePicker=undefined);
 await page.goto('http://localhost:3000/');await page.getByText('Manual save only',{exact:true}).waitFor();await page.getByRole('button',{name:'3D',exact:true}).click();await page.getByRole('button',{name:'Load Demo Scene',exact:true}).click();await confirmProjectReplacement(page);
 await page.getByRole('button',{name:'Import Model\u2026',exact:true}).click();const d=page.getByRole('dialog');
 await d.locator('input[type=file]').first().setInputFiles({name:'reference.obj',mimeType:'text/plain',buffer:Buffer.from('o Platform\nv -2 0 0\nv 2 0 0\nv 0 3 0\nf 1 2 3')});await d.getByRole('button',{name:'Read model',exact:true}).click();await d.getByLabel('Source units').selectOption('m');await d.getByRole('button',{name:'Import into scene',exact:true}).click();
 const tree=page.getByRole('tree',{name:'Imported models'}),root=tree.locator('.model-name').first(),rootName=await root.textContent();
 const save=async()=>{await page.getByRole('button',{name:'File',exact:true}).click();const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Save As\u2026',exact:true}).click();return JSON.parse(await fs.readFile(await(await pending).path(),'utf8'));};
 await page.getByRole('button',{name:'Select Center Wall',exact:true}).click();await root.click({modifiers:['Control']});await page.locator('.hierarchy-focus-context').getByRole('button',{name:'Group',exact:true}).click();
 const grouped=await save(),group=grouped.simulation.groups.at(-1),groupRow=page.locator(`[data-hierarchy-id="${group.id}"]`),modelId=grouped.simulation.models[0].nodes[0].id,sliceId=group.sliceIds[0];
 await page.getByRole('button',{name:'Material',exact:true}).click();const panel=page.getByLabel('Model material controls',{exact:true}),picker=panel.getByLabel('Diffuse colour',{exact:true}),mode=panel.getByLabel('Material inheritance');
 const color=async value=>{await picker.fill(value);await picker.blur();await page.waitForTimeout(90);};
 await color('#ee2200');await root.click();assert.equal(await mode.inputValue(),'inherit');assert.equal(await picker.inputValue(),'#ee2200','Imported root inherits mixed group material');
 await page.getByRole('button',{name:'Select Center Wall',exact:true}).click();assert.equal(await picker.inputValue(),'#ee2200');assert.equal(await mode.inputValue(),'inherit');
 let saved=await save();assert.equal(saved.simulation.bodyAppearances[group.id].material.color,'#ee2200');assert.equal(saved.simulation.models[0].nodes[0].material,undefined);assert.equal(saved.simulation.models[0].sceneAppearance,undefined,'Computed inheritance is not serialized');assert.equal(saved.simulation.bodyAppearances[sliceId],undefined);
 // Child overrides survive parent edits; returning to Inherit restores the live parent.
 await root.click();await color('#22cc55');await groupRow.locator('.hierarchy-name').click();await color('#2244ee');await root.click();assert.equal(await picker.inputValue(),'#22cc55');await mode.selectOption('inherit');assert.equal(await picker.inputValue(),'#2244ee');
 // Group display uses the same inheritance path independently of material.
 await panel.getByLabel('Model display').selectOption('inherit');
 await groupRow.locator('.hierarchy-name').click();await panel.getByLabel('Model display').selectOption('wireframe');await root.click();assert.equal(await panel.getByLabel('Model display').inputValue(),'inherit');await groupRow.locator('.hierarchy-name').click();await panel.getByLabel('Model display').selectOption('shaded');
 // One Undo restores a group gesture for both domains, without adding local child overrides.
 await color('#dd9900');await page.getByRole('button',{name:/^Undo/}).click();await root.click();assert.equal(await picker.inputValue(),'#2244ee');await page.getByRole('button',{name:'Select Center Wall',exact:true}).click();assert.equal(await picker.inputValue(),'#2244ee');
 // Export resolves inherited stage materials and retains textured LED fronts.
 await page.getByRole('button',{name:'Export',exact:true}).click();const pending=page.waitForEvent('download');await page.getByRole('button',{name:'GLB \u00b7 Universal binary',exact:true}).click();const glb=await fs.readFile(await(await pending).path()),json=JSON.parse(glb.subarray(20,20+glb.readUInt32LE(12)).toString());
 const importedMesh=json.meshes[json.nodes.find(node=>node.name==='Platform'&&node.mesh!==undefined)?.mesh];assert(importedMesh,'Imported mesh exported');assert(json.materials[importedMesh.primitives[0].material].name.startsWith('Stage_2244ee'),'Export uses shared parent material');assert(json.materials.some(m=>m.name==='LED_Surface'&&m.pbrMetallicRoughness.baseColorTexture));
 saved=await save();await page.locator('input[accept*=".lo2s"]').first().setInputFiles({name:'shared-material.lo2s',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(saved))});await root.click();assert.equal(await mode.inputValue(),'inherit');assert.equal(await picker.inputValue(),'#2244ee');
 // Direct mixed selection edits both material stores in one gesture.
 await page.getByRole('button',{name:'Select Center Wall',exact:true}).click({modifiers:['Control']});await color('#bb33dd');saved=await save();assert.equal(saved.simulation.models[0].nodes.find(n=>n.id===modelId).material.color,'#bb33dd');assert.equal(saved.simulation.bodyAppearances[sliceId].material.color,'#bb33dd');
 await page.getByRole('button',{name:/^Undo/}).click();await root.click();assert.equal(await mode.inputValue(),'inherit');assert.equal(await picker.inputValue(),'#2244ee');
 await groupRow.getByRole('button',{name:'Lock group',exact:true}).click();await root.click();assert(await picker.isDisabled(),'Shared ancestor locks protect direct model material edits');
 assert.deepEqual(errors,[]);console.log('Mixed group material inheritance, overrides, display, live parent edits, direct mixed selection, Undo, locks, save/reopen and GLB materials passed.');
}finally{await browser.close();}
