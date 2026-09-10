"use client";
import {useEffect,useRef,useState,type CSSProperties,type ReactNode} from "react";
import manual from "./manual-content.md?raw";
import UiIcon from "./ui-icon";
import "./manual-dialog.css";

// One maintained offline source supplies both the guide and shortcut reference.
const plain=(s:string)=>s.replace(/\*\*([^*]+)\*\*/g,"$1").replace(/`([^`]+)`/g,"$1");
const slug=(s:string)=>plain(s).toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu,"").replace(/\s/g,"-");
const label=(s:string)=>s.replace(/^\d+(?:\.\d+)*\.?\s+/,"");
type Page={id:string;title:string;parent:string|null;text:string};
const pages:Page[]=[];
let current:Page|null=null,parent:string|null=null,inCode=false;
for(const line of manual.replace(/\r/g,"").split("\n")){
 if(line.startsWith("```"))inCode=!inCode;
 const heading=!inCode&&line.match(/^(#{2,3}) (.+)$/);
 if(heading){
  if(heading[2]==="Contents"){current=null;continue;}
  const id=slug(heading[2]);if(heading[1].length===2)parent=null;
  current={id,title:plain(heading[2]),parent,text:""};pages.push(current);
  if(heading[1].length===2)parent=id;
 }else if(current)current.text+=line+"\n";
}
const welcome:Page={id:"welcome",title:"Welcome to OpticMesh",parent:null,text:manual.slice(manual.indexOf("LO2S - OpticMesh is an LED"),manual.indexOf("## Contents")).trim()};
const allPages=[welcome,...pages],chapters=pages.filter(p=>!p.parent);
const shortcutPage=pages.find(p=>p.title.startsWith("12."))!;
const assetBase=(import.meta as ImportMeta & {env?:{BASE_URL?:string}}).env?.BASE_URL||"/";
const illustrations:Record<string,{src:string;alt:string;caption:string}>={
 "31-workspaces":{src:`${assetBase}manual/patterns.png`,alt:"Patterns workspace with tools on the left, the test pattern in the centre and wall settings on the right",caption:"Patterns: tools, canvas and settings share one workspace."},
 "73-pixel-pitch-and-physical-scale":{src:`${assetBase}manual/pixel-map.png`,alt:"Resolume Pixel Map workspace showing named slices and physical scale settings",caption:"Inspect the mapping and set the real pixel pitch before arranging the screens in 3D."},
 "91-hierarchy-objects":{src:`${assetBase}manual/hierarchy.png`,alt:"Scene hierarchy showing screen containers, LED slices and an expanded imported stage model with Platform and Screen parts",caption:"Screens, slices and imported model parts use the same hierarchy controls."},
 "stage-model-import-v080":{src:`${assetBase}manual/import-model.png`,alt:"Import 3D model dialog with a simple platform and screen, metre units, hierarchy toggle and dimension readouts",caption:"Check the model, units and dimensions before importing."},
 "led-extrusion-materials":{src:`${assetBase}manual/material.png`,alt:"Material controls including display, diffuse colour, diffuse intensity, metallic, roughness and specular",caption:"Material controls affect LED sides and backs while the display face keeps its source image."}
};
function Markdown({text,navigate}:{text:string;navigate:(id:string)=>void}){
 const inline=(text:string):ReactNode=>text.split(/(\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*|`[^`]+`)/g).map((part,i)=>{
  const link=part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
  if(link){const href=link[2];return <a key={i} href={href.startsWith("#")?`#manual-${href.slice(1)}`:href} onClick={href.startsWith("#")?e=>{e.preventDefault();navigate(href.slice(1));}:undefined} {...(!href.startsWith("#")?{target:"_blank",rel:"noreferrer"}:{})}>{link[1]}</a>;}
  if(part.startsWith("**"))return <strong key={i}>{part.slice(2,-2)}</strong>;
  if(part.startsWith("`"))return <code key={i}>{part.slice(1,-1)}</code>;
  return part;
 });
 const lines=text.trim().split("\n"),blocks:ReactNode[]=[];
 for(let i=0;i<lines.length;){const line=lines[i];if(!line.trim()||/^---+$/.test(line)){i++;continue;}
  if(line.startsWith("```")){const code:string[]=[];i++;while(i<lines.length&&!lines[i].startsWith("```"))code.push(lines[i++]);i++;blocks.push(<pre key={i}><code>{code.join("\n")}</code></pre>);continue;}
  if(line.startsWith("|")){const rows:string[][]=[];while(i<lines.length&&lines[i].startsWith("|")){if(!/^\|[\s:|-]+\|$/.test(lines[i]))rows.push(lines[i].split("|").slice(1,-1).map(s=>s.trim()));i++;}blocks.push(<div className="manual-table" key={i}><table><thead><tr>{rows[0].map((c,j)=><th key={j} scope="col">{inline(c)}</th>)}</tr></thead><tbody>{rows.slice(1).map((r,j)=><tr key={j}>{r.map((c,k)=><td key={k}>{inline(c)}</td>)}</tr>)}</tbody></table></div>);continue;}
  if(/^(?:- |\d+\. )/.test(line)){const ordered=/^\d/.test(line),items:string[]=[];while(i<lines.length&&/^(?:- |\d+\. )/.test(lines[i]))items.push(lines[i++].replace(/^(?:- |\d+\. )/,""));const Tag=ordered?"ol":"ul";blocks.push(<Tag key={i}>{items.map((s,j)=><li key={j}>{inline(s)}</li>)}</Tag>);continue;}
  const paragraph:string[]=[];while(i<lines.length&&lines[i].trim()&&!/^(?:```|\||#{1,4} |---+$|- |\d+\. )/.test(lines[i]))paragraph.push(lines[i++]);
  if(!paragraph.length){blocks.push(<h4 key={i}>{inline(lines[i++].replace(/^#+ /,""))}</h4>);}else blocks.push(<p key={i}>{inline(paragraph.join(" "))}</p>);
 }
 return <>{blocks}</>;
}
export default function ManualDialog({topic,onClose,version}:{topic:"manual"|"shortcuts"|null;onClose:()=>void;version:string}){
 const dialog=useRef<HTMLDialogElement>(null),article=useRef<HTMLElement>(null),imageDialog=useRef<HTMLDialogElement>(null);
 const [active,setActive]=useState("welcome"),[query,setQuery]=useState(""),[size,setSize]=useState(16),[expandedImage,setExpandedImage]=useState<{src:string;alt:string}|null>(null),[zoom,setZoom]=useState(100);
 const [previousTopic,setPreviousTopic]=useState(topic);
 if(previousTopic!==topic){setPreviousTopic(topic);setActive(topic==="shortcuts"?shortcutPage.id:"welcome");setQuery("");}
 const page=allPages.find(p=>p.id===active)||welcome,section=page.parent||page.id,children=pages.filter(p=>p.parent===page.id),illustration=illustrations[page.id];
 const navigate=(id:string)=>{if(allPages.some(p=>p.id===id)){setActive(id);setQuery("");if(id===active){article.current?.scrollTo(0,0);article.current?.querySelector<HTMLElement>("h3")?.focus({preventScroll:true});}}};
 useEffect(()=>{if(!topic)return;const el=dialog.current!,previous=document.activeElement as HTMLElement|null;el.showModal();return()=>{el.close();if(previous?.isConnected)previous.focus();};},[topic]);
 useEffect(()=>{if(!topic)return;dialog.current?.querySelector<HTMLElement>('.manual-sidebar [aria-current="page"]')?.scrollIntoView({block:"nearest"});article.current?.scrollTo(0,0);article.current?.querySelector<HTMLElement>("h3")?.focus({preventScroll:true});},[active,topic]);
 useEffect(()=>{if(!expandedImage)return;const el=imageDialog.current!,previous=document.activeElement as HTMLElement|null;el.showModal();return()=>{el.close();if(previous?.isConnected)previous.focus();};},[expandedImage]);
 const matches=query.trim()?allPages.filter(p=>`${p.title} ${p.text}`.toLowerCase().includes(query.trim().toLowerCase())):[];
 const navLink=(p:Page,child=false)=><a key={p.id} className={child?"manual-nav-child":undefined} href={`#manual-${p.id}`} aria-current={page.id===p.id?"page":undefined} onClick={e=>{e.preventDefault();navigate(p.id);}}>{label(p.title)}</a>;
 const index=allPages.indexOf(page);
 return <dialog ref={dialog} className="manual-dialog" aria-labelledby="manual-heading" onCancel={e=>{e.preventDefault();onClose();}}>
  <header><div><h2 id="manual-heading">OpticMesh Manual</h2><span>Version {version}</span></div><div className="manual-header-actions"><label>Text size<select aria-label="Manual text size" value={size} onChange={e=>setSize(Number(e.target.value))}>{[14,16,18,20].map(n=><option key={n} value={n}>{n} px</option>)}</select></label><button type="button" onClick={onClose} aria-label="Close manual" title="Close manual"><UiIcon name="close"/></button></div></header>
  <div className="manual-layout"><aside className="manual-sidebar"><label className="manual-search"><UiIcon name="search"/><input aria-label="Search manual" placeholder="Search the guide…" value={query} onChange={e=>setQuery(e.target.value)}/>{query&&<button aria-label="Clear manual search" onClick={()=>setQuery("")}><UiIcon name="close"/></button>}</label><nav aria-label="Manual sections">{query.trim()?<><p role="status">{matches.length} results</p>{matches.map(p=>navLink(p))}</>:<>{navLink(welcome)}{chapters.map(chapter=><div key={chapter.id}>{navLink(chapter)}{section===chapter.id&&pages.filter(p=>p.parent===chapter.id).map(p=>navLink(p,true))}</div>)}</>}</nav></aside>
  <article ref={article} tabIndex={0} aria-label="Manual content" style={{"--manual-size":`${size}px`} as CSSProperties}>
   <div className="manual-reading"><p className="manual-breadcrumb">{page.parent?label(pages.find(p=>p.id===page.parent)!.title):"User guide"}</p><h3 id={`manual-${page.id}`} tabIndex={-1}>{label(page.title)}</h3>
   {illustration&&<figure><button className="manual-figure" aria-label={`Enlarge: ${illustration.alt}`} onClick={()=>{setZoom(100);setExpandedImage(illustration);}}><img src={illustration.src} alt={illustration.alt}/><span><UiIcon name="fullscreen"/>Enlarge image</span></button><figcaption>{illustration.caption}</figcaption></figure>}
   <Markdown text={page.text} navigate={navigate}/>
   {(page.id==="welcome"||children.length>0)&&<nav className="manual-topic-links" aria-label="Topics in this section">{(page.id==="welcome"?chapters:children).map(p=><a key={p.id} href={`#manual-${p.id}`} onClick={e=>{e.preventDefault();navigate(p.id);}}>{label(p.title)}<UiIcon name="right"/></a>)}</nav>}
   <footer className="manual-page-links">{index>0&&<a href={`#manual-${allPages[index-1].id}`} onClick={e=>{e.preventDefault();navigate(allPages[index-1].id);}}><small>Previous</small>{label(allPages[index-1].title)}</a>}{index<allPages.length-1&&<a href={`#manual-${allPages[index+1].id}`} onClick={e=>{e.preventDefault();navigate(allPages[index+1].id);}}><small>Next</small>{label(allPages[index+1].title)}</a>}</footer>
   </div>
  </article></div>
  <dialog ref={imageDialog} className="manual-image-dialog" aria-label="Manual illustration" onCancel={e=>{e.preventDefault();e.stopPropagation();setExpandedImage(null);}}><header><span>Illustration</span><label>Zoom<select aria-label="Illustration zoom" value={zoom} onChange={e=>setZoom(Number(e.target.value))}>{[100,150,200].map(n=><option key={n} value={n}>{n===100?"Fit":`${n}%`}</option>)}</select></label><button aria-label="Close illustration" onClick={()=>setExpandedImage(null)}><UiIcon name="close"/></button></header><div>{expandedImage&&<img style={{width:`${zoom}%`}} src={expandedImage.src} alt={expandedImage.alt}/>}</div></dialog>
 </dialog>;
}
