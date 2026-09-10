"use client";
import { useEffect, useId, useRef, useState } from "react";
import styles from "./v070/v070.module.css";
export type RecentProject = { name: string; path: string };
export default function RecentProjectsMenu({ load, onOpen }: { load: () => Promise<RecentProject[]>; onOpen: (path: string) => void }) {
  const [entries, setEntries] = useState<RecentProject[]>([]), [open, setOpen] = useState(false), [message, setMessage] = useState("Loading…");
  const root = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null), id = useId();
  useEffect(() => { let active = true; load().then(items => { if (active) { setEntries(items); setMessage("No recent projects"); } }).catch(() => { if (active) setMessage("Recent projects unavailable"); }); return () => { active = false; }; }, [load]);
  const enter = () => { setOpen(true); setTimeout(() => root.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus(), 0); };
  return <div ref={root} className={styles.recentProjects} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false); }} onKeyDown={event => {
    if (open && (event.key === "Escape" || event.key === "ArrowLeft")) { event.preventDefault(); event.stopPropagation(); setOpen(false); trigger.current?.focus(); }
    else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault(); const items = Array.from(root.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') || []);
      if (!open || event.target === trigger.current) enter();
      else { const index = items.indexOf(event.target as HTMLButtonElement); items[(index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus(); }
    }
  }}>
    <button ref={trigger} type="button" data-menu-keep-open aria-haspopup="menu" aria-expanded={open} aria-controls={id} onClick={() => setOpen(true)} onKeyDown={event => { if (event.key === "ArrowRight") { event.preventDefault(); enter(); } }}>Open Recent<span aria-hidden="true">›</span></button>
    {open && <div id={id} role="menu" aria-label="Recent projects" className={styles.recentSubmenu}>{entries.length ? entries.map(entry => <button role="menuitem" key={entry.path} title={entry.path} onClick={() => onOpen(entry.path)}><span>{entry.name}</span></button>) : <small>{message}</small>}</div>}
  </div>;
}
