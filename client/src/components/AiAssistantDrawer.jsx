import React, { useState } from 'react';
import { X, Sparkles, Send, Bot, User, CheckCircle2, AlertCircle, HelpCircle, FileCode } from 'lucide-react';

export function AiAssistantDrawer({ isOpen, onClose, assessment, job, repo }) {
  const [messages, setMessages] = useState([
    {
      sender: 'assistant',
      text: `Hello! I am your SkillProof AI Coach. I can explain the evidence findings behind ${job ? `"${job.title}"` : 'your target role'} and suggest concrete code to close remaining gaps. What would you like to inspect?`,
    },
  ]);
  const [input, setInput] = useState('');

  if (!isOpen) return null;

  const quickQuestions = [
    'Why was SQL marked not demonstrated?',
    'What evidence supports Java?',
    'How is my coverage score calculated?',
    'What should I build next to improve coverage?',
  ];

  const handleSend = (userText) => {
    const textToSend = userText || input;
    if (!textToSend.trim()) return;

    const newMsgs = [...messages, { sender: 'user', text: textToSend }];
    setMessages(newMsgs);
    setInput('');

    // Generate grounded contextual response
    setTimeout(() => {
      let reply = '';
      const q = textToSend.toLowerCase();

      if (q.includes('sql')) {
        const sqlResult = assessment?.skillResults?.find((s) => s.skill.toLowerCase() === 'sql');
        if (!sqlResult || sqlResult.status === 'not_demonstrated') {
          reply = `In the current analyzed scope for ${repo?.fullName || 'the repository'}, no parameterized queries, schema migrations, or relational database implementations were identified. Missing evidence does not mean you lack the ability — it simply means SQL is not yet proven in this repository. Adding a schema file or SQL service query will trigger automatic reassessment.`;
        } else {
          reply = `SQL is marked as "${sqlResult.status}". ${sqlResult.explanation} You can inspect the verified SQL statements in the Evidence Explorer.`;
        }
      } else if (q.includes('java')) {
        const javaResult = assessment?.skillResults?.find((s) => s.skill.toLowerCase() === 'java');
        if (javaResult && javaResult.status === 'demonstrated') {
          reply = `Java is verified as Demonstrated! Evidence was identified in Java source classes within the repository at commit ${assessment.commitSha?.slice(0, 7)}.`;
        } else {
          reply = `Java status is currently ${javaResult ? javaResult.status : 'pending analysis'}.`;
        }
      } else if (q.includes('score') || q.includes('formula') || q.includes('calculate')) {
        reply = `Your coverage score is ${assessment?.coverageScore || 0}%. It is calculated deterministically using: Coverage = 100 * sum(weight * evidence_score) / sum(weight), where Demonstrated = 1.0, Partially demonstrated = 0.5, and Not demonstrated = 0.0. Required competencies are weighted 2.0x higher than preferred competencies.`;
      } else if (q.includes('build next') || q.includes('gap') || q.includes('improve')) {
        const gaps = assessment?.skillResults?.filter((s) => s.status !== 'demonstrated') || [];
        if (gaps.length === 0) {
          reply = `Great job! All analyzed skills for ${job?.title || 'this role'} currently have verified code evidence.`;
        } else {
          reply = `To improve your coverage, focus on: ${gaps.map((g) => g.skill).join(', ')}. For example, implementing a SQL query or database persistence module will immediately improve SQL evidence coverage when pushed to GitHub.`;
        }
      } else {
        reply = `Based on the latest assessment (Rev #${assessment?.revisionNumber || 1}) for ${repo?.fullName || 'the repository'}, ${assessment?.skillResults?.filter((s) => s.status === 'demonstrated').length || 0} skills are demonstrated and ${assessment?.skillResults?.filter((s) => s.status !== 'demonstrated').length || 0} need further evidence. Every finding is backed by commit-pinned GitHub permalinks.`;
      }

      setMessages((prev) => [...prev, { sender: 'assistant', text: reply }]);
    }, 400);
  };

  return (
    <div className="drawer-overlay" onClick={onClose} id="ai-assistant-drawer-overlay">
      <div className="drawer-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div style={{ background: 'var(--primary-subtle)', padding: '0.5rem', borderRadius: 'var(--radius-sm)' }}>
              <Sparkles size={18} color="var(--primary)" />
            </div>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                SkillProof AI Coach
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Contextual evidence explanations & guidance
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ color: 'var(--text-muted)' }}>
            <X size={20} />
          </button>
        </div>

        {/* Quick questions chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
          {quickQuestions.map((q, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(q)}
              style={{
                fontSize: '0.74rem',
                background: 'var(--bg-subtle)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-light)',
                padding: '0.3rem 0.65rem',
                borderRadius: 'var(--radius-full)',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--primary)';
                e.currentTarget.style.color = 'var(--primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-light)';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }}
            >
              {q}
            </button>
          ))}
        </div>

        {/* Messages list */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem', paddingRight: '0.25rem' }}>
          {messages.map((m, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                gap: '0.65rem',
                alignItems: 'flex-start',
                flexDirection: m.sender === 'user' ? 'row-reverse' : 'row',
              }}
            >
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  background: m.sender === 'user' ? 'var(--primary)' : 'var(--bg-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  color: m.sender === 'user' ? '#FFFFFF' : 'var(--primary)',
                }}
              >
                {m.sender === 'user' ? <User size={14} /> : <Bot size={14} />}
              </div>

              <div
                style={{
                  maxWidth: '82%',
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.86rem',
                  lineHeight: 1.5,
                  background: m.sender === 'user' ? 'var(--primary)' : 'var(--bg-subtle)',
                  color: m.sender === 'user' ? '#FFFFFF' : 'var(--text-primary)',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                {m.text}
              </div>
            </div>
          ))}
        </div>

        {/* Input box */}
        <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '1rem', display: 'flex', gap: '0.5rem' }}>
          <input
            type="text"
            className="form-input"
            placeholder="Ask why a skill was marked, or how to prove it..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            style={{ fontSize: '0.85rem' }}
          />
          <button
            onClick={() => handleSend()}
            className="btn btn-primary"
            style={{ padding: '0 1rem' }}
          >
            <Send size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
