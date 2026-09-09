import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {loadRegressionScene} from './browser-fixture.mjs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1500,height:1000}}), errors=[];
page.on('pageerror',error=>errors.push(error.message));
try {
 await page.goto('http://localhost:3000/');
 await page.getByText('Manual save only',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Pixel Map',exact:true}).click();
 const toggle=()=>page.getByRole('button',{name:'Run test sequence',exact:true});
 assert(await toggle().isDisabled());
 await loadRegressionScene(page);
 await page.clock.install();
 const fills=()=>page.locator('section').filter({has:page.getByRole('heading',{name:'Pattern fill',exact:true})});
 await fills().getByRole('button',{name:'Cabinet Checker',exact:true}).click();
 await page.getByRole('button',{name:'Across Map',exact:true}).click();
 await toggle().click();
 for(const name of ['Metric Grid','Cabinet IDs','Color Bars','Grayscale','Pixel Check','Cabinet Checker']) {
  await page.clock.runFor(3000);
  assert.equal(await fills().getByRole('button',{name,exact:true}).getAttribute('aria-pressed'),'true');
 }
 assert.equal(await page.getByRole('button',{name:'Across Map',exact:true}).getAttribute('aria-pressed'),'true');
 await page.getByRole('button',{name:'Output Map',exact:true}).first().click();
 await page.clock.runFor(3000);
 assert.equal(await fills().getByRole('button',{name:'Metric Grid',exact:true}).getAttribute('aria-pressed'),'true');
 await toggle().click();await page.clock.runFor(6000);
 assert.equal(await fills().getByRole('button',{name:'Metric Grid',exact:true}).getAttribute('aria-pressed'),'true');
 await toggle().click();
 await page.getByRole('button',{name:'Patterns',exact:true}).click();
 assert.equal(await toggle().getAttribute('aria-pressed'),'false');
 await page.clock.runFor(6000);
 await page.getByRole('button',{name:'Pixel Map',exact:true}).click();
 assert.equal(await fills().getByRole('button',{name:'Metric Grid',exact:true}).getAttribute('aria-pressed'),'true');
 assert.equal(await toggle().getAttribute('aria-pressed'),'true');
 await page.clock.runFor(3000);
 assert.equal(await fills().getByRole('button',{name:'Cabinet IDs',exact:true}).getAttribute('aria-pressed'),'true');
 // Preserve interval phase when moving into 3D, and update real screen textures.
 await page.clock.runFor(1500);
 await page.getByRole('button',{name:'3D',exact:true}).click();
 await page.clock.runFor(100);
 const view=page.getByRole('region',{name:'3D viewport',exact:true});
 const capture=()=>view.locator('canvas').first().evaluate(c=>c.toDataURL());
 const before3d=await capture();
 await page.clock.runFor(1500);
 assert.notEqual(await capture(),before3d,'3D pattern surfaces advance');
 await page.getByRole('button',{name:'Pixel Map',exact:true}).click();
 assert.equal(await fills().getByRole('button',{name:'Color Bars',exact:true}).getAttribute('aria-pressed'),'true','3D continues the existing timer');
 await toggle().click();
 const bounds=await toggle().boundingBox();assert(bounds.width>150&&bounds.height>=28);
 await toggle().scrollIntoViewIfNeeded();await page.screenshot({path:'work/v080-local/pixel-map-sequence.png'});
 assert.deepEqual(errors,[]);
 console.log('Pixel Map sequence: full cycle, input/output maps, scope, stop, 3D continuation, Patterns pause/resume and independent Patterns toggle passed.');
}finally{await browser.close();}
