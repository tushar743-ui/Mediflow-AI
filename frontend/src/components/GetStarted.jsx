import { useEffect, useRef, useState } from "react";
import { useNavigate } from 'react-router-dom';
import { useClerk, UserButton , useUser} from '@clerk/clerk-react'
const BLUE = "#2563eb";

/* ── tiny hook: detect element in viewport ── */
function useInView(threshold = 0.15) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return [ref, visible];
}

/* ── animated counter ── */
function Counter({ target, suffix = "" }) {
  const [val, setVal] = useState(0);
  const [ref, visible] = useInView();
  useEffect(() => {
    if (!visible) return;
    let start = 0;
    const step = Math.ceil(target / 60);
    const id = setInterval(() => {
      start += step;
      if (start >= target) { setVal(target); clearInterval(id); }
      else setVal(start);
    }, 16);
    return () => clearInterval(id);
  }, [visible, target]);
  return <span ref={ref}>{val.toLocaleString()}{suffix}</span>;
}

/* ── capability card ── */
function CapCard({ icon, title, desc, delay }) {
  const [ref, visible] = useInView();
  return (
    <div
      ref={ref}
      style={{
        ...styles.capCard,
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(40px)",
        transition: `opacity 0.7s ease ${delay}s, transform 0.7s ease ${delay}s`,
      }}
    >
      <div style={styles.capIcon}>{icon}</div>
      <h3 style={styles.capTitle}>{title}</h3>
      <p style={styles.capDesc}>{desc}</p>
    </div>
  );
}

/* ── step item ── */
function Step({ num, title, desc, delay }) {
  const [ref, visible] = useInView();
  return (
    <div
      ref={ref}
      style={{
        ...styles.step,
        opacity: visible ? 1 : 0,
        transform: visible ? "translateX(0)" : "translateX(-40px)",
        transition: `opacity 0.7s ease ${delay}s, transform 0.7s ease ${delay}s`,
      }}
    >
      <div style={styles.stepNum}>{num}</div>
      <div>
        <h4 style={styles.stepTitle}>{title}</h4>
        <p style={styles.stepDesc}>{desc}</p>
      </div>
    </div>
  );
}

