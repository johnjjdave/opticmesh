import { confirmProjectReplacement } from "./browser-fixture.mjs";
import {createRequire} from 'node:module';import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:3000/');await page.getByText('Manual save only',{exact:true}).waitFor();
 await page.getByRole('button',{name:'3D',exact:true}).click();await page.getByRole('button',{name:'Load Demo Scene',exact:true}).click();await confirmProjectReplacement(page);
 await page.getByRole('button',{name:'Import Model…',exact:true}).click();const dialog=page.getByRole('dialog');
 const obj=Array.from({length:500},(_,i)=>`o Part_${i}\nv ${i%20} 0 0\nv ${i%20+1} 0 0\nv ${i%20} 1 0\nf ${3*i+1} ${3*i+2} ${3*i+3}`).join('\n');
 await dialog.locator('input[type=file]').first().setInputFiles({name:'assembly.obj',mimeType:'text/plain',buffer:Buffer.from(obj)});
 await dialog.getByRole('button',{name:'Read model',exact:true}).click();await dialog.getByRole('combobox',{name:'Source units',exact:true}).selectOption('m');await dialog.getByRole('button',{name:'Import into scene',exact:true}).click();
 const tree=page.getByRole('tree',{name:'Imported models'}), outer=page.locator('.hierarchy-tree');
 for(const name of ['Expand 3D Model — assembly.obj','Expand Group']){const toggle=tree.getByRole('button',{name,exact:true});if(await toggle.getAttribute('aria-expanded')!=='true')await toggle.click();}
 // Inspector remounts preserve parent and nested expansion, including intentional collapse.
 const tabs=page.locator('aside[class*="inspector"]').last().locator(':scope > nav');
 for(const tab of ['geometry','source','geometry']){await tabs.getByRole('button',{name:tab,exact:true}).click();await tabs.getByRole('button',{name:'scene',exact:true}).click();assert.equal(await tree.getByRole('button',{name:'Expand 3D Model — assembly.obj',exact:true}).getAttribute('aria-expanded'),'true');assert.equal(await tree.getByRole('button',{name:'Expand Group',exact:true}).getAttribute('aria-expanded'),'true');assert(await tree.getByRole('button',{name:'Part_0',exact:true}).count());}
 const nested=tree.getByRole('button',{name:'Expand Group',exact:true});await nested.click();await tabs.getByRole('button',{name:'source',exact:true}).click();await tabs.getByRole('button',{name:'scene',exact:true}).click();assert.equal(await nested.getAttribute('aria-expanded'),'false');await nested.click();
 const screenRow=page.getByRole('button',{name:'Select Center Wall',exact:true}).locator('..');
 const modelRow=tree.getByRole('button',{name:'Part_0',exact:true}).locator('..');
 const layout=row=>row.evaluate(e=>{const s=getComputedStyle(e),buttons=[...e.children].filter(c=>c.tagName==='BUTTON');return {height:e.getBoundingClientRect().height,font:s.fontSize,columns:s.gridTemplateColumns.split(' ').filter((_,i)=>i!==1),actions:buttons.slice(-2).map(b=>({width:b.getBoundingClientRect().width,height:b.getBoundingClientRect().height,icon:b.querySelector('svg')?.getAttribute('viewBox')}))};});
 assert.deepEqual(await layout(modelRow),await layout(screenRow),'Models and LED slices share row sizing, typography, icon and action columns');
 await tree.getByRole('button',{name:'Part_0',exact:true}).click();
 const selectedStyle=await modelRow.evaluate(e=>({background:getComputedStyle(e).backgroundColor,shadow:getComputedStyle(e).boxShadow}));
 await page.getByRole('button',{name:'Select Center Wall',exact:true}).click();
 assert.deepEqual(await screenRow.evaluate(e=>({background:getComputedStyle(e).backgroundColor,shadow:getComputedStyle(e).boxShadow})),selectedStyle,'Selection uses the shared hierarchy style');
 const visibility=modelRow.getByRole('button',{name:'Toggle visibility Part_0',exact:true}),lockPart=modelRow.getByRole('button',{name:'Toggle lock Part_0',exact:true});
 const eyePath=await visibility.locator('path').getAttribute('d');await visibility.click();assert.equal(await visibility.getAttribute('aria-pressed'),'true');assert.notEqual(await visibility.locator('path').getAttribute('d'),eyePath);await visibility.click();
 await lockPart.click();assert.equal(await lockPart.getAttribute('aria-pressed'),'true');await lockPart.click();
 await tree.getByRole('button',{name:'Part_0',exact:true}).click();
 await page.screenshot({path:'work/v080-local/unified-model-hierarchy.png'});
 assert.equal(await tree.evaluate(e=>getComputedStyle(e).overflowY),'visible');assert.equal(await outer.evaluate(e=>getComputedStyle(e).overflowY),'auto');
 await outer.evaluate(e=>{e.scrollTop=e.scrollHeight;});await tree.getByRole('button',{name:'Part_499',exact:true}).waitFor();
 // Delete removes imported children from hierarchy focus and remains undoable.
 await tree.getByRole('button',{name:'Part_499',exact:true}).click();await page.keyboard.press('Delete');
 assert.equal(await tree.getByRole('button',{name:'Part_499',exact:true}).count(),0);
 await page.getByRole('button',{name:'Undo · Remove model items',exact:true}).click();
 // Screen selections are protected even while an imported model exists.
 await page.getByRole('button',{name:'Select Center Wall',exact:true}).click();
 await page.getByRole('region',{name:'3D viewport',exact:true}).focus();await page.keyboard.press('Delete');
 assert.equal(await page.getByRole('button',{name:'Select Center Wall',exact:true}).count(),1);assert.equal(await tree.count(),1);
 // Numeric editing and open menus retain Delete; a selected locked root is protected.
 await page.getByRole('textbox',{name:'Search scene hierarchy',exact:true}).fill('assembly.obj');
 const root=tree.locator('.model-name').first();await root.click();
 const x=page.getByRole('group',{name:'Position coordinates',exact:true}).locator('input').nth(0);await x.focus();await page.keyboard.press('Delete');assert.equal(await tree.count(),1);await x.press('Enter');
 await page.getByRole('button',{name:'File',exact:true}).click();await page.keyboard.press('Delete');await page.keyboard.press('Escape');assert.equal(await tree.count(),1);
 const lock=tree.getByRole('button',{name:/Toggle lock/});await lock.click();await page.keyboard.press('Delete');assert.equal(await tree.count(),1);await lock.click();
 // Viewport Delete can remove the complete model, without touching screen rows.
 await page.getByRole('region',{name:'3D viewport',exact:true}).focus();await page.keyboard.press('Delete');assert.equal(await tree.count(),0);
 await page.getByRole('textbox',{name:'Search scene hierarchy',exact:true}).fill('');assert.equal(await page.getByRole('button',{name:'Select Center Wall',exact:true}).count(),1);
 await page.getByRole('button',{name:'Undo · Remove model items',exact:true}).click();assert.equal(await tree.count(),1);
 for(const name of ['Expand 3D Model — assembly.obj','Expand Group']){const toggle=tree.getByRole('button',{name,exact:true});if(await toggle.getAttribute('aria-expanded')!=='true')await toggle.click();}
 await outer.evaluate(e=>{e.scrollTop=e.scrollHeight;});await tree.getByRole('button',{name:'Part_499',exact:true}).waitFor();
 assert(await tree.getByRole('treeitem').count()<40,'Rows remain virtualized using the outer scroll');
 await tree.getByRole('button',{name:'Part_499',exact:true}).click();
 await page.getByRole('button',{name:'Remove selected items',exact:true}).click();
 await page.getByRole('button',{name:'Undo · Remove model items',exact:true}).waitFor();assert.equal(await tree.getByRole('button',{name:'Part_499',exact:true}).count(),0);
 await page.getByRole('button',{name:'Undo · Remove model items',exact:true}).click();
 await outer.evaluate(e=>{e.scrollTop=e.scrollHeight;});await tree.getByRole('button',{name:'Part_499',exact:true}).waitFor();
 assert.equal(errors.length,0,errors.join('\n'));console.log('Single hierarchy scrollbar, virtualized final row, child deletion and undo passed with 500 objects plus screens.');
}finally{await browser.close();}
