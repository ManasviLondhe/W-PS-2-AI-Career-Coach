import React from 'react';
import { CheckCircle2, AlertCircle, HelpCircle } from 'lucide-react';

export function Badge({ status, type = 'status', children }) {
  if (type === 'classification') {
    const isReq = status === 'required';
    return (
      <span className={`badge ${isReq ? 'badge-required' : 'badge-preferred'}`}>
        {isReq ? 'Required' : 'Preferred'}
      </span>
    );
  }

  if (type === 'verification') {
    let label = 'Unverified (Pasted)';
    let cls = 'badge-not_demonstrated';
    if (status === 'verified_api') {
      label = 'Verified API (Greenhouse/Lever)';
      cls = 'badge-demonstrated';
    } else if (status === 'verified_url') {
      label = 'Verified Web Source';
      cls = 'badge-partially_demonstrated';
    }
    return <span className={`badge ${cls}`}>{label}</span>;
  }

  // Exact 3 core statuses required by SkillProof AI specifications:
  // 1. Demonstrated
  // 2. Partially demonstrated
  // 3. Not demonstrated in analyzed scope
  let icon = <CheckCircle2 size={13} />;
  let label = 'Demonstrated';
  let cls = 'badge-demonstrated';

  if (status === 'partially_demonstrated') {
    icon = <AlertCircle size={13} />;
    label = 'Partially demonstrated';
    cls = 'badge-partially_demonstrated';
  } else if (status === 'not_demonstrated') {
    icon = <HelpCircle size={13} />;
    label = 'Not demonstrated in analyzed scope';
    cls = 'badge-not_demonstrated';
  }

  return (
    <span className={`badge ${cls}`} title={label}>
      {icon}
      <span>{children || label}</span>
    </span>
  );
}
