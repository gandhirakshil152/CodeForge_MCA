import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Zap, ArrowRight, Lock, Mail, User } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import toast from "react-hot-toast";

const AUTH_STATUS_MESSAGES = [
  "Authenticating academic credentials...",
  "Verifying candidate profile...",
  "Connecting to evaluation server...",
  "Loading curriculum problem catalog...",
  "Synchronizing assessment records...",
  "Initializing code evaluation sandbox...",
  "Connecting to DBMS SQL engine...",
  "Loading batch progress...",
];

const FLOAT_ITEMS = ["</>", "{ }", "[ ]", "==>", "fn()", "var", "let", "=>", "class", "async", "await", "SQL"];

const AuthPage: React.FC<{ mode: "login" | "register" }> = ({ mode }) => {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusIdx, setStatusIdx] = useState(0);

  const floaters = FLOAT_ITEMS.map((txt, i) => ({
    txt, x: (i * 8.5 + 3) % 100, y: (i * 13 + 5) % 100,
    delay: i * 0.4, dur: 3.5 + (i % 4) * 0.8, size: 14 + (i % 3) * 6,
  }));

  useEffect(() => {
    if (!loading) return;
    const t = setInterval(() => setStatusIdx(p => (p + 1) % AUTH_STATUS_MESSAGES.length), 700);
    return () => clearInterval(t);
  }, [loading]);

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "register" && form.password !== form.confirm) { toast.error("Passwords do not match!"); return; }
    if (form.password.length < 6) { toast.error("Password must be at least 6 characters!"); return; }
    setLoading(true);
    try {
      if (mode === "login") {
        await login(form.email, form.password);
        toast.success("Authentication successful. Welcome!");
        navigate("/dashboard");
      } else {
        if (!form.name.trim()) { toast.error("Enter your name!"); setLoading(false); return; }
        await register(form.email, form.password, form.name.trim());
        toast.success("Account created successfully. Welcome to CodeForge MCA!");
        navigate("/dashboard");
      }
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      const msg =
        e.code === "auth/user-not-found"      ? "User not found!" :
        e.code === "auth/wrong-password"       ? "Wrong password!" :
        e.code === "auth/email-already-in-use" ? "Email already registered!" :
        e.code === "auth/invalid-email"        ? "Invalid email!" :
        e.message || "Something went wrong!";
      toast.error(msg);
    } finally { setLoading(false); }
  };

  const css = `
    @keyframes float-auth {
      from { transform: translateY(0) rotate(0deg) scale(1); opacity:0.07; }
      to   { transform: translateY(-26px) rotate(14deg) scale(1.1); opacity:0.15; }
    }
    @keyframes auth-bg { 0%,100%{opacity:1} 50%{opacity:0.7} }
    @keyframes logo-bounce {
      0%,100%{transform:translateY(0) rotate(0)} 25%{transform:translateY(-9px) rotate(-5deg)} 75%{transform:translateY(-4px) rotate(5deg)}
    }
    @keyframes wiggle {
      0%,100%{transform:rotate(0)} 20%{transform:rotate(-10deg)} 40%{transform:rotate(10deg)} 60%{transform:rotate(-5deg)} 80%{transform:rotate(5deg)}
    }
    @keyframes dot-bounce { from{transform:translateY(0)} to{transform:translateY(-7px)} }
  `;

  return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:"80px 24px 40px",position:"relative",overflow:"hidden"}}>
      <style>{css}</style>
      <div style={{position:"fixed",inset:0,background:"radial-gradient(ellipse at 30% 50%,rgba(139,92,246,0.12) 0%,transparent 50%),radial-gradient(ellipse at 70% 50%,rgba(34,211,238,0.09) 0%,transparent 50%)",pointerEvents:"none",animation:"auth-bg 4s ease-in-out infinite"}}/>
      <div style={{position:"fixed",inset:0,backgroundImage:"linear-gradient(rgba(139,92,246,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(139,92,246,0.04) 1px,transparent 1px)",backgroundSize:"60px 60px",pointerEvents:"none",zIndex:0}}/>
      {floaters.map((f,i) => (
        <div key={i} style={{position:"fixed",left:f.x+"%",top:f.y+"%",fontSize:f.size,fontFamily:"JetBrains Mono,monospace",fontWeight:800,color:"var(--purple-light)",pointerEvents:"none",animation:`float-auth ${f.dur}s ease-in-out ${f.delay}s infinite alternate`,userSelect:"none",zIndex:0,opacity:0.1}}>
          {f.txt}
        </div>
      ))}
      <div style={{width:"100%",maxWidth:440,position:"relative",zIndex:1}}>
        <div style={{textAlign:"center",marginBottom:36}}>
          <Link to="/" style={{textDecoration:"none",display:"inline-flex",flexDirection:"column",alignItems:"center",gap:8}}>
            <div className="navbar-logo" style={{width:64,height:64,fontSize:26,borderRadius:18,animation:"logo-bounce 2.5s ease-in-out infinite",boxShadow:"0 0 40px rgba(56,189,248,0.3)"}}>{"</>"}</div>
            <span className="font-display gradient-text" style={{fontSize:30,fontWeight:800}}>CodeForge MCA</span>
          </Link>
          <p style={{color:"var(--text-2)",marginTop:8,fontSize:15}}>{mode==="login"?"Candidate & Faculty Sign In":"Register MCA Candidate Profile"}</p>
          <div style={{marginTop:6,fontSize:11,color:"var(--text-3)",fontFamily:"JetBrains Mono,monospace",opacity:0.8}}>
            {mode==="login"?"// Academic Evaluation Portal":"// Technical Placement Preparation"}
          </div>
        </div>
        <div className="glass-card" style={{padding:36,position:"relative",overflow:"hidden",border:"1px solid rgba(56,189,248,0.25)"}}>
          <div style={{position:"absolute",inset:0,background:"linear-gradient(135deg,transparent 30%,rgba(56,189,248,0.03) 50%,transparent 70%)",pointerEvents:"none"}}/>
          <div className="tabs" style={{marginBottom:28}}>
            <Link to="/login" className={`tab ${mode==="login"?"active":""}`} style={{textDecoration:"none",textAlign:"center"}}>
              Sign In
            </Link>
            <Link to="/register" className={`tab ${mode==="register"?"active":""}`} style={{textDecoration:"none",textAlign:"center"}}>
              Create Account
            </Link>
          </div>
          <form onSubmit={handle} style={{display:"flex",flexDirection:"column",gap:20}}>
            {mode==="register" && (
              <div>
                <label>Full Name</label>
                <div style={{position:"relative"}}>
                  <User size={16} style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",color:"var(--text-3)"}}/>
                  <input className="input" style={{paddingLeft:40}} placeholder="Full Name" value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} required/>
                </div>
              </div>
            )}
            <div>
              <label>College Email Address</label>
              <div style={{position:"relative"}}>
                <Mail size={16} style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",color:"var(--text-3)"}}/>
                <input className="input" type="email" style={{paddingLeft:40}} placeholder="student@university.ac.in" value={form.email} onChange={e=>setForm(p=>({...p,email:e.target.value}))} required/>
              </div>
            </div>
            <div>
              <label>Password</label>
              <div style={{position:"relative"}}>
                <Lock size={16} style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",color:"var(--text-3)"}}/>
                <input className="input" type={showPw?"text":"password"} style={{paddingLeft:40,paddingRight:44}} placeholder="••••••••" value={form.password} onChange={e=>setForm(p=>({...p,password:e.target.value}))} required minLength={6}/>
                <button type="button" onClick={()=>setShowPw(p=>!p)} style={{position:"absolute",right:14,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:"var(--text-3)",cursor:"pointer"}}>
                  {showPw?<EyeOff size={16}/>:<Eye size={16}/>}
                </button>
              </div>
            </div>
            {mode==="register" && (
              <div>
                <label>Confirm Password</label>
                <div style={{position:"relative"}}>
                  <Lock size={16} style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",color:"var(--text-3)"}}/>
                  <input className="input" type={showPw?"text":"password"} style={{paddingLeft:40}} placeholder="••••••••" value={form.confirm} onChange={e=>setForm(p=>({...p,confirm:e.target.value}))} required/>
                </div>
              </div>
            )}
            <button className="btn btn-primary" type="submit" disabled={loading} style={{width:"100%",justifyContent:"center",padding:"13px",marginTop:4}}>
              {loading?(
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <div style={{display:"flex",gap:4}}>
                    {[0,1,2].map(i=><div key={i} style={{width:6,height:6,borderRadius:"50%",background:"rgba(255,255,255,0.85)",animation:`dot-bounce 0.6s ${i*0.15}s ease-in-out infinite alternate`}}/>)}
                  </div>
                  <span style={{fontSize:12}}>{AUTH_STATUS_MESSAGES[statusIdx]}</span>
                </div>
              ):mode==="login"?(
                <><Zap size={16}/> Sign In</>
              ):(
                <><ArrowRight size={16}/> Register Account</>
              )}
            </button>
          </form>
          {mode==="login" && <p style={{textAlign:"center",marginTop:20,color:"var(--text-3)",fontSize:13}}>New candidate? <Link to="/register" style={{color:"var(--cyan)",textDecoration:"none",fontWeight:600}}>Create student account</Link></p>}
          {mode==="register" && <p style={{textAlign:"center",marginTop:20,color:"var(--text-3)",fontSize:13}}>Already registered? <Link to="/login" style={{color:"var(--cyan)",textDecoration:"none",fontWeight:600}}>Sign In</Link></p>}
        </div>
        <p style={{textAlign:"center",marginTop:20,color:"var(--text-3)",fontSize:12}}>MCA Department Proctored Assessment &amp; Evaluation System</p>
      </div>
    </div>
  );
};

export default AuthPage;