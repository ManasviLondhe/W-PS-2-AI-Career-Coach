import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  ArrowRight,
  GitCommit,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  RefreshCw,
  FileCode2,
  Sparkles,
  Search,
  ExternalLink,
  ChevronRight,
  Database,
  Terminal,
  Cpu,
  Layers,
  Lock,
} from 'lucide-react';

export function LandingPage() {
  const [activeProofTab, setActiveProofTab] = useState('after'); // 'before' or 'after'
  const [activeStep, setActiveStep] = useState(0);

  const steps = [
    {
      num: '01',
      title: 'Import Real Job Requirements',
      desc: 'Connect public job listings from Greenhouse, Lever, or direct web URLs. SkillProof extracts required vs preferred technical competencies and retains verifiable source links.',
      detail: 'Requirements are normalized into a transparent taxonomy (e.g., Java, SQL, REST APIs, Git, Testing) rather than arbitrary keyword strings.',
    },
    {
      num: '02',
      title: 'Inspect GitHub Repository Code',
      desc: 'Our engine inspects actual AST syntax and implementation patterns across commits. It looks for executable queries, route declarations, class structures, and automated tests.',
      detail: 'README mentions are classified as weak or unverified. Only concrete code implementations establish proven competencies.',
    },
    {
      num: '03',
      title: 'Evidence-Backed Gaps & Roadmaps',
      desc: 'When an implementation is absent, SkillProof marks it as "Not demonstrated in analyzed scope" — an honest observation, never a judgment on your potential.',
      detail: 'Actionable project recommendations provide exact implementation blueprints to guide your next code commit.',
    },
    {
      num: '04',
      title: 'Automatic Commit Reassessment',
      desc: 'As soon as you push new code to GitHub, the background polling worker detects the commit SHA, analyzes the changed files, and generates a new immutable assessment revision.',
      detail: 'Revision history preserves before-and-after snapshots so recruiters and judges can see your actual development progress.',
    },
  ];

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '1rem 1rem 5rem' }}>
      {/* Top Navbar */}
      <nav
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1.25rem 0 3rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <ShieldCheck size={28} color="var(--primary)" />
          <span style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            SkillProof AI
          </span>
          <span className="worcflow-tag" style={{ marginLeft: '0.4rem' }}>
            SPONSORED BY WORCFLOW
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link to="/jobs" style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
            Job Explorer
          </Link>
          <Link to="/dashboard" className="btn btn-primary" id="nav-launch-app">
            <span>Launch Proofspace</span>
            <ArrowRight size={15} />
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section style={{ textAlign: 'center', maxWidth: '880px', margin: '0 auto 4rem' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            background: 'var(--primary-subtle)',
            border: '1px solid var(--primary-border)',
            padding: '0.35rem 0.95rem',
            borderRadius: 'var(--radius-full)',
            fontSize: '0.8rem',
            fontWeight: 700,
            color: 'var(--primary)',
            marginBottom: '1.75rem',
          }}
        >
          <Sparkles size={14} />
          <span>AI CAREER COACH · SPONSORED BY WORCFLOW</span>
        </div>

        <h1
          style={{
            fontSize: '3.6rem',
            fontWeight: 900,
            letterSpacing: '-0.04em',
            lineHeight: 1.12,
            color: 'var(--text-primary)',
            marginBottom: '1.5rem',
          }}
        >
          Your skills deserve <span style={{ color: 'var(--primary)' }}>proof</span>.
        </h1>

        <p
          style={{
            fontSize: '1.25rem',
            color: 'var(--text-secondary)',
            lineHeight: 1.6,
            maxWidth: '720px',
            margin: '0 auto 2.5rem',
          }}
        >
          Stop guessing whether your portfolio matches the job. Connect your GitHub, inspect real evidence, and discover what to build next as your code evolves.
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <Link
            to="/dashboard"
            className="btn btn-primary"
            style={{ padding: '0.85rem 2rem', fontSize: '1.05rem' }}
            id="hero-primary-cta"
          >
            <span>Analyze my portfolio</span>
            <ArrowRight size={18} />
          </Link>
          <a
            href="#proof-engine-demo"
            className="btn btn-secondary"
            style={{ padding: '0.85rem 1.75rem', fontSize: '1.05rem' }}
            id="hero-secondary-cta"
          >
            <span>Explore how it works</span>
          </a>
        </div>
      </section>

      {/* Hero Visual: The Proof Engine (Interactive Product Preview) */}
      <section
        id="proof-engine-demo"
        style={{
          background: '#FFFFFF',
          border: '1px solid var(--border-light)',
          borderRadius: 'var(--radius-xl)',
          padding: '2rem',
          boxShadow: 'var(--shadow-lg)',
          marginBottom: '5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              INTERACTIVE DEMO
            </span>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              The Proof Engine in Action
            </h2>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-subtle)', padding: '0.35rem', borderRadius: 'var(--radius-md)' }}>
            <button
              onClick={() => setActiveProofTab('before')}
              className={`btn btn-sm ${activeProofTab === 'before' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ border: 'none' }}
              id="demo-tab-before"
            >
              Step 1: Initial Assessment (Rev #1)
            </button>
            <button
              onClick={() => setActiveProofTab('after')}
              className={`btn btn-sm ${activeProofTab === 'after' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ border: 'none' }}
              id="demo-tab-after"
            >
              Step 2: Commit Detected & Reassessed (Rev #2)
            </button>
          </div>
        </div>

        {/* 3 Connected Panels Grid */}
        <div className="grid-3" style={{ gap: '1.25rem' }}>
          {/* Panel A: Job Requirements */}
          <div
            style={{
              background: 'var(--bg-subtle)',
              border: '1px solid var(--border-light)',
              borderRadius: 'var(--radius-lg)',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                PANEL A: JOB REQUIREMENTS
              </span>
              <span style={{ fontSize: '0.72rem', color: 'var(--primary)', fontWeight: 700 }}>
                Stripe · Backend Role
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ background: '#FFFFFF', padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.86rem', fontWeight: 700 }}>Java</span>
                <span className="badge badge-required">Required</span>
              </div>
              <div style={{ background: '#FFFFFF', padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.86rem', fontWeight: 700 }}>SQL & Databases</span>
                <span className="badge badge-required">Required</span>
              </div>
              <div style={{ background: '#FFFFFF', padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.86rem', fontWeight: 700 }}>REST APIs</span>
                <span className="badge badge-required">Required</span>
              </div>
              <div style={{ background: '#FFFFFF', padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.86rem', fontWeight: 700 }}>Unit Testing</span>
                <span className="badge badge-required">Required</span>
              </div>
            </div>

            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
              Source: <em>https://stripe.com/jobs/backend-software-engineer</em>
            </div>
          </div>

          {/* Panel B: Repository Evidence */}
          <div
            style={{
              background: 'var(--bg-dark)',
              color: '#FFFFFF',
              borderRadius: 'var(--radius-lg)',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
              fontFamily: 'var(--font-mono)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #2d3345', paddingBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#A5B4FC' }}>
                PANEL B: GITHUB EVIDENCE
              </span>
              <span style={{ fontSize: '0.72rem', color: '#94A3B8' }}>
                {activeProofTab === 'before' ? 'Commit: 7fd1a60' : 'New Commit: a9f4c12'}
              </span>
            </div>

            {activeProofTab === 'before' ? (
              <div style={{ fontSize: '0.75rem', lineHeight: 1.6, color: '#cbd5e1' }}>
                <div style={{ color: '#94a3b8', marginBottom: '0.35rem' }}>// src/main/java/OrderService.java:14-22</div>
                <div style={{ color: '#38bdf8' }}>@Service</div>
                <div>public class OrderService &#123;</div>
                <div style={{ paddingLeft: '1rem', color: '#4ade80' }}>public Order processOrder(OrderReq req) &#123;</div>
                <div style={{ paddingLeft: '2rem' }}>return orderRepository.save(req);</div>
                <div style={{ paddingLeft: '1rem' }}>&#125;</div>
                <div>&#125;</div>
                <div style={{ color: '#f87171', marginTop: '0.6rem' }}>// Notice: No SQL implementation in repo</div>
              </div>
            ) : (
              <div style={{ fontSize: '0.75rem', lineHeight: 1.6, color: '#cbd5e1' }}>
                <div style={{ color: '#4ade80', marginBottom: '0.35rem' }}>// ADDED: database/queries.sql:1-8</div>
                <div style={{ color: '#fbbf24' }}>SELECT o.id, o.amount, c.email</div>
                <div style={{ color: '#fbbf24' }}>FROM orders o</div>
                <div style={{ color: '#fbbf24' }}>JOIN customers c ON o.customer_id = c.id</div>
                <div style={{ color: '#fbbf24' }}>WHERE o.status = $1 AND o.created_at &gt; $2;</div>
                <div style={{ color: '#a5b4fc', marginTop: '0.4rem' }}>// Detected parameterized query with JOIN</div>
              </div>
            )}

            <div style={{ marginTop: 'auto', paddingTop: '0.5rem', borderTop: '1px solid #2d3345', fontSize: '0.72rem', color: '#94a3b8' }}>
              Pinned Link: github.com/student/payments-service/blob/{activeProofTab === 'before' ? '7fd1a60' : 'a9f4c12'}
            </div>
          </div>

          {/* Panel C: Skill Assessment Status */}
          <div
            style={{
              background: 'var(--bg-subtle)',
              border: '1px solid var(--border-light)',
              borderRadius: 'var(--radius-lg)',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                PANEL C: ASSESSMENT VERDICT
              </span>
              <span style={{ fontSize: '0.78rem', fontWeight: 800, color: activeProofTab === 'before' ? 'var(--warning)' : 'var(--success)' }}>
                {activeProofTab === 'before' ? '50% Coverage' : '75% Coverage (+25%)'}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <div style={{ background: '#FFFFFF', padding: '0.6rem 0.8rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.84rem', fontWeight: 700 }}>Java</span>
                <span className="badge badge-demonstrated">
                  <CheckCircle2 size={12} /> Demonstrated
                </span>
              </div>

              {/* Dynamic SQL status */}
              <div
                style={{
                  background: activeProofTab === 'before' ? '#FFFFFF' : '#EDF7F1',
                  padding: '0.6rem 0.8rem',
                  borderRadius: 'var(--radius-sm)',
                  border: `1px solid ${activeProofTab === 'before' ? 'var(--border-light)' : 'var(--success-border)'}`,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  transition: 'all 0.3s ease',
                }}
              >
                <span style={{ fontSize: '0.84rem', fontWeight: 700 }}>SQL</span>
                {activeProofTab === 'before' ? (
                  <span className="badge badge-not_demonstrated" title="Not demonstrated in analyzed scope">
                    <HelpCircle size={12} /> Not demonstrated in analyzed scope
                  </span>
                ) : (
                  <span className="badge badge-demonstrated">
                    <CheckCircle2 size={12} /> Demonstrated
                  </span>
                )}
              </div>

              <div style={{ background: '#FFFFFF', padding: '0.6rem 0.8rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.84rem', fontWeight: 700 }}>REST APIs</span>
                <span className="badge badge-demonstrated">
                  <CheckCircle2 size={12} /> Demonstrated
                </span>
              </div>

              <div style={{ background: '#FFFFFF', padding: '0.6rem 0.8rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.84rem', fontWeight: 700 }}>Unit Testing</span>
                <span className="badge badge-not_demonstrated">
                  <HelpCircle size={12} /> Not demonstrated in analyzed scope
                </span>
              </div>
            </div>

            <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', background: '#FFFFFF', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)' }}>
              {activeProofTab === 'before'
                ? 'Revision #1 generated. SQL was absent from repository scope.'
                : 'Revision #2 automatically generated after commit a9f4c12 added database/queries.sql.'}
            </div>
          </div>
        </div>
      </section>

      {/* Problem Statement Section */}
      <section style={{ marginBottom: '5rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <h2 style={{ fontSize: '2.2rem', fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text-primary)' }}>
            A resume tells a story. Your code shows the evidence.
          </h2>
          <p style={{ fontSize: '1.05rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
            Why buzzword scanners and keyword chatbots fail early-career developers:
          </p>
        </div>

        <div className="grid-3">
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ background: 'var(--bg-subtle)', padding: '0.75rem', borderRadius: 'var(--radius-md)', width: 'fit-content' }}>
              <Layers size={22} color="var(--primary)" />
            </div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>1. Requirements Are Inconsistent</h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
              Job descriptions bury core expectations under marketing fluff. SkillProof extracts and normalizes explicit requirements from verified job boards so you know what actually matters.
            </p>
          </div>

          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ background: 'var(--bg-subtle)', padding: '0.75rem', borderRadius: 'var(--radius-md)', width: 'fit-content' }}>
              <Terminal size={22} color="var(--primary)" />
            </div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>2. Portfolios Are Painful to Audit</h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
              Recruiters rarely clone repositories to verify claims. SkillProof does it automatically: inspecting syntax, locating code files, and constructing permanent, commit-pinned proof links.
            </p>
          </div>

          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ background: 'var(--bg-subtle)', padding: '0.75rem', borderRadius: 'var(--radius-md)', width: 'fit-content' }}>
              <GitCommit size={22} color="var(--primary)" />
            </div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>3. Evidence Evolves as You Build</h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
              When you push a commit, our scheduled backend worker detects the SHA, parses the diff, and updates your assessment revision history automatically without manual resubmission.
            </p>
          </div>
        </div>
      </section>

      {/* 4-Step Interactive Workflow Section */}
      <section style={{ marginBottom: '5rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            HOW IT WORKS
          </span>
          <h2 style={{ fontSize: '2.2rem', fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text-primary)', marginTop: '0.25rem' }}>
            Four Steps from Job Posting to Verifiable Proof
          </h2>
        </div>

        <div className="grid-2" style={{ gap: '2rem', alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {steps.map((st, i) => (
              <div
                key={st.num}
                onClick={() => setActiveStep(i)}
                style={{
                  background: activeStep === i ? '#FFFFFF' : 'transparent',
                  border: `1px solid ${activeStep === i ? 'var(--primary)' : 'var(--border-light)'}`,
                  borderRadius: 'var(--radius-md)',
                  padding: '1.25rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: activeStep === i ? 'var(--shadow-md)' : 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 800, color: activeStep === i ? 'var(--primary)' : 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {st.num}
                  </span>
                  <ChevronRight size={16} color={activeStep === i ? 'var(--primary)' : 'var(--text-muted)'} />
                </div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                  {st.title}
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  {st.desc}
                </p>
              </div>
            ))}
          </div>

          <div
            style={{
              background: '#FFFFFF',
              border: '1px solid var(--border-light)',
              borderRadius: 'var(--radius-xl)',
              padding: '2.5rem',
              boxShadow: 'var(--shadow-md)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ background: 'var(--primary-subtle)', padding: '0.65rem', borderRadius: 'var(--radius-sm)' }}>
                <Sparkles size={22} color="var(--primary)" />
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  STEP {steps[activeStep].num} SPOTLIGHT
                </span>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>
                  {steps[activeStep].title}
                </h3>
              </div>
            </div>

            <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              {steps[activeStep].detail}
            </p>

            <div
              style={{
                background: 'var(--bg-subtle)',
                padding: '1rem',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.85rem',
                borderLeft: '4px solid var(--primary)',
              }}
            >
              <strong>Evaluation Principle: </strong>
              Missing evidence is never reported as &quot;lack of skill.&quot; It is objectively recorded as &quot;Not demonstrated in analyzed scope.&quot;
            </div>
          </div>
        </div>
      </section>

      {/* Trust & Transparency Banner */}
      <section
        style={{
          background: 'linear-gradient(135deg, #171923 0%, #202434 100%)',
          color: '#FFFFFF',
          borderRadius: 'var(--radius-xl)',
          padding: '3.5rem 3rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '2rem',
          marginBottom: '5rem',
        }}
      >
        <div style={{ maxWidth: '780px' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#A5B4FC' }}>
            BUILT FOR WORCFLOW EVALUATION
          </span>
          <h2 style={{ fontSize: '2.3rem', fontWeight: 800, marginTop: '0.4rem', letterSpacing: '-0.03em' }}>
            Zero Hallucinated Claims. 100% Verifiable Code.
          </h2>
          <p style={{ fontSize: '1rem', color: '#CBD5E1', marginTop: '0.85rem', lineHeight: 1.65 }}>
            SkillProof AI does not pretend to analyze code that doesn&apos;t exist. Every assessed requirement links directly to exact line numbers and permanent commit hashes on GitHub. If an external credential is not configured, our deterministic ruleset operates transparently without fabrication.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', borderTop: '1px solid #33394D', paddingTop: '2rem' }}>
          <div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#38BDF8' }}>100%</div>
            <div style={{ fontSize: '0.85rem', color: '#94A3B8' }}>Deterministic Scoring Formula</div>
          </div>
          <div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#4ADE80' }}>Commit-Pinned</div>
            <div style={{ fontSize: '0.85rem', color: '#94A3B8' }}>Permanent GitHub Permalinks</div>
          </div>
          <div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#FBBF24' }}>Continuous</div>
            <div style={{ fontSize: '0.85rem', color: '#94A3B8' }}>Background Polling Worker</div>
          </div>
          <div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#A5B4FC' }}>Immutable</div>
            <div style={{ fontSize: '0.85rem', color: '#94A3B8' }}>Historical Revision Snapshots</div>
          </div>
        </div>
      </section>

      {/* Final Call to Action */}
      <section style={{ textAlign: 'center', padding: '3rem 1rem' }}>
        <h2 style={{ fontSize: '2.5rem', fontWeight: 900, letterSpacing: '-0.03em', color: 'var(--text-primary)', marginBottom: '1rem' }}>
          Build it. Ship it. Prove it.
        </h2>
        <p style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', marginBottom: '2rem', maxWidth: '600px', margin: '0 auto 2rem' }}>
          Connect your GitHub repository and import a job posting to generate your first evidence-backed skill assessment.
        </p>
        <Link to="/dashboard" className="btn btn-primary" style={{ padding: '0.9rem 2.25rem', fontSize: '1.05rem' }}>
          <span>Launch SkillProof AI</span>
          <ArrowRight size={18} />
        </Link>
      </section>

      {/* Footer */}
      <footer
        style={{
          borderTop: '1px solid var(--border-light)',
          paddingTop: '2rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          fontSize: '0.84rem',
          color: 'var(--text-muted)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ShieldCheck size={18} color="var(--primary)" />
          <strong>SkillProof AI</strong>
          <span>— Sponsored by Worcflow</span>
        </div>
        <div>
          Evaluating real code evidence, not judging human potential.
        </div>
      </footer>
    </div>
  );
}
