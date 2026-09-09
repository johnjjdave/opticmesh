import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const quad = (name, x, start = 1) => `o ${name}\nv ${x} 1 0\nv ${x+2} 1 0\nv ${x+2} 3 0\nv ${x} 3 0\nf ${start} ${start+1} ${start+2} ${start+3}\n`;
try {
  for (const hierarchy of [true, false]) {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } }), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('http://localhost:3000/');
    await page.getByText('Manual save only', { exact: true }).waitFor();
    await page.getByRole('button', { name: '3D', exact: true }).click();
    const importObj = async (name, source) => {
      await page.getByRole('button', { name: 'Import Model…', exact: true }).click();
      const dialog = page.getByRole('dialog');
      await dialog.locator('input[type=file]').first().setInputFiles({ name, mimeType: 'text/plain', buffer: Buffer.from(source) });
      await dialog.getByRole('button', { name: 'Read model', exact: true }).click();
      await dialog.getByLabel('Source units').selectOption('m');
      await dialog.getByLabel('Import model hierarchy', { exact: true }).setChecked(hierarchy);
      await dialog.getByRole('button', { name: 'Import into scene', exact: true }).click();
    };
    if (hierarchy) await importObj('pair.obj', quad('Left', -3) + quad('Right', 1, 5) + quad('Occluded', -3, 9).replaceAll(' 0\n', ' -1\n'));
    else { await importObj('left.obj', quad('Left', -3)); await importObj('right.obj', quad('Right', 1)); }
    await page.getByRole('button',{name:'Performance',exact:true}).click();
    const total=hierarchy?6:4;
    const sceneCount=async expected=>{await page.waitForFunction(n=>Number(document.querySelector('[data-metric="Scene triangles"] dd')?.textContent.replaceAll(',',''))===n,expected);};
    await sceneCount(total);
    const view = page.getByRole('region', { name: '3D viewport', exact: true });
    const tree = page.getByRole('tree', { name: 'Imported models' });
    if (hierarchy) {
      await tree.getByRole('button', { name: 'Expand 3D Model — pair.obj', exact: true }).click();
      await tree.getByRole('button', { name: 'Expand Group', exact: true }).click();
    }
    const selected = () => tree.locator('[aria-selected=true] .model-name').allTextContents();
    const expected = hierarchy ? ['Left', 'Right'] : ['3D Model — left.obj', '3D Model — right.obj'];
    for (const shortcut of ['F4', 'F5']) {
      await view.focus(); await page.keyboard.press(shortcut); await page.keyboard.press('f');
      const pane = view.locator('[aria-label="Front viewport"]');
      const bounds = await pane.boundingBox();
      await page.mouse.click(bounds.x + 10, bounds.y + 10);
      await page.waitForTimeout(100);
      // Find the two rendered neutral faces inside this pane; no internal scene hooks.
      const points = await view.locator('canvas').evaluate((canvas, b) => {
        const copy = document.createElement('canvas'); copy.width = canvas.width; copy.height = canvas.height;
        const ctx = copy.getContext('2d'); ctx.drawImage(canvas, 0, 0);
        const rect = canvas.getBoundingClientRect(), ratio = canvas.width / rect.width;
        const y = Math.floor((b.y + b.height / 2 - rect.y) * ratio);
        const d = ctx.getImageData(0, y, canvas.width, 1).data, runs = [];
        let start = -1;
        const min = Math.ceil((b.x - rect.x) * ratio), max = Math.floor((b.x + b.width - rect.x) * ratio);
        for (let x = min; x < max; x++) {
          const i = x*4, ok = d[i] > 65 && d[i] < 200 && Math.abs(d[i]-d[i+1]) < 15 && Math.abs(d[i]-d[i+2]) < 15;
          if (ok && start < 0) start = x;
          if ((!ok || x === max-1) && start >= 0) { if (x-start > 20) runs.push([start,x]); start = -1; }
        }
        return runs.map(([a,b]) => ({ x: rect.x+(a+b)/2/ratio, y: rect.y+y/ratio, left: rect.x+a/ratio, right: rect.x+b/ratio }));
      }, bounds);
      assert.equal(points.length, 2, 'Both model faces are visible');await sceneCount(total);

      const edgePixels=async point=>{await page.waitForTimeout(70);return view.locator('canvas').evaluate((canvas,p)=>{
        const r=canvas.getBoundingClientRect(),scale=canvas.width/r.width,copy=document.createElement('canvas');copy.width=canvas.width;copy.height=canvas.height;const ctx=copy.getContext('2d');ctx.drawImage(canvas,0,0);
        const data=ctx.getImageData(Math.round((p.left-r.x)*scale)-4,Math.round((p.y-r.y)*scale)-20,4,40).data;let white=0;
        for(let i=0;i<data.length;i+=4)if(data[i]>60&&data[i+1]>60&&data[i+2]>60)white++;return white;
      },point);};
      const unselectedEdge=await edgePixels(points[0]),siblingEdge=await edgePixels(points[1]);
      await page.mouse.click(points[0].x, points[0].y); assert.deepEqual(await selected(), [expected[0]]);
      await page.screenshot({path:'work/v080-local/model-outline-'+shortcut+'.png'});assert(await edgePixels(points[0])>unselectedEdge+15,'Selected imported mesh has a muted outer contour in single and All Views');
      assert.equal(await edgePixels(points[1]),siblingEdge,'Unselected sibling has no selection outline');
      await page.keyboard.down('Control'); await page.mouse.click(points[1].x, points[1].y); await page.keyboard.up('Control');
      assert.deepEqual(await selected(), expected, 'Ctrl-click adds model selection');
      await page.keyboard.down('Shift'); await page.mouse.click(points[1].x, points[1].y); await page.keyboard.up('Shift');
      assert.deepEqual(await selected(), [expected[0]], 'Shift-click toggles model selection');
      const marquee = async (first, last) => {
        await page.keyboard.down('Control'); await page.mouse.move(first.left-10, first.y-25); await page.mouse.down();
        await page.mouse.move(last.right+10, last.y+25, { steps: 8 }); await page.mouse.up(); await page.keyboard.up('Control');
      };
      await marquee(points[1], points[1]); assert.deepEqual(await selected(), expected, 'Marquee adds to selected models');
      await page.mouse.click(bounds.x+10, bounds.y+10); assert.deepEqual(await selected(), []);
      await marquee(points[0], points[1]); assert.deepEqual(await selected(), expected, 'Marquee starts model selection from empty space');
      const rightRow = tree.getByRole('treeitem').filter({ has: page.getByRole('button', { name: expected[1], exact: true }) });
      await rightRow.getByRole('button', { name: /Toggle visibility/ }).click();
      await page.mouse.click(bounds.x+10, bounds.y+10);
      await marquee(points[0], points[1]); assert.deepEqual(await selected(), [expected[0]], 'Hidden and occluded meshes are excluded');
      await rightRow.getByRole('button', { name: /Toggle visibility/ }).click();
      const gizmoPixels = () => view.locator('canvas').evaluate((canvas, bounds) => {
        const copy = document.createElement('canvas'); copy.width = canvas.width; copy.height = canvas.height;
        const ctx = copy.getContext('2d'); ctx.drawImage(canvas,0,0);
        const rect = canvas.getBoundingClientRect(), ratio = canvas.width/rect.width;
        const x = Math.round((bounds.x-rect.x)*ratio), y = Math.round((bounds.y+bounds.height/2-45-rect.y)*ratio);
        const data = ctx.getImageData(x,y,Math.floor(bounds.width*ratio),Math.floor(90*ratio)).data;
        let count=0; for(let i=0;i<data.length;i+=4) if(data[i]>220&&data[i+1]<40&&data[i+2]<40)count++;
        return count;
      }, bounds);
      await page.waitForTimeout(100); assert((await gizmoPixels())>10,'Viewport selection displays a gizmo');
      await view.focus(); await page.keyboard.press('Delete'); await page.waitForTimeout(100);
      assert.equal(await gizmoPixels(),0,'Deleting the viewport selection detaches its gizmo immediately');await sceneCount(total-2);
      assert.deepEqual(await selected(),[]);
      await page.keyboard.press('Control+z');
      await tree.getByRole('button',{name:expected[0],exact:true}).waitFor();
      await sceneCount(total);
      const selectionBefore=await selected();
      await page.mouse.move(points[0].x,points[0].y);await page.mouse.down();
      assert.deepEqual(await selected(),selectionBefore,'Starting navigation does not select a mesh');
      await page.mouse.move(points[0].x+30,points[0].y+15,{steps:5});await page.mouse.up();
      assert.deepEqual(await selected(),selectionBefore,'A navigation drag preserves selection');await page.waitForTimeout(1200);await sceneCount(total);
      console.log(`${hierarchy ? 'Model parts' : 'Separate model roots'}: ${shortcut} click, toggle and marquee passed.`);
    }
    assert.deepEqual(errors, []); await page.close();
  }
} finally { await browser.close(); }