/* ── main component ── */
export default function GetStarted() {
  const navigate = useNavigate();
  const {openSignIn} = useClerk()
  const {signOut}=useClerk()
  const {issignedin}= useUser();

  const goToApp = (e) => {
    e.preventDefault();
    navigate('/app');
  };

  const [scrollY, setScrollY] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [typedText, setTypedText] = useState("");
  const [heroVisible, setHeroVisible] = useState(false);
  const phrases = [
    "Refill my blood pressure medication…",
    "Check if ibuprofen interacts with warfarin…",
    "Order insulin before I run out next week…",
    "Find alternatives to this out-of-stock drug…",
  ];
  const phraseIdx = useRef(0);
  const charIdx = useRef(0);
  const deleting = useRef(false);
  const timerRef = useRef(null);

  /* scroll parallax */
  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* hero entrance */
  useEffect(() => {
    const t = setTimeout(() => setHeroVisible(true), 100);
    return () => clearTimeout(t);
  }, []);

  /* typewriter */
  useEffect(() => {
    const tick = () => {
      const phrase = phrases[phraseIdx.current];
      if (!deleting.current) {
        charIdx.current++;
        setTypedText(phrase.slice(0, charIdx.current));
        if (charIdx.current === phrase.length) {
          deleting.current = true;
          timerRef.current = setTimeout(tick, 1800);
          return;
        }
      } else {
        charIdx.current--;
        setTypedText(phrase.slice(0, charIdx.current));
        if (charIdx.current === 0) {
          deleting.current = false;
          phraseIdx.current = (phraseIdx.current + 1) % phrases.length;
        }
      }
      timerRef.current = setTimeout(tick, deleting.current ? 40 : 70);
    };
    timerRef.current = setTimeout(tick, 600);
    return () => clearTimeout(timerRef.current);
  }, []);

  const [statRef, statVisible] = useInView();

  return (
    <div style={styles.root}>
      <style>{globalCSS}</style>

      {/* ── NAV ── */}
      <nav style={styles.nav}>
        <a href="/" style={styles.logo}>
          <span style={styles.logoMark}>M</span>
          <span style={styles.logoText}>MediFlow<span style={{ color: BLUE }}>AI</span></span>
        </a>
        <div style={styles.navLinks} className="nav-links">
          {["Features", "How It Works", "Safety"].map((l) => (
            <a key={l} href={`#${l.toLowerCase().replace(/ /g, "-")}`} style={styles.navLink}>{l}</a>
          ))}
        </div>
        <div style={styles.navCTA}>
          <a onClick={() =>issignedin? navigate('/app'): openSignIn({forceRedirectUrl: "/app", })}style={styles.btnOutline}>Sign In</a>
          <a onClick={()=> issignedin? navigate('/app'):  signOut({forceRedirectUrl: "/app", })} style={styles.btnPrimary}>Get Started Free</a>
        </div>
        <button onClick={() => setMenuOpen(!menuOpen)} style={styles.burger}>☰</button>
      </nav>

      {menuOpen && (
        <div style={styles.mobileMenu}>
          {["Features", "How It Works", "Safety"].map((l) => (
            <a key={l} href={`#${l.toLowerCase().replace(/ /g, "-")}`} style={styles.mobileLink} onClick={() => setMenuOpen(false)}>{l}</a>
          ))}
          <a onClick={() =>issignedin? navigate('/app'): openSignIn({forceRedirectUrl: "/app", })} style={{ ...styles.btnPrimary, marginTop: 12 }}>Get Started Free</a>
        </div>
      )}

      {/* ── HERO ── */}
      <section style={styles.hero}>
        {/* animated grid background */}
        <div style={styles.gridBg} />
        {/* glowing orbs */}
        <div style={{ ...styles.orb, ...styles.orb1, transform: `translateY(${scrollY * 0.15}px)` }} />
        <div style={{ ...styles.orb, ...styles.orb2, transform: `translateY(${scrollY * 0.08}px)` }} />

        <div style={styles.heroInner}>
          <div
            style={{
              ...styles.badge,
              opacity: heroVisible ? 1 : 0,
              transform: heroVisible ? "translateY(0)" : "translateY(20px)",
              transition: "opacity 0.8s ease 0.1s, transform 0.8s ease 0.1s",
            }}
          >
            <span style={styles.badgeDot} />
            Agentic AI · Pharmacy Intelligence
          </div>

          <h1
            style={{
              ...styles.heroH1,
              opacity: heroVisible ? 1 : 0,
              transform: heroVisible ? "translateY(0)" : "translateY(30px)",
              transition: "opacity 0.9s ease 0.3s, transform 0.9s ease 0.3s",
            }}
          >
            The Pharmacy That
            <br />
            <span style={styles.heroAccent}>Thinks for Itself.</span>
          </h1>

          <p
            style={{
              ...styles.heroSub,
              opacity: heroVisible ? 1 : 0,
              transform: heroVisible ? "translateY(0)" : "translateY(20px)",
              transition: "opacity 0.9s ease 0.5s, transform 0.9s ease 0.5s",
            }}
          >
            MediFlow AI transforms your pharmacy into an autonomous ecosystem—
            predicting refills, enforcing safety rules, and managing inventory
            with zero manual effort.
          </p>

          {/* typewriter chat box */}
          <div
            style={{
              ...styles.chatBox,
              opacity: heroVisible ? 1 : 0,
              transform: heroVisible ? "translateY(0)" : "translateY(20px)",
              transition: "opacity 0.9s ease 0.7s, transform 0.9s ease 0.7s",
            }}
          >
            <span style={styles.chatPrompt}>You</span>
            <span style={styles.chatText}>
              "{typedText}<span style={styles.cursor}>|</span>"
            </span>
            <span style={styles.chatAI}>MediFlow AI is processing…</span>
          </div>

          <div
            style={{
              ...styles.heroCTAs,
              opacity: heroVisible ? 1 : 0,
              transform: heroVisible ? "translateY(0)" : "translateY(20px)",
              transition: "opacity 0.9s ease 0.9s, transform 0.9s ease 0.9s",
            }}
          >
            <a onClick={() =>issignedin? navigate('/app'): openSignIn({forceRedirectUrl: "/app", })} style={styles.btnHeroPrimary}>Start Free Trial →</a>
            <a href="#how-it-works" style={styles.btnHeroSecondary}>
              <span style={styles.playBtn}>▶</span> Watch Demo
            </a>
          </div>

          <div
            style={{
              ...styles.trustedBy,
              opacity: heroVisible ? 1 : 0,
              transition: "opacity 1s ease 1.2s",
            }}
          >
            Trusted by <strong>500+</strong> pharmacies · <strong>2M+</strong> prescriptions processed
          </div>
        </div>

        {/* floating dashboard mockup */}
        <div
          style={{
            ...styles.mockupWrap,
            opacity: heroVisible ? 1 : 0,
            transform: heroVisible
              ? `translateY(${scrollY * 0.05}px)`
              : `translateY(60px)`,
            transition: "opacity 1s ease 0.6s, transform 0.6s ease",
          }}
        >
          <div style={styles.mockup}>
            <div style={styles.mockupBar}>
              <span style={styles.dot} />
              <span style={{ ...styles.dot, background: "#fbbf24" }} />
              <span style={{ ...styles.dot, background: "#22c55e" }} />
              <span style={styles.mockupTitle}>MediFlow Dashboard</span>
            </div>
            <div style={styles.mockupBody}>
              {[
                { label: "Auto-Refills Today", value: "142", trend: "+12%", color: "#22c55e" },
                { label: "Low Stock Alerts", value: "3", trend: "Auto-order queued", color: BLUE },
                { label: "Safety Flags", value: "0", trend: "All clear", color: "#10b981" },
              ].map((m) => (
                <div key={m.label} style={styles.mockupCard}>
                  <span style={styles.mockupLabel}>{m.label}</span>
                  <span style={styles.mockupValue}>{m.value}</span>
                  <span style={{ ...styles.mockupTrend, color: m.color }}>{m.trend}</span>
                </div>
              ))}
              <div style={styles.mockupConvo}>
                <div style={styles.mockupMsg}>
                  <span style={styles.msgUser}>Patient</span>
                  <span style={styles.msgText}>Can I take aspirin with my metformin?</span>
                </div>
                <div style={{ ...styles.mockupMsg, alignItems: "flex-end" }}>
                  <span style={styles.msgAI}>AI</span>
                  <span style={{ ...styles.msgText, background: BLUE, color: "#fff" }}>
                    Yes, generally safe. However, monitor blood sugar—aspirin can slightly lower glucose levels. ✓ Prescription verified.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS BAND ── */}
      <section ref={statRef} style={styles.statsBand}>
        {[
          { label: "Pharmacies Automated", target: 500, suffix: "+" },
          { label: "Prescriptions Handled", target: 2000000, suffix: "+" },
          { label: "Safety Incidents Prevented", target: 98700, suffix: "+" },
          { label: "Avg. Time Saved / Day", target: 6, suffix: "hrs" },
        ].map((s, i) => (
          <div key={s.label} style={{ ...styles.stat, opacity: statVisible ? 1 : 0, transition: `opacity 0.7s ease ${i * 0.15}s` }}>
            <span style={styles.statNum}>
              {statVisible ? <Counter target={s.target} suffix={s.suffix} /> : "0"}
            </span>
            <span style={styles.statLabel}>{s.label}</span>
          </div>
        ))}
      </section>

      {/* ── CAPABILITIES ── */}
      <section id="features" style={styles.section}>
        <SectionHeader
          tag="Capabilities"
          title={<>Everything a Senior Pharmacist<br />Does—<span style={{ color: BLUE }}>Autonomously.</span></>}
          sub="MediFlow AI doesn't just assist—it acts. From understanding natural conversations to executing backend workflows, it runs your pharmacy end-to-end."
        />
        <div style={styles.capGrid}>
          {[
            { icon: "🎙️", title: "Natural Voice & Text", desc: "Understands patient queries in plain language—just like talking to a real pharmacist. Handles accents, abbreviations, and complex medication names." },
            { icon: "🔮", title: "Predictive Refill Engine", desc: "Learns each patient's usage patterns and proactively initiates refills before they run out, reducing missed-dose incidents by 87%." },
            { icon: "🛡️", title: "Safety & Interaction Guard", desc: "Enforces prescription rules, detects dangerous drug interactions in real-time, and flags controlled substances automatically." },
            { icon: "📦", title: "Autonomous Inventory", desc: "Monitors stock levels 24/7 and triggers procurement orders autonomously when thresholds are breached—zero manual intervention." },
            { icon: "📋", title: "Prescription Intelligence", desc: "Validates e-prescriptions, cross-checks insurance eligibility, and routes edge cases to a human pharmacist with full context." },
            { icon: "📈", title: "Business Analytics", desc: "Real-time dashboards on dispensing trends, expiry tracking, revenue, and patient adherence—all in one view." },
          ].map((c, i) => (
            <CapCard key={c.title} {...c} delay={i * 0.1} />
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how-it-works" style={{ ...styles.section, background: "#f0f6ff" }}>
        <SectionHeader
          tag="How It Works"
          title={<>From Conversation to<br /><span style={{ color: BLUE }}>Completed Action.</span></>}
          sub="MediFlow AI operates as a closed-loop agentic system. Every patient interaction triggers an intelligent chain of automated decisions and backend tasks."
        />
        <div style={styles.stepsWrap}>
          <div style={styles.stepsLine} />
          {[
            { num: "01", title: "Patient Initiates", desc: "Patient speaks or types a query—medication question, refill request, or consultation. MediFlow AI captures intent instantly." },
            { num: "02", title: "AI Comprehends & Plans", desc: "The AI parses intent, retrieves the patient's medication history, and formulates a multi-step action plan in milliseconds." },
            { num: "03", title: "Safety Verification", desc: "All planned actions are cross-checked against prescription databases, interaction libraries, and regulatory rules before execution." },
            { num: "04", title: "Autonomous Execution", desc: "Approved actions are executed: refills are ordered, inventory is updated, insurance is billed, and the patient is notified—automatically." },
            { num: "05", title: "Human Escalation (if needed)", desc: "Edge cases, complex queries, or anomalies are escalated to a pharmacist with full AI-generated context and recommendations." },
          ].map((s, i) => (
            <Step key={s.num} {...s} delay={i * 0.15} />
          ))}
        </div>
      </section>

      {/* ── SAFETY SECTION ── */}
      <section id="safety" style={styles.safetySection}>
        <div style={styles.safetyCopy}>
          <SafetyText goToApp={goToApp} />
        </div>
        <div style={styles.safetyVisual}>
          <SafetyVisual />
        </div>
      </section>

      {/* ── CTA BANNER ── */}
      <section style={styles.ctaBanner}>
        <div style={styles.ctaGlow} />
        <CtaContent goToApp={goToApp} />
      </section>

      {/* ── FOOTER ── */}
      <footer style={styles.footer}>
        <div style={styles.footerLogo}>
          <span style={styles.logoMark}>M</span>
          <span style={styles.logoText}>MediFlow<span style={{ color: BLUE }}>AI</span></span>
        </div>
        <p style={styles.footerTag}>Autonomous Pharmacy Intelligence © {new Date().getFullYear()}</p>
        <div style={styles.footerLinks}>
          {["Privacy", "Terms", "HIPAA Compliance", "Contact"].map((l) => (
            <a key={l} href="#" style={styles.footerLink}>{l}</a>
          ))}
        </div>
      </footer>
    </div>
  );
}

/* ── sub-components ── */
function SectionHeader({ tag, title, sub }) {
  const [ref, visible] = useInView();
  return (
    <div
      ref={ref}
      style={{
        textAlign: "center",
        marginBottom: 64,
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(30px)",
        transition: "opacity 0.8s ease, transform 0.8s ease",
      }}
    >
      <span style={styles.sectionTag}>{tag}</span>
      <h2 style={styles.sectionTitle}>{title}</h2>
      <p style={styles.sectionSub}>{sub}</p>
    </div>
  );
}

function SafetyText({ goToApp }) {
  const [ref, visible] = useInView();
  return (
    <div
      ref={ref}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateX(0)" : "translateX(-40px)",
        transition: "opacity 0.8s ease, transform 0.8s ease",
      }}
    >
      <span style={styles.sectionTag}>Safety First</span>
      <h2 style={{ ...styles.sectionTitle, textAlign: "left", color: "#fff" }}>
        Built with<br /><span style={{ color: "#93c5fd" }}>Zero-Compromise</span><br />Safety.
      </h2>
      <p style={{ ...styles.sectionSub, textAlign: "left", color: "#cbd5e1", maxWidth: 420 }}>
        Every AI action is validated against FDA drug databases, DEA scheduling rules, and your state board's dispensing regulations—before a single action is taken.
      </p>
      {["HIPAA Compliant by design", "Real-time drug interaction engine", "DEA & state board rule enforcement", "Audit trail for every AI decision", "Human override at every step"].map((f) => (
        <div key={f} style={styles.safetyFeature}>
          <span style={styles.safetyCheck}>✓</span> {f}
        </div>
      ))}
      <a href="/app" onClick={goToApp} style={{ ...styles.btnPrimary, marginTop: 32, display: "inline-block" }}>View Compliance Docs →</a>
    </div>
  );
}

