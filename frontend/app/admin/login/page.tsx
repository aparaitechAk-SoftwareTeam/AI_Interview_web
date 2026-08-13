"use client";
import { FormEvent, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { session } from "@/lib/session";
import { Notice, PortalShell } from "@/components/portal/PortalShell";

export default function AdminLogin(){const [username,setUsername]=useState("");const [password,setPassword]=useState("");const [error,setError]=useState("");const [loading,setLoading]=useState(false);async function submit(event:FormEvent){event.preventDefault();setLoading(true);setError("");try{const result=await api.adminLogin(username,password);session.setAdmin(result.token);window.location.replace("/admin");}catch(reason:any){setError(reason.message||"Login failed.");}finally{setLoading(false)}}return <PortalShell role="public"><div className="auth-wrap"><form className="auth-card panel" onSubmit={submit}><ShieldCheck size={29} color="#8f78ff"/><h1>Admin workspace</h1><p className="panel-subtitle">Authorized Aparaitech hiring administrators only.</p><div className="field"><label>Username</label><input value={username} onChange={e=>setUsername(e.target.value)} autoComplete="username" required/></div><div className="field"><label>Password</label><input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" required/></div>{error&&<Notice kind="error">{error}</Notice>}<button className="btn btn-primary" disabled={loading}>{loading?"Signing in…":"Sign in securely"}</button></form></div></PortalShell>}
