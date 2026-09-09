import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import {loadRegressionScene} from '../tests/browser-fixture.mjs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:2});
 await fs.mkdir('public/manual',{recursive:true});
 await page.goto('http://localhost:3000/');await page.getByText('Manual save only',{exact:true}).waitFor();
 await page.screenshot({path:'public/manual/patterns.png'});
 await loadRegressionScene(page);await page.screenshot({path:'public/manual/pixel-map.png'});
 await page.getByRole('button',{name:'3D',exact:true}).click();
 await page.getByRole('button',{name:'Fit Scene',exact:true}).first().click();
 await page.waitForTimeout(700);await page.screenshot({path:'public/manual/3d-overview.png'});
 const xml=await fs.readFile('tests/fixtures/six-screen-regression.xml','utf8');
 const single=xml.replace(/<Slice[\s\S]*?<\/Slice>/g,slice=>slice.includes('demo-centre')?slice:'').replace(/<Screen>[^]*?<layers>\s*<\/layers><\/Screen>/g,match=>match.includes('demo-centre')?match:'');
 await page.getByRole('button',{name:'Pixel Map',exact:true}).click();
 await page.locator('input[accept=".xml,text/xml"]').setInputFiles({name:'Screen layout.xml',mimeType:'text/xml',buffer:Buffer.from(single)});
 await page.getByRole('button',{name:'3D',exact:true}).click();
 await page.getByRole('button',{name:'Import Model…',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Import 3D model'});
 const obj=`o Platform
v -2 0 -1
v 2 0 -1
v 2 0 1
v -2 0 1
f 1 2 3 4
o Screen
v -2 0 -1
v 2 0 -1
v 2 3 -1
v -2 3 -1
f 5 6 7 8`;
 await dialog.locator('input[type=file]').first().setInputFiles({name:'Stage reference.obj',mimeType:'text/plain',buffer:Buffer.from(obj)});
 await dialog.getByRole('button',{name:'Read model',exact:true}).click();
 await dialog.getByLabel('Source units',{exact:true}).selectOption('m');
 await page.waitForTimeout(250);await dialog.screenshot({path:'public/manual/import-model.png'});
 await dialog.getByRole('button',{name:'Import into scene',exact:true}).click();await dialog.waitFor({state:'detached'});
 const tree=page.getByRole('tree',{name:'Imported models'});
 while(await tree.locator('.hierarchy-disclosure[aria-expanded=false]').count())await tree.locator('.hierarchy-disclosure[aria-expanded=false]').first().click();
 await page.locator('.hierarchy-tree').screenshot({path:'public/manual/hierarchy.png'});
 await page.getByRole('button',{name:'Select Centre Wall',exact:true}).click();
 await page.getByRole('button',{name:'Material',exact:true}).click();
 const material=page.locator('.model-material-panel');
 console.log('Material panel matches',await material.count());
 await material.screenshot({path:'public/manual/material.png'});
 console.log('Manual screenshots captured from a generic example scene.');
}finally{await browser.close();}