function SafetyVisual() {
  const [ref, visible] = useInView();
  return (
    <div
      ref={ref}
      style={{
        ...styles.safetyCard,
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0) rotate(2deg)" : "translateY(40px) rotate(2deg)",
        transition: "opacity 0.9s ease 0.3s, transform 0.9s ease 0.3s",
      }}
    >
      <h4 style={{ margin: "0 0 16px", color: BLUE, fontSize: 14, textTransform: "uppercase", letterSpacing: 2 }}>Live Safety Monitor</h4>
      {[
        { label: "Warfarin + Aspirin", status: "⚠ Interaction flagged", c: "#f59e0b" },
        { label: "Metformin refill", status: "✓ Auto-approved", c: "#22c55e" },
        { label: "Oxycodone request", status: "🔒 DEA check initiated", c: BLUE },
        { label: "Amoxicillin 500mg", status: "✓ Dispensed", c: "#22c55e" },
        { label: "Fentanyl patch Rx", status: "👤 Escalated to pharmacist", c: "#f59e0b" },
      ].map((r) => (
        <div key={r.label} style={styles.safetyRow}>
          <span style={{ color: "#1e293b", fontWeight: 500, fontSize: 14 }}>{r.label}</span>
          <span style={{ color: r.c, fontSize: 13, fontWeight: 600 }}>{r.status}</span>
        </div>
      ))}
      <div style={styles.safetyPulse}>
        <span style={styles.pulseDot} />
        AI monitoring active
      </div>
    </div>
  );
}

