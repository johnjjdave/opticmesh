"use client";
import {useEffect,useRef} from "react";
import manual from "../MANUAL.md?raw";
import UiIcon from "./ui-icon";
// The bundled Markdown is the maintained manual, available offline in both builds.
function ManualContent({text}:{text:string}) {
 const blocks=text.replace(/\r/g,"").split(/\n\s*\n/);
 const plain=(s:string)=>s.replace(/\*\*([^*]+)\*\*/g,"$1").replace(/`([^`]+)`/g,"$1");
 const slug=(s:string)=>plain(s).toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu,"").replace(/\s/g,"-");
 const inline=(s:string)=>s.split(/(\[[^\]]+\]\(#[^)]+\))/g).map((part,i)=>{
  const link=part.match(/^\[([^\]]+)\]\(#([^)]+)\)$/);
  return link ? <a key={i} href={`#manual-${link[2]}`} onClick={event=>{event.preventDefault();const heading=document.getElementById(`manual-${link[2]}`);heading?.scrollIntoView({block:"start"});heading?.focus({preventScroll:true});}}>{plain(link[1])}</a> : plain(part);
 });
 const used=new Map<string,number>();
 return <>{blocks.map((block,i)=>{
  if(/^---+$/.test(block))return <hr key={i}/>;
  if(/^#{1,3} /.test(block)){const title=plain(block.replace(/^#+ /,"")),base=slug(title),count=used.get(base)||0;used.set(base,count+1);return <h3 id={`manual-${base}${count?`-${count}`:""}`} tabIndex={-1} key={i}>{title}</h3>;}
  if(/^\d+\. /.test(block))return <ol key={i}>{block.split("\n").map((line,j)=><li key={j}>{inline(line.replace(/^\d+\. /,""))}</li>)}</ol>;
  if(block.startsWith("|")){const rows=block.split("\n").filter(l=>!/^\|[\s:|-]+\|$/.test(l)).map(l=>l.split("|").slice(1,-1).map(c=>plain(c.trim())));return <div className="manual-table" key={i}><table><thead><tr>{rows[0].map((c,j)=><th key={j}>{c}</th>)}</tr></thead><tbody>{rows.slice(1).map((r,k)=><tr key={k}>{r.map((c,j)=><td key={j}>{inline(c)}</td>)}</tr>)}</tbody></table></div>;}
  return <p key={i}>{inline(block)}</p>;
 })}</>;
}
export default function ManualDialog({topic,onClose}:{topic:"manual"|"shortcuts"|null;onClose:()=>void}) {
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{if(!topic)return;const el=dialog.current!;const previous=document.activeElement as HTMLElement|null;el.showModal();return ()=>{el.close();previous?.focus();};},[topic]);
 const text=topic==="shortcuts"?manual.slice(manual.indexOf("## 12."),manual.indexOf("## 14.")):manual;
 return <dialog ref={dialog} className="manual-dialog" aria-labelledby="manual-heading" onCancel={onClose} onClick={e=>{if(e.target===e.currentTarget){const r=e.currentTarget.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)onClose();}}}><header><h2 id="manual-heading">{topic==="shortcuts"?"Keyboard and mouse reference":"OpticMesh Manual"}</h2><button autoFocus type="button" onClick={onClose} aria-label="Close manual" title="Close manual"><UiIcon name="close"/></button></header><article tabIndex={0} aria-label="Manual content">{topic && <ManualContent text={text}/>}</article></dialog>;
}
