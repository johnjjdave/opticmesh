import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.OPTICMESH_TEST_URL || 'http://localhost:3000/');await page.getByText('Manual save only',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Guide',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'OpticMesh Manual',exact:true}),nav=dialog.getByRole('navigation',{name:'Manual sections',exact:true}),content=dialog.getByRole('article',{name:'Manual content',exact:true});
 assert(await dialog.getByText('Version 0.9.0',{exact:true}).isVisible());
 assert.equal(await dialog.getByText(/Manual version: 0.1|Living Beta documentation|Applies to:/).count(),0);
 assert.equal(await content.evaluate(e=>getComputedStyle(e).fontSize),'16px');
 const headings=(await fs.readFile('app/manual-content.md','utf8')).split(/\r?\n/).filter(l=>/^#{2,3} /.test(l)&&l!=='## Contents');
 const slug=s=>s.replace(/^#+ /,'').replace(/\*\*([^*]+)\*\*/g,'$1').replace(/`([^`]+)`/g,'$1').toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu,'').replace(/\s/g,'-');
 let chapter;
 for(const heading of headings){
  if(heading.startsWith('## ')){chapter=slug(heading);await nav.locator(`a[href="#manual-${chapter}"]`).click();}
  else await nav.locator(`a[href="#manual-${slug(heading)}"]`).click();
  assert.equal(await content.locator('h3').getAttribute('id'),'manual-'+slug(heading));
  assert.equal(await page.evaluate(()=>document.activeElement.id),'manual-'+slug(heading));
  for(const img of await content.locator('img').all()){
   await img.evaluate(e=>e.complete?Promise.resolve():new Promise(resolve=>e.addEventListener('load',resolve,{once:true})));
   assert(await img.evaluate(e=>e.naturalWidth>0),'Bundled screenshot must load');
  }

 }
 await dialog.getByLabel('Search manual',{exact:true}).fill('stage model import');
 await nav.getByRole('link',{name:'Stage model import',exact:true}).click();
 assert(await content.getByRole('button',{name:/Enlarge:/}).isVisible());
 assert(await content.locator('img').evaluate(e=>e.complete&&e.naturalWidth>0));
 await dialog.getByLabel('Manual text size').selectOption('20');assert.equal(await content.evaluate(e=>getComputedStyle(e).fontSize),'20px');
 await content.getByRole('button',{name:/Enlarge:/}).click();
 const illustration=page.getByRole('dialog',{name:'Manual illustration',exact:true});assert(await illustration.isVisible());
 await illustration.getByLabel('Illustration zoom').selectOption('200');assert.equal(await illustration.locator('img').evaluate(e=>e.style.width),'200%');
 await page.keyboard.press('Escape');assert(!(await illustration.isVisible()));assert(await dialog.isVisible());
 await dialog.getByLabel('Manual text size').selectOption('16');
 await page.screenshot({path:'work/v080-local/manual-guide.png'});
 for(const width of [1024,700,420]){
  await page.setViewportSize({width,height:680});
  assert(await dialog.evaluate(e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight&&e.scrollWidth<=e.clientWidth;}));
  assert(await content.evaluate(e=>e.clientHeight>150&&e.scrollWidth<=e.clientWidth));
  await page.screenshot({path:`work/v080-local/manual-guide-${width}.png`});
 }
 await page.setViewportSize({width:1600,height:1000});
 await dialog.getByLabel('Search manual',{exact:true}).fill('xyzzzz');assert(await nav.getByText('0 results',{exact:true}).isVisible());await dialog.getByRole('button',{name:'Clear manual search'}).click();
 await page.keyboard.press('Escape');assert(!(await dialog.isVisible()));
 await page.getByRole('button',{name:'Help',exact:true}).click();await page.getByRole('button',{name:'Keyboard Shortcuts',exact:true}).click();
 assert.equal(await content.locator('h3').textContent(),'Keyboard and mouse reference');
 await nav.getByRole('link',{name:'Current keyboard shortcuts',exact:true}).click();assert(await content.getByRole('table').isVisible());
 await page.screenshot({path:'work/v080-local/manual-shortcuts.png'});
 assert.deepEqual(errors,[]);console.log(`Manual guide: ${headings.length} topic pages, search, text sizing, offline images, zoom, keyboard shortcuts and responsive layout passed.`);
}finally{await browser.close();}
