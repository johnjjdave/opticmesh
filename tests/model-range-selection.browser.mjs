import {createRequire} from 'node:module';import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1700,height:1050}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://localhost:3000/');await page.getByText('Manual save only',{exact:true}).waitFor();await page.getByRole('button',{name:'3D',exact:true}).click();
 await page.getByRole('button',{name:'Import Model\u2026',exact:true}).click();const d=page.getByRole('dialog');
 const obj=Array.from({length:500},(_,i)=>`o Part_${String(i).padStart(3,'0')}\nv ${i} 0 0\nv ${i+1} 0 0\nv ${i} 1 0\nf ${i*3+1} ${i*3+2} ${i*3+3}`).join('\n');
 await d.locator('input[type=file]').first().setInputFiles({name:'range.obj',mimeType:'text/plain',buffer:Buffer.from(obj)});await d.getByRole('button',{name:'Read model',exact:true}).click();await d.getByLabel('Source units').selectOption('m');await d.getByRole('button',{name:'Import into scene',exact:true}).click();
 const tree=page.getByRole('tree',{name:'Imported models'}),area=page.getByRole('region',{name:'Scene hierarchy',exact:true}),search=page.getByRole('textbox',{name:'Search scene hierarchy'}),panel=page.getByLabel('Model material controls',{exact:true});
 await tree.getByRole('button',{name:/Expand 3D Model/}).click();await tree.getByRole('button',{name:'Expand Group',exact:true}).click();await page.getByRole('button',{name:'Material',exact:true}).click();
 const part=i=>tree.getByRole('button',{name:`Part_${String(i).padStart(3,'0')}`,exact:true});
 const scroll=async end=>{await area.evaluate((e,end)=>e.scrollTop=end?e.scrollHeight:0,end);await page.waitForTimeout(80);};
 const count=async n=>{await panel.locator('.material-heading strong').filter({hasText:`${n} model items`}).waitFor();assert(await tree.getByRole('treeitem').count()<40,'Range selection retains virtualization');};
 await part(0).click();await scroll(true);assert.equal(await part(0).count(),0,'Anchor is outside mounted rows');await part(499).click({modifiers:['Shift']});await count(500);
 await part(499).click();await scroll(false);await part(0).click({modifiers:['Shift']});await count(500);
 await scroll(true);await part(490).click({modifiers:['Shift']});await count(10);await part(499).click({modifiers:['Control']});await count(9);await part(498).click({modifiers:['Control','Shift']});await count(10);
 // Inspector tab remounts do not lose the range anchor.
 await scroll(false);await part(0).click();await page.getByRole('button',{name:'geometry',exact:true}).click();await page.getByRole('button',{name:'scene',exact:true}).click();await scroll(true);await part(499).click({modifiers:['Shift']});await count(500);
 // Search selects only matching rows; a missing anchor starts a new range.
 await search.fill('Part_49');await part(490).click();await part(499).click({modifiers:['Shift']});await count(10);await search.fill('Part_000');await part(0).click({modifiers:['Shift']});assert.equal(await panel.locator('.material-heading strong').textContent(),'Part_000');
 assert.deepEqual(errors,[]);console.log('500-row forward/reverse hierarchy ranges, offscreen anchor, repeated Shift, Ctrl toggle/add-range, inspector remount, search and virtualization passed.');
}finally{await browser.close();}
