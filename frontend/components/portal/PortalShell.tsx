"use client";
import { Link } from "@/components/Link";
import { LogOut } from "lucide-react";

export function PortalShell({ children, role, onLogout }: { children: React.ReactNode; role: "candidate"|"admin"|"public"; onLogout?:()=>void }) {
  return <div className="portal-page"><header className="portal-nav"><div className="container"><Link className="brand" href="/"><img src="/aparaitech-logo.png" alt=""/><span>Aparaitech AI Interview<small>{role === "admin" ? "Administration workspace" : role === "candidate" ? "Candidate workspace" : "Secure access"}</small></span></Link><div className="nav-actions">{role === "public" ? <Link className="btn btn-ghost" href="/">Back to website</Link> : <>{role === "admin" && <Link className="btn btn-ghost" href="/admin">Dashboard</Link>}{role === "candidate" && <Link className="btn btn-ghost" href="/candidate">My profile</Link>}<button className="btn icon-btn" title="Sign out" aria-label="Sign out" onClick={onLogout}><LogOut size={16}/></button></>}</div></div></header><main className="portal-main">{children}</main></div>;
}

export function Notice({ children, kind="info" }: { children:React.ReactNode; kind?:"info"|"error"|"success" }) { return <div className={`notice ${kind === "info" ? "" : kind}`}>{children}</div>; }
export function Busy({ label="Loading secure workspace…" }: { label?:string }) { return <div className="auth-wrap"><div className="auth-card panel" style={{textAlign:"center"}}><div className="intro-core" style={{width:58,margin:"0 auto 28px"}}/><p className="panel-subtitle">{label}</p></div></div>; }
export function StatusPill({ value }: { value?:string|null }) { const v=value||"PENDING"; const type=/SELECTED|READY|COMPLETED|ACCEPT|SENT/.test(v)?"green":/REJECT|ERROR|FAILED|TERMINATED/.test(v)?"red":/PENDING|REVIEW|HOLD|IN_PROGRESS|UPLOADING/.test(v)?"amber":""; return <span className={`status-pill ${type}`}>{v.replaceAll("_"," ")}</span>; }
