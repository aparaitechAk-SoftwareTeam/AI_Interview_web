"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@/components/Link";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import "./reference-home.css";

function Intro({ onDone }: { onDone: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  const skip = () => { if (root.current) root.current.style.display = "none"; onDone(); };
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || sessionStorage.getItem("aparaitech-intro")) { onDone(); return; }
    document.body.style.overflow = "hidden";
    const mobile = window.innerWidth < 760;
    const timeline = gsap.timeline({ onComplete: onDone });
    timeline.fromTo(".intro-core", { scale:0, opacity:0 }, { scale:1, opacity:1, duration:.9, ease:"expo.out" })
      .fromTo(".intro-copy > *", { y:18, opacity:0 }, { y:0, opacity:1, stagger:.16, duration:.65 }, "-=.3")
      .to(".intro-core", { scale:mobile?5:8, opacity:.1, duration:mobile?1.6:2.3, ease:"expo.inOut" }, mobile?"+=.9":"+=1.8")
      .to(root.current, { opacity:0, duration:.7, pointerEvents:"none" }, "-=.55");
    return () => { timeline.kill(); document.body.style.overflow = ""; };
  }, [onDone]);
  return <div className="intro" ref={root}><div className="intro-grid"/><button className="intro-skip" onClick={skip}>Skip intro</button><div className="intro-core"/><div className="intro-copy"><strong>Intelligence, assembled.</strong><span>Preparing the future of hiring</span></div></div>;
}

type Particle = { x:number; y:number; r:number; vx:number; vy:number; a:number };
const bars = Array.from({ length: 28 }, (_, index) => 2 + (index % 8));

function Brand() {
  return <><span className="brand-mark" aria-hidden="true"><span/><span/><span/></span><span>Aparaitech <strong>AI Interview</strong></span></>;
}

function MetricCard({ className, label, value, note }: { className:string; label:string; value:string; note:string }) {
  return <div className={`metric-card ${className}`}><div><span>{label}</span><strong>{value}</strong></div><small>{note}</small><div className="bar"><i style={{ "--w": value } as React.CSSProperties}/></div></div>;
}

