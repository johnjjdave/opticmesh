"use client";
import ResetSlider from "./reset-slider";
import MaterialColorInput from "./material-color-input";
import { DEFAULT_MODEL_MATERIAL, nodeStyle, nodeMaterial, inherited, editModelMaterial, type ImportedModel, type ModelMaterial } from "./model-data";
import "./model-material-panel.css";
type Props={mixed?:boolean;defaults?:Readonly<ModelMaterial>;extrusion?:boolean;models:ImportedModel[];selected:string[];onChange:(models:ImportedModel[],label:string)=>void;onPreview:(models:ImportedModel[])=>void;onEditStart:()=>void};
export default function ModelMaterialPanel({models,selected,onChange,onPreview,onEditStart,defaults=DEFAULT_MODEL_MATERIAL,extrusion=false,mixed=false}:Props){
 const entries=models.flatMap(model=>model.nodes.filter(node=>selected.includes(node.id)).map(node=>({model,node,value:nodeMaterial(model,node)})));
 const disabled=!entries.some(({model,node})=>!inherited(model,node,"locked"));
 const common=<T,>(values:T[]):T|undefined=>values.length&&values.every(v=>v===values[0])?values[0]:undefined;
 const wireOnly=entries.length>0&&entries.every(({model,node})=>nodeStyle(model,node)==="wireframe");
 const style=common(entries.map(e=>e.node.style||"inherit"));
 const mode=common(entries.map(e=>e.node.material?"custom":"inherit"));
 const color=common(entries.map(e=>e.value.color));
 const edit=(patch:Partial<ModelMaterial>|null)=>onChange(editModelMaterial(models,selected,patch),"Change model material");
 const name=entries.length===1?entries[0].node.name:entries.length?`${entries.length} ${mixed?"scene items":extrusion?"extrusions":"model items"}`:extrusion?"No LED slices selected":"No model selected";
 return <div className="model-material-panel" aria-label="Model material controls">
  <div className="material-heading"><strong title={name}>{name}</strong><small>{!entries.length?"Select an imported model or LED slice to edit its material.":disabled?"Selected items are locked.":wireOnly?"Wireframe uses Diffuse colour and intensity. Metallic, roughness and specular apply to shaded surfaces only.":mixed?"Group materials flow to inheriting model surfaces and LED extrusions. LED display faces retain their content.":extrusion?"Extrusion only — LED display faces retain their content.":"Shading controls affect solid surfaces; wireframe draws triangle edges."}</small></div>
  <fieldset disabled={disabled}>
   <label><span>Display</span><select aria-label="Model display" value={style??"mixed"} onChange={e=>onChange(models.map(model=>({...model,nodes:model.nodes.map(node=>selected.includes(node.id)&&!inherited(model,node,"locked")?{...node,style:e.target.value==="inherit"?undefined:e.target.value as "shaded"|"wireframe"}:node)})),"Change model display")}><option value="mixed" disabled>Multiple values</option><option value="inherit">Inherit</option><option value="shaded">Shaded</option><option value="wireframe">Wireframe</option></select></label>
   <label><span>Material</span><select aria-label="Material inheritance" value={mode??"mixed"} onChange={e=>edit(e.target.value==="inherit"?null:{})}><option value="mixed" disabled>Multiple values</option><option value="inherit">Inherit</option><option value="custom">Custom</option></select></label>
   <label><span>Diffuse colour {entries.length>0&&!color&&<small>Multiple values</small>}</span><MaterialColorInput value={color||defaults.color} disabled={disabled} onEditStart={onEditStart} onValueChange={color=>onPreview(editModelMaterial(models,selected,{color}))}/></label>
   {([['diffuse','Diffuse intensity'],['metallic','Metallic'],['roughness','Roughness'],['specular','Specular']] as const).map(([key,label])=>{const value=common(entries.map(e=>e.value[key]));return <label key={key} className="material-slider"><span>{label}<output>{value===undefined&&entries.length?"Multiple values":`${Math.round((value??defaults[key])*100)}%`}</output></span><ResetSlider aria-label={label} aria-valuetext={value===undefined&&entries.length?"Multiple values":undefined} disabled={disabled||(wireOnly&&key!=="diffuse")} min={0} max={100} step={1} value={(value??defaults[key])*100} resetValue={defaults[key]*100} onEditStart={onEditStart} onValueChange={v=>onPreview(editModelMaterial(models,selected,{[key]:v/100}))}/></label>;})}
  </fieldset>
 </div>;
}
