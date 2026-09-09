import { DEFAULT_MODEL_MATERIAL, type ModelMaterial } from "./model-data.ts";
import type { TransformGroup } from "./group-transforms.ts";
export const DEFAULT_BODY_MATERIAL: Readonly<ModelMaterial>={...DEFAULT_MODEL_MATERIAL,color:"#252a2d",roughness:.78,metallic:.28};
export type BodyAppearance={material?:ModelMaterial;style?:"shaded"|"wireframe"};
export function resolveBodyAppearance(id:string,groups:TransformGroup[],values:Record<string,BodyAppearance>):Required<BodyAppearance>{
 let material=values[id]?.material,style=values[id]?.style;
 let parent=groups.find(g=>g.id===id)?.parentId || groups.find(g=>g.sliceIds.includes(id))?.id;
 const visited=new Set<string>();while(parent&&!visited.has(parent)){visited.add(parent);material??=values[parent]?.material;style??=values[parent]?.style;parent=groups.find(g=>g.id===parent)?.parentId||undefined;}
 return {material:material||DEFAULT_BODY_MATERIAL,style:style||"shaded"};
}
export function validateBodyAppearances(input:unknown):Record<string,BodyAppearance>{
 if(input==null)return {};if(typeof input!=="object"||Array.isArray(input))throw new Error("Invalid extrusion materials.");
 for(const value of Object.values(input)){if(!value||typeof value!=="object"||Array.isArray(value))throw new Error("Invalid extrusion material.");const {material:m,style}=value;if(style!==undefined&&!['shaded','wireframe'].includes(style))throw new Error("Invalid extrusion display.");if(m!==undefined&&(!m||typeof m.color!=="string"||!/^#[0-9a-f]{6}$/i.test(m.color)||![m.diffuse,m.metallic,m.roughness,m.specular].every(v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1)))throw new Error("Invalid extrusion material.");}
 return input as Record<string,BodyAppearance>;
}