function CtaContent({ goToApp }) {
  const [ref, visible] = useInView();
  return (
    <div
      ref={ref}
      style={{
        position: "relative",
        zIndex: 1,
        textAlign: "center",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(30px)",
        transition: "opacity 0.8s ease, transform 0.8s ease",
      }}
    >
      <h2 style={{ fontSize: "clamp(32px,5vw,56px)", fontFamily: "'Playfair Display', Georgia, serif", color: "#fff", margin: "0 0 16px" }}>
        Ready to Automate<br />Your Pharmacy?
      </h2>
      <p style={{ color: "#bfdbfe", fontSize: 18, marginBottom: 40 }}>
        Join 500+ pharmacies running on MediFlow AI. Setup takes under 30 minutes.
      </p>
      <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
        <a onClick={() =>issignedin? navigate('/app'): openSignIn({forceRedirectUrl: "/app", })} style={{ ...styles.btnPrimary, background: "#fff", color: BLUE, fontWeight: 700, padding: "16px 36px", fontSize: 17 }}>Enter MediFlow AI</a>
        <a href="#" style={{ ...styles.btnOutline, borderColor: "rgba(255,255,255,0.4)", color: "#fff", padding: "16px 36px", fontSize: 17 }}>Book a Demo</a>
      </div>
      <p style={{ color: "#93c5fd", marginTop: 24, fontSize: 14 }}>No credit card required · HIPAA compliant from day one</p>
    </div>
  );
}

