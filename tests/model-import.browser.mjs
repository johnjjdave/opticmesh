import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
await page.addInitScript(() => { window.showSaveFilePicker = undefined; });
const errors=[]; page.on('pageerror',e=>errors.push(e.message)); page.on('console',m=>{if(m.type()==='error')console.log('browser:',m.text());});
try {
  await page.goto(process.env.OPTICMESH_URL || 'http://localhost:3000/');
  await page.getByText('Manual save only',{exact:true}).waitFor();
  await page.getByRole('button',{name:'3D',exact:true}).click();
  await page.getByRole('button',{name:'Import Model…',exact:true}).click();
  const dialog=page.getByRole('dialog');
  await dialog.locator('input[type=file]').first().setInputFiles({name:'stage.obj',mimeType:'text/plain',buffer:Buffer.from('o Platform\nv -1 0 -1\nv 1 0 -1\nv 1 0 1\nv -1 0 1\nf 1 2 3 4\no Tower\nv 0 0 0\nv 0 3 0\nv 1 0 0\nf 5 6 7\n')});
  await dialog.getByRole('button',{name:'Read model',exact:true}).click();
  await dialog.getByRole('button',{name:'Import into scene',exact:true}).waitFor();
  await dialog.locator('.model-preview').waitFor();
  assert(await dialog.getByRole('button',{name:'Import into scene',exact:true}).isDisabled(),'OBJ requires an explicit unit choice');
  await dialog.getByRole('combobox',{name:'Source units',exact:true}).selectOption('m');
  const error=await dialog.locator('[role=alert]').count() ? await dialog.locator('[role=alert]').textContent() : null; if(error)throw new Error(error);
  await dialog.getByRole('button',{name:'Import into scene',exact:true}).click();
  await page.getByRole('tree',{name:'Imported models'}).waitFor();
  assert(await page.locator('.hierarchy-tree').getByRole('tree',{name:'Imported models'}).count(),'Model is inside the scene tree');
  await page.getByRole('button',{name:'Material',exact:true}).click();
  await page.getByRole('combobox',{name:'Model display'}).selectOption('wireframe');
  await page.locator('aside[class*="inspector"]').last().locator(':scope > nav').getByRole('button',{name:'scene',exact:true}).click();
  const x=page.getByRole('group',{name:'Position coordinates',exact:true}).locator('input').nth(0); await x.fill('4'); await x.press('Enter');
  assert.equal(Number(await page.getByRole('group',{name:'Position coordinates',exact:true}).locator('input').nth(0).inputValue()),4);
  const view=page.getByRole('region',{name:'3D viewport',exact:true});await view.focus();await page.keyboard.press('f');await page.keyboard.press('s');await page.waitForTimeout(100);
  await page.screenshot({path:'work/v080-local/model-import.png'});
  await page.getByRole('button',{name:'File',exact:true}).click();
  const download=page.waitForEvent('download'); await page.getByRole('button',{name:'Save As…',exact:true}).click();
  const saved=await download; const project=JSON.parse(await fs.readFile(await saved.path(),'utf8'));
  assert.equal(project.version,4); assert.equal(project.simulation.models.length,1); assert.equal(project.simulation.models[0].nodes[0].style,'wireframe');
  for(const [label,extension] of [['GLB · Universal binary','.glb'],['glTF · Packaged ZIP','.zip'],['Wavefront OBJ · Packaged ZIP','.zip'],['MVR 1.5 · Scene meshes','.mvr'],['STL · Geometry only','.stl'],['USDZ · Packaged scene','.usdz']]) {
    await page.getByRole('button',{name:'Export',exact:true}).click(); const pending=page.waitForEvent('download');await page.getByRole('button',{name:label,exact:true}).click();const exported=await pending;
    assert(exported.suggestedFilename().endsWith(extension));const bytes=await fs.readFile(await exported.path());assert(bytes.length>50);await fs.writeFile('work/model-import/roundtrip'+extension,bytes);console.log('Export verified:',label,bytes.length);
    if (label.startsWith('Wavefront OBJ')) {
      const entries = new Map();
      for (let offset = 0; bytes.readUInt32LE(offset) === 0x04034b50;) {
        assert.equal(bytes.readUInt16LE(offset + 8), 0);
        const size = bytes.readUInt32LE(offset + 18), nameLength = bytes.readUInt16LE(offset + 26), extraLength = bytes.readUInt16LE(offset + 28);
        const start = offset + 30 + nameLength + extraLength;
        entries.set(bytes.toString('utf8', offset + 30, offset + 30 + nameLength), bytes.toString('utf8', start, start + size));
        offset = start + size;
      }
      const obj = [...entries].find(([name]) => name.endsWith('.obj'))[1];
      assert.match(obj, /# Units: metres/);
      assert.match(entries.get('README.txt'), /scale 1 and source units metres/);
      const vertices = obj.split('\n').filter(line => line.startsWith('v ')).map(line => line.trim().split(/\s+/).slice(1).map(Number));
      const bounds = [0, 1, 2].map(axis => [Math.min(...vertices.map(v => v[axis])), Math.max(...vertices.map(v => v[axis]))]);
      // Metre-authored 2 x 3 x 2 geometry translated 4 m along X: no implicit unit conversion.
      assert.deepEqual(bounds, [[3, 5], [0, 3], [-1, 1]]);
    }
  }
  await page.locator('input[accept*=".lo2s"]').first().setInputFiles({name:'model.lo2s',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))});
  await page.getByRole('tree',{name:'Imported models'}).waitFor();
  await page.getByRole('tree',{name:'Imported models'}).locator('.model-name').first().click();
  assert.equal(Number(await page.getByRole('group',{name:'Position coordinates',exact:true}).locator('input').nth(0).inputValue()),4);
  await page.getByRole('button',{name:'Import Model…',exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:'Cancel',exact:true}).click();
  assert.equal(await page.getByRole('tree',{name:'Imported models'}).getByRole('treeitem').count(),1);
  await page.getByRole('tree',{name:'Imported models'}).getByRole('button',{name:/Toggle visibility/}).click();
  await page.getByRole('button',{name:'Export',exact:true}).click();
  const hiddenDownload=page.waitForEvent('download');await page.getByRole('button',{name:'STL · Geometry only',exact:true}).click();
  const hidden=await hiddenDownload;assert.equal((await fs.readFile(await hidden.path())).readUInt32LE(80),0,'Hidden models are excluded from STL');
  assert.equal(errors.length,0,errors.join('\n'));
  console.log('OBJ import, wireframe, coordinates, schema 4 save/reopen passed.');
} finally {await browser.close();}