export function LandingPage() {
  const [intro,setIntro]=useState(true);
  const [scrolled,setScrolled]=useState(false);
  const [menu,setMenu]=useState(false);
  const root=useRef<HTMLDivElement>(null);
  const canvasRef=useRef<HTMLCanvasElement>(null);
  const glowRef=useRef<HTMLDivElement>(null);
  const tiltRef=useRef<HTMLDivElement>(null);
  const completeIntro=useCallback(()=>{ sessionStorage.setItem("aparaitech-intro","1"); document.body.style.overflow=""; setIntro(false); },[]);

  useEffect(()=>{
    gsap.registerPlugin(ScrollTrigger);
    const reduced=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const finePointer=window.matchMedia("(pointer:fine)").matches;
    const onScroll=()=>setScrolled(window.scrollY>20);
    const onMove=(event:MouseEvent)=>{ if(glowRef.current){ glowRef.current.style.opacity=".9"; glowRef.current.style.left=`${event.clientX}px`; glowRef.current.style.top=`${event.clientY}px`; } };
    const onTilt=(event:MouseEvent)=>{ const target=tiltRef.current; if(!target)return; const bounds=target.getBoundingClientRect(); const x=(event.clientX-bounds.left)/bounds.width-.5; const y=(event.clientY-bounds.top)/bounds.height-.5; target.style.transform=`perspective(1100px) rotateX(${-y*3}deg) rotateY(${x*4}deg)`; };
    const resetTilt=()=>{ if(tiltRef.current)tiltRef.current.style.transform="perspective(1100px) rotateX(0) rotateY(0)"; };
    window.addEventListener("scroll",onScroll,{passive:true}); onScroll();
    if(finePointer){ window.addEventListener("mousemove",onMove,{passive:true}); tiltRef.current?.addEventListener("mousemove",onTilt); tiltRef.current?.addEventListener("mouseleave",resetTilt); }
    const context=gsap.context(()=>{
      if(reduced)return;
      gsap.utils.toArray<HTMLElement>(".reveal-section").forEach(section=>gsap.from(section,{opacity:0,y:55,duration:1,scrollTrigger:{trigger:section,start:"top 82%",once:true}}));
      gsap.to(".timeline-line span",{height:"100%",ease:"none",scrollTrigger:{trigger:".timeline",start:"top 72%",end:"bottom 65%",scrub:1}});
      gsap.utils.toArray<HTMLElement>(".step").forEach((element,index)=>gsap.from(element,{x:-25,opacity:0,duration:.65,delay:index*.04,scrollTrigger:{trigger:element,start:"top 86%",once:true}}));
    },root);

    const canvas=canvasRef.current; const context2d=canvas?.getContext("2d"); let particles:Particle[]=[]; let frame=0;
    const resize=()=>{ if(!canvas||!context2d)return; const width=window.innerWidth; const height=window.innerHeight; const ratio=Math.min(window.devicePixelRatio||1,2); canvas.width=width*ratio; canvas.height=height*ratio; canvas.style.width=`${width}px`; canvas.style.height=`${height}px`; context2d.setTransform(ratio,0,0,ratio,0,0); const count=width<700?24:58; particles=Array.from({length:count},()=>({x:Math.random()*width,y:Math.random()*height,r:Math.random()*1.2+.2,vx:(Math.random()-.5)*.08,vy:(Math.random()-.5)*.1,a:Math.random()*.45+.08})); };
    const draw=()=>{ if(!context2d)return; const width=window.innerWidth; const height=window.innerHeight; context2d.clearRect(0,0,width,height); for(const particle of particles){ particle.x+=particle.vx; particle.y+=particle.vy; if(particle.x<0)particle.x=width; if(particle.x>width)particle.x=0; if(particle.y<0)particle.y=height; if(particle.y>height)particle.y=0; context2d.beginPath(); context2d.arc(particle.x,particle.y,particle.r,0,Math.PI*2); context2d.fillStyle=`rgba(82,165,255,${particle.a})`; context2d.fill(); } frame=requestAnimationFrame(draw); };
    resize(); if(!reduced)draw(); window.addEventListener("resize",resize,{passive:true});
    return()=>{ window.removeEventListener("scroll",onScroll); window.removeEventListener("mousemove",onMove); window.removeEventListener("resize",resize); tiltRef.current?.removeEventListener("mousemove",onTilt); tiltRef.current?.removeEventListener("mouseleave",resetTilt); cancelAnimationFrame(frame); context.revert(); };
  },[]);

  return <div className="reference-home site-shell" ref={root}>{intro&&<Intro onDone={completeIntro}/>}<div className="noise" aria-hidden="true"/><div className="reference-cursor-glow" ref={glowRef} aria-hidden="true"/><canvas className="reference-particles" ref={canvasRef} aria-hidden="true"/>
    <header className={`nav-shell ${scrolled?"scrolled":""}`}><nav className={`nav container ${menu?"open":""}`}><a className="brand" href="#top" aria-label="Aparaitech AI Interview home"><Brand/></a><button className="menu-toggle" aria-label="Open navigation" aria-expanded={menu} onClick={()=>setMenu(!menu)}><span/><span/></button><div className="nav-links" onClick={()=>setMenu(false)}><a href="#features">Features</a><a href="#how">How It Works</a><a href="#use-cases">Use Cases</a><a href="#resources">Resources</a></div><div className="nav-actions"><Link className="btn btn-ghost" href="/login">Login</Link><Link className="btn btn-primary small" href="/candidate/login">Get Started <span>↗</span></Link></div></nav></header>

    <main id="top"><section className="hero section-pad"><div className="hero-grid container"><div className="hero-copy"><div className="eyebrow"><span className="eyebrow-dot"/>THE FUTURE OF INTERVIEWS IS HERE</div><h1 className="hero-title"><span className="headline-line">AI Interviews.</span><span className="headline-line gradient-text">Smarter Hiring.</span><span className="headline-line">Better Future.</span></h1><p className="hero-description">A premium AI interview platform that understands resumes, asks adaptive questions, listens to answers, evaluates confidence and technical skill, and generates a complete candidate report in real time.</p><div className="hero-actions"><Link className="btn btn-primary" href="/candidate/login">Start Free Interview <span>→</span></Link><Link className="btn btn-glass" href="/admin/login">Book a Demo <span>↗</span></Link></div><div className="hero-note">No credit card required <span>•</span> Invitation-based candidate access</div></div>
      <div className="hero-visual"><div className="avatar-aura"/><div className="avatar-stage"><div className="avatar-scan"/><div className="avatar-gridface"/><div className="avatar-head"><div className="face-core"><div className="brow brow-left"/><div className="brow brow-right"/><div className="eye eye-left"/><div className="eye eye-right"/><div className="nose-line"/><div className="mouth-line"/><div className="jaw jaw-left"/><div className="jaw jaw-right"/></div><div className="headphone left-ear"/><div className="headphone right-ear"/><div className="circuit c1"/><div className="circuit c2"/><div className="circuit c3"/></div><div className="energy-ring ring-outer"/><div className="energy-ring ring-inner"/><div className="ring-ticks"/></div><MetricCard className="m1" label="Response Analysis" value="98%" note="Confidence Score"/><MetricCard className="m2" label="Communication" value="92%" note="Live Voice Score"/><MetricCard className="m3" label="Technical Skills" value="93%" note="Answer Accuracy"/><MetricCard className="m4" label="Problem Solving" value="95%" note="Reasoning Strength"/></div></div>
      <div className="stats container"><div className="stat"><b>10,000+</b><span>Interviews Conducted</span></div><div className="stat"><b>500+</b><span>Companies Trust Us</span></div><div className="stat"><b>90%</b><span>Time Saved</span></div><div className="stat"><b>4.9/5</b><span>User Rating</span></div></div></section>

      <section id="showcase" className="showcase section-pad reveal-section"><div className="container showcase-grid"><div className="section-copy"><div className="eyebrow">AI POWERED PLATFORM</div><h2>Interviews that <span className="gradient-text">understand more.</span></h2><p>Aparaitech AI evaluates more than answers. It analyzes communication, confidence, technical understanding, problem-solving ability, and overall interview performance.</p><div className="feature-list"><span>✦ Real-time AI Questioning</span><span>✦ In-depth Candidate Evaluation</span><span>✦ Intelligent Follow-up Questions</span><span>✦ Resume-Based Interviews</span><span>✦ Communication Analysis</span><span>✦ Detailed Reports & Insights</span></div><a className="btn btn-primary" href="#features">Explore Features <span>→</span></a></div>
        <div className="dashboard-card tilt-card" ref={tiltRef}><div className="dash-sidebar"><div className="dash-logo">A<span>I</span></div><button className="active" type="button">◈ Dashboard</button><button type="button">◫ Interviews</button><button type="button">◉ Candidates</button><button type="button">⌁ Analytics</button><button type="button">▤ Reports</button><button type="button">⚙ Settings</button></div><div className="dash-main"><div className="dash-head"><div><small>LIVE INTERVIEW</small><h3>Frontend Developer Interview</h3></div><div className="timer">12:45</div><button type="button" disabled>End Interview</button></div><div className="dash-grid"><div className="question-panel glass-panel"><div className="question-top"><span>QUESTION 04</span><em>Medium</em></div><h4>Explain the concept of Virtual DOM in React.</h4><div className="waveform" aria-hidden="true">{bars.map((height,index)=><i key={index} style={{"--d":height} as React.CSSProperties}/>)}</div><div className="listening"><span/>Listening...</div><div className="transcript"><small>LIVE TRANSCRIPT</small><p>“The Virtual DOM is an in-memory representation of the UI. React compares changes efficiently before updating the real DOM...”</p></div></div><div className="analysis-panel glass-panel"><div className="panel-title">Live Analysis <span>● ACTIVE</span></div>{[["Communication",92],["Technical Skills",93],["Problem Solving",90],["Confidence",91]].map(([label,value])=><div className="metric-row" key={label}><span>{label}</span><b>{value}%</b><i style={{"--w":`${value}%`} as React.CSSProperties}/></div>)}<div className="score-ring"><div><strong>92%</strong><span>Excellent</span></div></div></div></div></div></div></div></section>

      <section className="trusted reveal-section"><div className="container"><div className="center-label">TRUSTED BY INNOVATIVE COMPANIES</div><div className="brand-row"><span>Google</span><span>Microsoft</span><span>Amazon</span><span>Airbnb</span><span>Netflix</span><span>Spotify</span></div></div></section>
      <section id="features" className="features section-pad reveal-section"><div className="container"><div className="section-heading"><div className="eyebrow">WHY CHOOSE APARAITECH</div><h2>Built for <span className="gradient-text">intelligent hiring.</span></h2></div><div className="cards-grid"><article className="feature-card"><div className="icon-box">✦</div><h3>AI-Powered</h3><p>Advanced AI analyzes candidate responses intelligently and consistently.</p></article><article className="feature-card"><div className="icon-box">⌁</div><h3>Scalable</h3><p>Conduct hundreds of interviews without sacrificing evaluation quality.</p></article><article className="feature-card"><div className="icon-box">◇</div><h3>Secure</h3><p>Enterprise-grade architecture designed to protect candidate data.</p></article><article className="feature-card"><div className="icon-box">◈</div><h3>Insightful</h3><p>Transform interview responses into clear hiring insights and reports.</p></article></div></div></section>
      <section id="how" className="how section-pad reveal-section"><div className="container"><div className="section-heading"><div className="eyebrow">HOW IT WORKS</div><h2>From candidate to <span className="gradient-text">decision.</span></h2></div><div className="timeline"><div className="timeline-line"><span/></div>{[["01","Candidate Joins Interview","Secure invitation-based access starts the interview session."],["02","AI Reads Resume","Skills, projects, technologies and experience are extracted automatically."],["03","AI Conducts Interview","Adaptive technical, HR and follow-up questions are generated in real time."],["04","AI Evaluates Responses","Communication, confidence, accuracy and reasoning are continuously scored."],["05","Detailed Report Generated","Recruiters receive a clear scorecard, strengths, risks and final recommendation."]].map(([number,title,copy])=><div className="step" key={number}><b>{number}</b><div><h3>{title}</h3><p>{copy}</p></div></div>)}</div></div></section>
      <section id="use-cases" className="capabilities section-pad reveal-section"><div className="container"><div className="section-heading"><div className="eyebrow">AI CAPABILITIES</div><h2>Everything needed for a <span className="gradient-text">smarter interview.</span></h2></div><div className="cap-grid">{["Resume Intelligence","Adaptive Question Generation","Speech Recognition","Technical Evaluation","HR Evaluation","Confidence Analysis","Anti-Cheating Monitoring","Interview Recording","Final AI Report"].map(item=><div key={item}>{item}</div>)}</div></div></section>
      <section id="final-cta" className="final-cta section-pad reveal-section"><div className="cta-orb"/><div className="container final-box"><div className="eyebrow">READY WHEN YOU ARE</div><h2>Ready to experience the <span className="gradient-text">future of interviews?</span></h2><p>Start your AI-powered interview experience today.</p><div className="hero-actions"><Link className="btn btn-primary" href="/candidate/login">Start Interview <span>→</span></Link><Link className="btn btn-glass" href="/admin/login">Administrator Access <span>↗</span></Link></div></div></section>
    </main>

    <footer id="resources" className="footer"><div className="container footer-grid"><div><a className="brand" href="#top"><Brand/></a><p>AI-powered interview intelligence for modern hiring teams, students and institutions.</p></div><div><h4>Platform</h4><a href="#features">Features</a><a href="#how">How It Works</a><a href="#showcase">Dashboard</a></div><div><h4>Access</h4><Link href="/candidate/login">Candidate Login</Link><Link href="/admin/login">Admin Login</Link><Link href="/login">Choose Role</Link></div><div><h4>Capabilities</h4><a href="#use-cases">Resume Intelligence</a><a href="#use-cases">AI Evaluation</a><a href="#use-cases">Recording</a></div><div><h4>Standards</h4><a href="#features">Private by Design</a><a href="#features">Evidence Based</a><a href="#features">Candidate First</a></div></div><div className="container footer-bottom"><span>© {new Date().getFullYear()} Aparaitech AI Interview. All rights reserved.</span><span>AI Interviews · Smarter Hiring · Better Future</span></div></footer>
  </div>;
}