/* ── STYLES ── */
const styles = {
  root: { fontFamily: "'DM Sans', sans-serif", background: "#fff", color: "#0f172a", overflowX: "hidden", minHeight: "100vh" },
  /* nav */
  nav: { position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, display: "flex", alignItems: "center", padding: "0 5%", height: 68, background: "rgba(255,255,255,0.9)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(37,99,235,0.1)", gap: 32 },
  logo: { display: "flex", alignItems: "center", gap: 10, textDecoration: "none" },
  logoMark: { width: 36, height: 36, borderRadius: 10, background: BLUE, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 18, fontFamily: "'Playfair Display', serif" },
  logoText: { fontSize: 20, fontWeight: 700, color: "#0f172a", letterSpacing: -0.5 },
  navLinks: { display: "flex", gap: 28, marginLeft: "auto" },
  navLink: { color: "#475569", textDecoration: "none", fontSize: 15, fontWeight: 500, transition: "color 0.2s" },
  navCTA: { display: "flex", gap: 12 ,cursor: "pointer"},
  btnOutline: { padding: "9px 20px", borderRadius: 8, border: `1.5px solid ${BLUE}`, color: BLUE, textDecoration: "none", fontSize: 14, fontWeight: 600, transition: "background 0.2s" },
  btnPrimary: { padding: "9px 22px", borderRadius: 8, background: BLUE, color: "#fff", textDecoration: "none", fontSize: 14, fontWeight: 600, border: "none", cursor: "pointer", transition: "opacity 0.2s" },
  burger: { display: "none", background: "none", border: "none", fontSize: 22, cursor: "pointer", marginLeft: "auto" },
  mobileMenu: { position: "fixed", top: 68, left: 0, right: 0, background: "#fff", zIndex: 99, padding: "20px 5%", display: "flex", flexDirection: "column", gap: 16, boxShadow: "0 8px 32px rgba(0,0,0,0.1)" },
  mobileLink: { color: "#0f172a", textDecoration: "none", fontSize: 18, fontWeight: 500 },
  /* hero */
  hero: { minHeight: "100vh", display: "flex", alignItems: "center", padding: "100px 5% 60px", position: "relative", gap: 48, overflow: "hidden" },
  gridBg: { position: "absolute", inset: 0, backgroundImage: `linear-gradient(rgba(37,99,235,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(37,99,235,0.04) 1px, transparent 1px)`, backgroundSize: "48px 48px", zIndex: 0 },
  orb: { position: "absolute", borderRadius: "50%", filter: "blur(80px)", zIndex: 0, pointerEvents: "none" },
  orb1: { width: 600, height: 600, background: "radial-gradient(circle, rgba(37,99,235,0.15) 0%, transparent 70%)", top: -100, right: -150 },
  orb2: { width: 400, height: 400, background: "radial-gradient(circle, rgba(37,99,235,0.08) 0%, transparent 70%)", bottom: -50, left: -100 },
  heroInner: { flex: "1 1 480px", position: "relative", zIndex: 1, maxWidth: 600 },
  badge: { display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(37,99,235,0.08)", border: "1px solid rgba(37,99,235,0.2)", borderRadius: 100, padding: "6px 16px", fontSize: 13, fontWeight: 600, color: BLUE, marginBottom: 24 },
  badgeDot: { width: 8, height: 8, borderRadius: "50%", background: BLUE, animation: "pulse 1.5s infinite" },
  heroH1: { fontSize: "clamp(40px, 5.5vw, 72px)", fontFamily: "'Playfair Display', Georgia, serif", lineHeight: 1.1, letterSpacing: -2, margin: "0 0 20px", color: "#0f172a" },
  heroAccent: { color: BLUE, fontStyle: "italic" },
  heroSub: { fontSize: "clamp(16px, 1.8vw, 19px)", color: "#475569", lineHeight: 1.7, maxWidth: 520, margin: "0 0 32px" },
  chatBox: { background: "rgba(37,99,235,0.04)", border: "1px solid rgba(37,99,235,0.15)", borderRadius: 14, padding: "16px 20px", marginBottom: 32, maxWidth: 500 },
  chatPrompt: { display: "block", fontSize: 11, fontWeight: 700, color: BLUE, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 },
  chatText: { display: "block", fontSize: 16, color: "#1e293b", fontStyle: "italic", minHeight: 24 },
  cursor: { animation: "blink 1s step-end infinite", fontStyle: "normal", color: BLUE },
  chatAI: { display: "block", fontSize: 12, color: "#94a3b8", marginTop: 8 },
  heroCTAs: { display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 32 },
  btnHeroPrimary: { padding: "16px 32px", borderRadius: 12, background: BLUE, color: "#fff", textDecoration: "none", fontSize: 16, fontWeight: 700, letterSpacing: -0.3, boxShadow: `0 8px 32px rgba(37,99,235,0.35)`, transition: "transform 0.2s, box-shadow 0.2s" },
  btnHeroSecondary: { padding: "16px 28px", borderRadius: 12, border: "1.5px solid rgba(37,99,235,0.25)", color: BLUE, textDecoration: "none", fontSize: 16, fontWeight: 600, display: "flex", alignItems: "center", gap: 10, transition: "border-color 0.2s" },
  playBtn: { width: 28, height: 28, borderRadius: "50%", background: BLUE, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11 },
  trustedBy: { fontSize: 14, color: "#64748b" },
  mockupWrap: { flex: "1 1 400px", position: "relative", zIndex: 1, maxWidth: 480, width: "100%" },
  mockup: { background: "#fff", borderRadius: 18, boxShadow: "0 32px 80px rgba(0,0,0,0.12), 0 0 0 1px rgba(37,99,235,0.08)", overflow: "hidden" },
  mockupBar: { background: "#f8fafc", borderBottom: "1px solid #e2e8f0", padding: "12px 16px", display: "flex", alignItems: "center", gap: 6 },
  dot: { width: 10, height: 10, borderRadius: "50%", background: "#ef4444" },
  mockupTitle: { marginLeft: "auto", marginRight: "auto", fontSize: 12, fontWeight: 600, color: "#64748b" },
  mockupBody: { padding: 20, display: "flex", flexDirection: "column", gap: 12 },
  mockupCard: { background: "#f8fafc", borderRadius: 10, padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 4 },
  mockupLabel: { fontSize: 12, color: "#64748b", width: "100%" },
  mockupValue: { fontSize: 28, fontWeight: 800, color: "#0f172a" },
  mockupTrend: { fontSize: 12, fontWeight: 600 },
  mockupConvo: { display: "flex", flexDirection: "column", gap: 10, marginTop: 4 },
  mockupMsg: { display: "flex", flexDirection: "column", gap: 4 },
  msgUser: { fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase" },
  msgAI: { fontSize: 10, fontWeight: 700, color: BLUE, textTransform: "uppercase", textAlign: "right" },
  msgText: { fontSize: 13, background: "#f1f5f9", padding: "8px 12px", borderRadius: 10, color: "#1e293b", lineHeight: 1.5 },
  /* stats */
  statsBand: { background: BLUE, padding: "48px 5%", display: "flex", justifyContent: "space-around", flexWrap: "wrap", gap: 32 },
  stat: { textAlign: "center" },
  statNum: { display: "block", fontSize: "clamp(32px,4vw,52px)", fontFamily: "'Playfair Display', serif", fontWeight: 900, color: "#fff" },
  statLabel: { fontSize: 14, color: "#bfdbfe", marginTop: 4, display: "block" },
  /* section */
  section: { padding: "100px 5%", maxWidth: 1200, margin: "0 auto" },
  sectionTag: { display: "inline-block", background: "rgba(37,99,235,0.08)", color: BLUE, borderRadius: 100, padding: "4px 14px", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 16 },
  sectionTitle: { fontSize: "clamp(28px,4vw,48px)", fontFamily: "'Playfair Display', Georgia, serif", lineHeight: 1.2, letterSpacing: -1, margin: "0 0 16px" },
  sectionSub: { fontSize: 18, color: "#475569", lineHeight: 1.7, maxWidth: 600, margin: "0 auto" },
  /* capabilities */
  capGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 24 },
  capCard: { background: "#f8fafc", border: "1px solid rgba(37,99,235,0.1)", borderRadius: 16, padding: "32px 28px", transition: "box-shadow 0.3s" },
  capIcon: { fontSize: 36, marginBottom: 16 },
  capTitle: { fontSize: 19, fontWeight: 700, margin: "0 0 10px", color: "#0f172a" },
  capDesc: { fontSize: 15, color: "#64748b", lineHeight: 1.7, margin: 0 },
  /* steps */
  stepsWrap: { maxWidth: 680, margin: "0 auto", position: "relative", display: "flex", flexDirection: "column", gap: 0 },
  stepsLine: { position: "absolute", left: 27, top: 28, bottom: 28, width: 2, background: `linear-gradient(to bottom, ${BLUE}, rgba(37,99,235,0.1))`, zIndex: 0 },
  step: { display: "flex", gap: 24, alignItems: "flex-start", padding: "24px 0", position: "relative", zIndex: 1 },
  stepNum: { width: 56, height: 56, borderRadius: 14, background: BLUE, color: "#fff", fontWeight: 800, fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: `0 4px 16px rgba(37,99,235,0.35)` },
  stepTitle: { fontSize: 20, fontWeight: 700, margin: "0 0 8px", color: "#0f172a" },
  stepDesc: { fontSize: 15, color: "#475569", margin: 0, lineHeight: 1.7 },
  /* safety */
  safetySection: { background: "#0f172a", padding: "100px 5%", display: "flex", alignItems: "center", gap: 80, flexWrap: "wrap" },
  safetyCopy: { flex: "1 1 400px" },
  safetyVisual: { flex: "1 1 380px" },
  safetyFeature: { color: "#e2e8f0", fontSize: 15, marginBottom: 12, display: "flex", gap: 12, alignItems: "center" },
  safetyCheck: { color: "#22c55e", fontWeight: 700, fontSize: 16 },
  safetyCard: { background: "#fff", borderRadius: 16, padding: 28, boxShadow: "0 32px 80px rgba(0,0,0,0.3)" },
  safetyRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #f1f5f9", flexWrap: "wrap", gap: 8 },
  safetyPulse: { marginTop: 16, display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#22c55e", fontWeight: 600 },
  pulseDot: { width: 8, height: 8, borderRadius: "50%", background: "#22c55e", animation: "pulse 1.5s infinite", display: "inline-block" },
  /* cta */
  ctaBanner: { background: `linear-gradient(135deg, ${BLUE} 0%, #1d4ed8 50%, #1e40af 100%)`, padding: "100px 5%", position: "relative", overflow: "hidden" },
  ctaGlow: { position: "absolute", top: -100, left: "50%", transform: "translateX(-50%)", width: 600, height: 600, borderRadius: "50%", background: "rgba(255,255,255,0.05)", filter: "blur(60px)", pointerEvents: "none" },
  /* footer */
  footer: { background: "#0f172a", padding: "40px 5%", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 },
  footerTag: { color: "#475569", fontSize: 14, margin: 0 },
  footerLinks: { display: "flex", gap: 24, flexWrap: "wrap", justifyContent: "center" },
  footerLink: { color: "#64748b", textDecoration: "none", fontSize: 14, transition: "color 0.2s" },
};

/* ── global CSS (animations + responsive) ── */
const globalCSS = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=DM+Sans:wght@400;500;600;700&display=swap');

  * { box-sizing: border-box; }
  body { margin: 0; }

  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.5; transform: scale(0.85); }
  }
  @keyframes blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0; }
  }
  @keyframes float {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-10px); }
  }

  .nav-links a:hover { color: #2563eb !important; }

  /* Responsive */
  @media (max-width: 900px) {
    .nav-links { display: none !important; }
    button[style*="display:none"] { display: block !important; }
  }
  @media (max-width: 768px) {
    section[style*="display:flex"] { flex-direction: column !important; }
    div[style*="flex:1 1 480px"] { max-width: 100% !important; }
    div[style*="flex:1 1 400px"] { max-width: 100% !important; }
  }
`;