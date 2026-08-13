"use client";
import { FormEvent, useState } from "react";
import { KeyRound } from "lucide-react";
import { api } from "@/lib/api";
import { session } from "@/lib/session";
import { Notice, PortalShell } from "@/components/portal/PortalShell";

export default function CandidateLogin() { const [code,setCode]=useState(""); const [error,setError]=useState(""); const [loading,setLoading]=useState(false);
  async function submit(event:FormEvent){event.preventDefault();setLoading(true);setError("");try{const result=await api.verifyInvitation(code.trim());session.setCandidate(result.tokens);window.location.replace("/candidate");}catch(reason:any){setError(reason.message||"Unable to verify this code.");}finally{setLoading(false)}}
  return <PortalShell role="public"><div className="auth-wrap"><form className="auth-card panel" onSubmit={submit}><KeyRound size={28} color="#64cfff"/><h1>Candidate access</h1><p className="panel-subtitle">Enter the private invitation code from your Aparaitech interview email.</p><div className="field"><label>Invitation code</label><input value={code} onChange={e=>setCode(e.target.value.toUpperCase())} minLength={6} maxLength={24} autoComplete="one-time-code" placeholder="APARAI-XXXXXX" required/></div>{error&&<Notice kind="error">{error}</Notice>}<button className="btn btn-primary" disabled={loading}>{loading?"Verifying secure access…":"Continue to my profile"}</button><p className="panel-subtitle">Your code is private. Never share it with another candidate.</p></form></div></PortalShell> }
