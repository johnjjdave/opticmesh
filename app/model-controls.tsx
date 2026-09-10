"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { createStudioEnvironment } from "./studio-environment";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { MODEL_EXTENSIONS, ModelLayer, type ImportedModel } from "./model-data";
import "./model-controls.css";
import UiIcon from "./ui-icon";
import projectLimits from "../desktop/project-limits.json";
import { renameModelNode, modelHierarchyRows } from "./model-hierarchy";
import { inherited } from "./model-data";

export function prepareModel(source: ImportedModel, unit: string, up: string, hierarchy: boolean) {
  // MVR geometry has already been assembled in its specified Z-up millimetres.
  const scale = source.format === "mvr" || unit === "mm" ? .001 : unit === "cm" ? .01 : 1;
  const transform = new THREE.Matrix4().makeRotationX(source.format === "mvr" || up === "z" ? -Math.PI / 2 : 0).scale(new THREE.Vector3(scale, scale, scale));
  return { ...source, hierarchy, nodes: source.nodes.map(node => { const matrix=node.parent ? transform.clone().multiply(new THREE.Matrix4().fromArray(node.matrix)).toArray() : new THREE.Matrix4().toArray(); return {...node,matrix,initialMatrix:matrix}; }) };
}
function ModelPreview({ model }: { model: ImportedModel }) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!host.current) return;
    const element = host.current, renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1,1.5)); element.appendChild(renderer.domElement);
    const scene = new THREE.Scene(); scene.background = new THREE.Color(0x101416); const layer = new ModelLayer(); const studio=createStudioEnvironment(renderer, texture => { layer.setEnvironment(texture); draw(); });layer.setEnvironment(studio.texture);layer.sync([model]); scene.add(layer.root);
    scene.add(new THREE.HemisphereLight(0xdce9e5, 0x20262b, 1.7)); const key = new THREE.DirectionalLight(0xffffff, 2.1); key.position.set(8,14,10); scene.add(key);
    const sphere = layer.bounds().getBoundingSphere(new THREE.Sphere()), camera = new THREE.PerspectiveCamera(45, (element.clientWidth || 400) / (element.clientHeight || 300), Math.max(.0001, sphere.radius / 10000), Math.max(100, sphere.radius * 20));
    const controls = new OrbitControls(camera, renderer.domElement); controls.target.copy(sphere.center); camera.position.copy(sphere.center).add(new THREE.Vector3(.7,.5,1).normalize().multiplyScalar(Math.max(.1,sphere.radius * 3.5))); controls.update();
    const draw = () => renderer.render(scene, camera);
    const resize=()=>{const width=Math.max(1,element.clientWidth),height=Math.max(1,element.clientHeight);renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();draw();};
    const observer=new ResizeObserver(resize);observer.observe(element);controls.addEventListener("change", draw);resize();
    return () => { observer.disconnect();controls.dispose(); layer.dispose(); studio.dispose(); renderer.dispose(); renderer.domElement.remove(); };
  }, [model]);
  return <div ref={host} className="model-preview" aria-label="Import model preview" />;
}
export function ModelImportDialog({ onClose, onImport }: { onClose: () => void; onImport: (model: ImportedModel) => void }) {
  const filePicker=useRef<HTMLInputElement>(null),folderPicker=useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDialogElement>(null), worker = useRef<Worker | null>(null), serial = useRef(0);
  const [files, setFiles] = useState<File[]>([]), [name, setName] = useState(""), [source, setSource] = useState<ImportedModel | null>(null), [progress, setProgress] = useState(""), [error, setError] = useState(""), [unit, setUnit] = useState("m"), [up, setUp] = useState("y"), [hierarchy, setHierarchy] = useState(true);
  useEffect(() => { const generation=serial,element=dialog.current!,previous=document.activeElement as HTMLElement|null;element.showModal();element.querySelector<HTMLButtonElement>("[data-initial-focus]")?.focus(); return () => { generation.current++; worker.current?.terminate();element.close();if(previous?.isConnected)previous.focus(); }; }, []);
  // Hierarchy changes picking/organisation only. Keep geometry, dimensions and
  // the preview renderer stable while toggling; apply the choice at import.
  const prepared = useMemo(() => source ? prepareModel(source, unit, up, true) : null, [source,unit,up]);
  const chooseFiles = (selected: File[]) => { ++serial.current; worker.current?.terminate(); setProgress(""); setError(""); setFiles(selected); const main=selected.find(f=>MODEL_EXTENSIONS.includes(f.name.split(".").pop()!.toLowerCase()));setName(main?(main.webkitRelativePath||main.name):"");setSource(null); };
  const dimensions = useMemo(() => { if (!prepared) return null; const layer = new ModelLayer(); layer.sync([prepared]); const size = layer.bounds().getSize(new THREE.Vector3()); layer.dispose(); return size.toArray().map(v => v.toFixed(3)); }, [prepared]);
  const read = async () => {
    worker.current?.terminate(); const token = ++serial.current; setSource(null); setError(""); setProgress("Reading local files…");
    try {
      if (files.reduce((sum, file) => sum + file.size, 0) > 512 * 1024 * 1024) throw new Error("Selected assets exceed the 512 MiB import working budget.");
      const inputs = await Promise.all(files.map(async f => ({ name: f.webkitRelativePath || f.name, bytes: await f.arrayBuffer() })));
      if (token !== serial.current) return;
      if (new Set(inputs.map(f => f.name)).size !== inputs.length) throw new Error("Companion filenames must be unique.");
      const next = new Worker(new URL("./model-import.worker.ts", import.meta.url), { type: "module" }); worker.current = next;
      next.onerror = event => { setError(event.message || "Model processing failed."); setProgress(""); next.terminate(); };
      next.onmessage = event => {
        if (token !== serial.current) return;
        if (event.data.progress) setProgress(event.data.progress);
        if (event.data.error) { setError(event.data.error); setProgress(""); next.terminate(); }
        if (event.data.model) {
          const model = event.data.model as ImportedModel;
          // Existing portable project size policy; this is not a polygon-count cap.
          if (JSON.stringify(model).length > projectLimits.modelAssetsMiB * 1024 * 1024) setError(`Compressed model data exceeds the ${projectLimits.modelAssetsMiB} MiB portable project asset budget. Export only the stage geometry needed for this project.`);
          else { setSource(model); setUnit(["obj","stl"].includes(model.format) ? "" : ["mvr","3ds"].includes(model.format) ? "mm" : model.format === "fbx" ? "cm" : "m"); setUp(["mvr","gdtf","3ds"].includes(model.format) ? "z" : "y"); }
          setProgress(""); next.terminate();
        }
      };
      next.postMessage({ files: inputs, name }, inputs.map(f => f.bytes));
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to read files."); setProgress(""); }
  };
  const totalBytes=files.reduce((sum,file)=>sum+file.size,0);
  const candidates=files.filter(file=>MODEL_EXTENSIONS.includes(file.name.split(".").pop()!.toLowerCase()));
  return <dialog ref={dialog} className="model-dialog" aria-labelledby="model-import-heading" onCancel={event=>{
    // File/folder inputs bubble their own cancel event when the native chooser
    // is dismissed. Only a cancel request on this dialog closes the import.
    if(event.target!==event.currentTarget)return;
    event.preventDefault();onClose();
  }}>
    <header className="model-import-header"><UiIcon name="slice"/><h2 id="model-import-heading">Import 3D model</h2><button className="model-import-close" aria-label="Close import" title="Close import" onClick={onClose}><UiIcon name="close"/></button></header>
    <div className="model-import-body">
      <div className="model-import-settings">
        <section className="model-import-section">
          <h3>Source</h3>
          <div className="model-file-actions"><button data-initial-focus onClick={()=>filePicker.current?.click()}><UiIcon name="file"/>Choose files…</button><button onClick={()=>folderPicker.current?.click()}><UiIcon name="folder"/>Choose folder…</button></div>
          <input ref={filePicker} hidden aria-label="Model and companion files" type="file" multiple onChange={e=>{if(e.target.files?.length)chooseFiles([...e.target.files]);e.currentTarget.value="";}} />
          <input ref={folderPicker} hidden aria-label="Asset folder" type="file" multiple {...{webkitdirectory:""}} onChange={e=>{if(e.target.files?.length)chooseFiles([...e.target.files]);e.currentTarget.value="";}} />
          {!!files.length && <>
            <div className="model-file-summary"><span>{files.length} file{files.length===1?"":"s"}</span><span>{totalBytes>=1048576?`${(totalBytes/1048576).toFixed(1)} MiB`:`${Math.ceil(totalBytes/1024)} KiB`}</span></div>
            {!!candidates.length && <label className="model-import-field"><span>Main model</span><select title={name} value={name} onChange={e=>{++serial.current;worker.current?.terminate();setProgress("");setError("");setName(e.target.value);setSource(null);}}>{candidates.map(file=><option key={file.webkitRelativePath||file.name} value={file.webkitRelativePath||file.name}>{file.webkitRelativePath||file.name}</option>)}</select></label>}
            {!candidates.length&&<p className="model-import-error" role="alert">No supported model found in these files.</p>}
          </>}
          <button className="model-read-button" disabled={!name||!!progress} onClick={read}>{progress?"Reading…":"Read model"}</button>
          <details className="model-import-formats"><summary>Supported formats</summary><p>MVR 1.4 / 1.5 / 1.6, GDTF, glTF / GLB, FBX, OBJ, 3DS, DAE, STL.</p><p>USD / USDA / USDC / USDZ (experimental).</p></details>
          {error&&<p className="model-import-error" role="alert">{error}</p>}
        </section>
        {prepared&&<section className="model-import-section">
          <h3>Scale and orientation{prepared.format==="mvr"&&<span className="model-auto-badge">Automatic</span>}</h3>
          <div className="model-options">
            <label className="model-import-field"><span>Source units</span>{prepared.format==="mvr"?<span className="model-fixed-value">Millimetres</span>:<select aria-label="Source units" aria-invalid={!unit||undefined} value={unit} onChange={e=>setUnit(e.target.value)}><option value="" disabled>Choose units…</option><option value="mm">Millimetres</option><option value="cm">Centimetres</option><option value="m">Metres</option></select>}</label>
            <label className="model-import-field"><span>Source up axis</span>{prepared.format==="mvr"?<span className="model-fixed-value">Z up</span>:<select aria-label="Source up axis" value={up} onChange={e=>setUp(e.target.value)}><option value="y">Y up</option><option value="z">Z up</option></select>}</label>
          </div>
          {!unit&&<p className="model-import-warning">Choose source units to confirm the model size.</p>}
        </section>}
        {prepared&&<section className="model-import-section"><h3>Scene hierarchy</h3><label className="model-hierarchy-option"><span>Import model hierarchy</span><input type="checkbox" checked={hierarchy} onChange={e=>setHierarchy(e.target.checked)}/><i aria-hidden="true"/></label></section>}
        {!!prepared?.warnings.length&&<section className="model-import-section"><details className="model-import-notes" open><summary>Import notes <span>{prepared.warnings.length}</span></summary>{prepared.warnings.map((warning,index)=><p key={index} className="model-import-warning">{warning}</p>)}</details></section>}
      </div>
      <section className="model-import-preview-panel" aria-label="Model inspection">
        <div className="model-preview-heading"><h3>Preview</h3><span className={`model-import-state${prepared&&unit?" ready":""}`}>{progress?"Reading":prepared?(unit?"Ready":"Units required"):"No model loaded"}</span></div>
        <div className="model-preview-stage">{prepared?<ModelPreview model={prepared}/>:<div className="model-preview-empty"><UiIcon name="slice"/><strong>{progress?"Preparing preview":files.length?"Ready to read":"Model preview"}</strong><span role="status">{progress|| (files.length?"Read the model to inspect it here":"Choose files to begin")}</span></div>}</div>
        <div className="model-preview-summary">
          <div className="model-preview-heading"><h3>Dimensions</h3><span>{prepared?(unit?"Metres":"Source units"):"—"}</span></div>
          <dl className="model-dimensions">{["Width · X","Height · Y","Depth · Z"].map((label,index)=><div key={label}><dt>{label}</dt><dd>{dimensions?.[index]??"—"}</dd></div>)}</dl>
          <div className="model-geometry-summary"><span>Meshes <strong>{prepared?prepared.nodes.filter(node=>node.geometry).length.toLocaleString():"—"}</strong></span><span>Triangles <strong>{prepared?prepared.triangles.toLocaleString():"—"}</strong></span></div>
        </div>
      </section>
    </div>
    <footer className="model-import-footer"><span title={name}>{name||"No file selected"}</span><button onClick={onClose}>{progress?"Cancel loading":"Cancel"}</button><button className="model-import-primary" disabled={!prepared||!unit||!!progress} onClick={()=>prepared&&onImport({...prepared,hierarchy})}>Import into scene</button></footer>
  </dialog>;
}

type ModelControlsProps = { models: ImportedModel[]; selected: string[]; onRowSelect:(id:string,modifiers:{ctrlKey:boolean;metaKey:boolean;shiftKey:boolean})=>void; sceneGroupId?:string|null; depthOffset?:number; ancestorIds?:Set<string>; reveal?:{id:string;serial:number}|null; onRevealHandled?:(serial:number)=>void; dragging?:boolean; onDragStart?:(id:string)=>void; onDragEnd?:()=>void; onDropItem?:(id:string,placement:"before"|"inside"|"after")=>void; isLocked?:(id:string)=>boolean; onChange: (models: ImportedModel[], label: string) => void; section?: "appearance"; query?: string; expanded:Set<string>; onToggle:(id:string)=>void };
export function ModelHierarchy({ models, selected, onRowSelect, onChange, query = "", expanded, onToggle, sceneGroupId=null, depthOffset=0, ancestorIds, reveal, onRevealHandled, dragging=false, onDragStart, onDragEnd, onDropItem, isLocked }: ModelControlsProps) {
  const tree = useRef<HTMLDivElement>(null);
  const [editing,setEditing]=useState<{id:string,value:string}|null>(null),[drop,setDrop]=useState<{id:string,placement:"before"|"inside"|"after"}|null>(null);
  const editRef=useRef(editing);
  useEffect(()=>{editRef.current=editing;},[editing]);
  const commitName=()=>{const current=editRef.current;editRef.current=null;setEditing(null);if(current && !isLocked?.(current.id)){const name=current.value.trim(),node=models.flatMap(m=>m.nodes).find(n=>n.id===current.id);if(name&&node?.name!==name)onChange(renameModelNode(models,current.id,name),"Rename hierarchy item");}};
  const placement=(event:React.DragEvent,group:boolean)=>{const r=event.currentTarget.getBoundingClientRect(),y=(event.clientY-r.top)/r.height;return group&&y>=.25&&y<=.75?"inside" as const:y<.5?"before" as const:"after" as const;};
  const [scrollTop,setScrollTop] = useState(0), [viewportHeight,setViewportHeight] = useState(360), [rowHeight,setRowHeight] = useState(34);
  const rows=modelHierarchyRows(models,expanded,query,sceneGroupId,depthOffset);
  useEffect(() => {
    const element = tree.current, scroller = element?.closest<HTMLElement>(".hierarchy-tree");
    if (!element || !scroller) return;
    const update = () => { const height = scroller.querySelector(".hierarchy-row")?.getBoundingClientRect().height; if (height) setRowHeight(height); setScrollTop(Math.max(0, scroller.getBoundingClientRect().top + scroller.clientTop - element.getBoundingClientRect().top)); setViewportHeight(scroller.clientHeight); };
    update(); scroller.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update); observer.observe(scroller); observer.observe(element);
    return () => { scroller.removeEventListener("scroll", update); observer.disconnect(); };
  }, [rows.length]);
  useEffect(()=>{
    if(!reveal)return;
    const at=rows.findIndex(row=>row.node.id===reveal.id),element=tree.current,scroller=element?.closest<HTMLElement>(".hierarchy-tree");
    if(at<0||!element||!scroller)return;
    // Locate the row by its index even when virtualization has not mounted it.
    const top=scroller.scrollTop+element.getBoundingClientRect().top-scroller.getBoundingClientRect().top-scroller.clientTop;
    scroller.scrollTop=top+at*rowHeight-(scroller.clientHeight-rowHeight)/2;
    setScrollTop(Math.max(0,scroller.scrollTop-top));
    onRevealHandled?.(reveal.serial);
  },[reveal,rows.length,rowHeight]);
  const start=Math.max(0,Math.min(rows.length-1,Math.floor(scrollTop/rowHeight)-5)), visible=rows.slice(start,start+Math.ceil(viewportHeight/rowHeight)+10);
  if(!rows.length)return null;
  return <div className="model-hierarchy">
    <div ref={tree} className="model-tree" role="tree" aria-label="Imported models"><div aria-hidden="true" style={{height:start*rowHeight}} />{visible.map(({model,node,depth}) => {
      const branch = model.hierarchy && model.nodes.some(n => n.parent === node.id),locked=isLocked?.(node.id) || inherited(model,node,"locked");
      const select = (event: React.MouseEvent) => onRowSelect(node.id,event);
      return <div key={node.id} data-hierarchy-id={node.id} aria-description={ancestorIds?.has(node.id)?"Contains selected items":undefined} role="treeitem" aria-level={depth+1} aria-expanded={branch ? expanded.has(node.id) : undefined} aria-selected={selected.includes(node.id)} className={`hierarchy-row ${node.geometry ? "child" : "group"}${selected.includes(node.id) ? " selected" : ""}${ancestorIds?.has(node.id)?" contains-selection":""}${drop?.id===node.id?` drop-${drop.placement}`:""}`} style={{paddingLeft:node.geometry ? 16+depth*14 : depth*14}} onClick={select} draggable={!locked && editing?.id!==node.id}
        onDragStart={event=>{event.stopPropagation();event.dataTransfer.effectAllowed="move";event.dataTransfer.setData("text/plain",node.id);onDragStart?.(node.id);}}
        onDragEnd={()=>{setDrop(null);onDragEnd?.();}}
        onDragOver={event=>{if(!dragging||locked)return;event.preventDefault();event.stopPropagation();setDrop({id:node.id,placement:placement(event,!node.geometry)});const scroller=tree.current?.closest<HTMLElement>(".hierarchy-tree");if(scroller){const r=scroller.getBoundingClientRect();if(event.clientY<r.top+35)scroller.scrollTop-=24;else if(event.clientY>r.bottom-35)scroller.scrollTop+=24;}}}
        onDragLeave={()=>setDrop(null)} onDrop={event=>{event.preventDefault();event.stopPropagation();setDrop(null);if(!locked)onDropItem?.(node.id,placement(event,!node.geometry));}}>
        {branch ? <button className="hierarchy-disclosure" aria-label={`Expand ${node.name}`} title={`${expanded.has(node.id) ? "Collapse" : "Expand"} ${node.name}`} aria-expanded={expanded.has(node.id)} onClick={event => {event.stopPropagation();onToggle(node.id);}}><UiIcon name={expanded.has(node.id) ? "down" : "right"} /></button> : <button className="hierarchy-type" aria-label={`Select ${node.name}`} title={`Select ${node.name}`}><UiIcon name={node.geometry ? "slice" : "group"} /></button>}
        {editing?.id===node.id ? <span className="hierarchy-name hierarchy-group-name">{!node.geometry&&<UiIcon name="group"/>}<input autoFocus aria-label="Item name" value={editing.value} onClick={e=>e.stopPropagation()} onChange={e=>setEditing({id:node.id,value:e.target.value})} onBlur={commitName} onKeyDown={e=>{e.stopPropagation();if(e.key==="Enter"){e.preventDefault();commitName();}else if(e.key==="Escape"){e.preventDefault();editRef.current=null;setEditing(null);}}}/></span> : <button className={`hierarchy-name model-name${!node.geometry && branch ? " hierarchy-group-name" : ""}`} title={node.name} onDoubleClick={event=>{event.stopPropagation();if(!locked)setEditing({id:node.id,value:node.name});}}>{!node.geometry && branch && <UiIcon name="group" />}<span>{node.name}</span></button>}
        <button className="hierarchy-state-toggle" title={`${node.visible ? "Hide" : "Show"} ${node.name} in simulation`} aria-label={`Toggle visibility ${node.name}`} aria-pressed={!node.visible} onClick={event => {event.stopPropagation();onChange(models.map(m=>m.id===model.id?{...m,nodes:m.nodes.map(n=>n.id===node.id?{...n,visible:!n.visible}:n)}:m),"Change model visibility");}}><UiIcon name={node.visible ? "eye" : "hidden"} /></button>
        <button className="hierarchy-state-toggle" title={`${node.locked ? "Unlock" : "Lock"} ${node.name}`} aria-label={`Toggle lock ${node.name}`} aria-pressed={node.locked} onClick={event => {event.stopPropagation();onChange(models.map(m=>m.id===model.id?{...m,nodes:m.nodes.map(n=>n.id===node.id?{...n,locked:!n.locked}:n)}:m),"Change model lock");}}><UiIcon name={node.locked ? "lock" : "unlock"} /></button>
      </div>;
    })}<div aria-hidden="true" style={{height:Math.max(0,rows.length-start-visible.length)*rowHeight}} /></div></div>;

}
