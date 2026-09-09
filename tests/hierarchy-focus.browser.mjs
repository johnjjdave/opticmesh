import {createRequire} from 'node:module';import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1700,height:1050}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>window.showSaveFilePicker=undefined);await page.goto('http://localhost:3000/');await page.getByText('Manual save only',{exact:true}).waitFor();await page.getByRole('button',{name:'3D',exact:true}).click();
 await page.getByRole('button',{name:'Import Model\u2026',exact:true}).click();const d=page.getByRole('dialog');
 const quad=(name,x,i)=>`o ${name}\nv ${x} 0 0\nv ${x+1} 0 0\nv ${x+1} 1 0\nv ${x} 1 0\nf ${i} ${i+1} ${i+2} ${i+3}`;
 const obj=Array.from({length:500},(_,i)=>quad('Part_'+i,i===499?20:0,i*4+1)).join('\n');await d.locator('input[type=file]').first().setInputFiles({name:'assembly.obj',mimeType:'text/plain',buffer:Buffer.from(obj)});await d.getByRole('button',{name:'Read model',exact:true}).click();await d.getByLabel('Source units').selectOption('m');await d.getByRole('button',{name:'Import into scene',exact:true}).click();
 const view=page.getByRole('region',{name:'3D viewport',exact:true}),area=page.getByRole('region',{name:'Scene hierarchy',exact:true}),tree=page.getByRole('tree',{name:'Imported models'}),search=page.getByRole('textbox',{name:'Search scene hierarchy',exact:true});

 await search.fill('Part_499');await tree.getByRole('button',{name:'Part_499',exact:true}).click();await search.fill('');await view.focus();await view.hover();await page.keyboard.press('F4');await page.keyboard.press('s');await page.waitForTimeout(150);
 const bounds=await view.locator('[aria-label="Front viewport"]').boundingBox();await page.mouse.click(bounds.x+15,bounds.y+15);await page.mouse.click(bounds.x+bounds.width/2+15,bounds.y+bounds.height/2+15);
 const rootToggle=tree.getByRole('button',{name:/Expand 3D Model/});assert.equal(await rootToggle.getAttribute('aria-expanded'),'false');const rootRow=rootToggle.locator('..');assert(await rootRow.evaluate(e=>e.classList.contains('contains-selection')),'Collapsed parent indicates a viewport-selected descendant');assert.equal(await rootRow.getAttribute('aria-selected'),'false','Ancestor indicator does not select the whole parent');
 await page.mouse.move(10,10);const before=await view.locator("canvas").screenshot();await view.focus();await area.hover();await page.keyboard.press('s');
 const target=tree.getByRole('button',{name:'Part_499',exact:true});await target.waitFor();assert.equal(await target.locator('..').getAttribute('aria-selected'),'true');
 const visible=()=>target.evaluate(e=>{const r=e.getBoundingClientRect(),a=e.closest('.hierarchy-tree').getBoundingClientRect();return r.top>=a.top&&r.bottom<=a.bottom;});assert(await visible(),'Virtualized selected row is revealed inside the shared scroller');assert(Number(await target.evaluate(e=>getComputedStyle(e).fontWeight))>=700);
 await page.mouse.move(10,10);assert.deepEqual(await view.locator("canvas").screenshot(),before,'Hierarchy S never reframes camera');assert(await tree.getByRole('treeitem').count()<40,'Reveal retains virtualization');
 // Hierarchy Focus button clears a filter hiding the selection and reveals it again.
 await search.fill('Part_0');await page.locator('.hierarchy-focus-context').getByRole('button',{name:'Focus',exact:true}).click();assert.equal(await search.inputValue(),'');await target.waitFor();assert(await visible());
 // Text input keeps the S key as text.
 await search.fill('');await search.press('s');assert.equal(await search.inputValue(),'s');await search.fill('');
 // Keyboard focus in hierarchy also owns S when pointer is outside both panels.
 await area.evaluate(e=>e.scrollTop=0);await area.focus();await page.mouse.move(10,10);await page.keyboard.press('S');await target.waitFor();assert(await visible());
 // Viewport S retains camera focus and does not scroll the hierarchy.
 await area.evaluate(e=>e.scrollTop=0);await view.focus();await view.hover();await page.keyboard.press('f');await page.waitForTimeout(120);await page.mouse.move(10,10);const far=await view.locator("canvas").screenshot();await view.focus();await view.hover();await page.keyboard.press('s');await page.waitForTimeout(120);await page.mouse.move(10,10);const focused=await view.locator("canvas").screenshot();assert.notDeepEqual(focused,far);assert.equal(await area.evaluate(e=>e.scrollTop),0);
 await area.hover();await page.keyboard.press('s');await target.waitFor();await page.screenshot({path:'work/v080-local/hierarchy-selection-focus.png'});
 assert.deepEqual(errors,[]);console.log('Viewport selection ancestor highlight, collapsed/virtualized hierarchy reveal, contextual S, Focus button, typing and camera isolation passed with 500 meshes.');
}finally{await browser.close();}
