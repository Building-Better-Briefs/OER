export type InstitutionalAiPolicy = { label: string; url: string };
export const institutionConfig = {
  name: 'IADT',
  appName: 'Assessment Brief Builder (Offline)',
  logoUrlLight: '/logo-light.svg',
  logoUrlDark: '/logo-dark.svg',
  aiPolicyLabel: '',
  aiPolicyUrl: '',
  studentEmailDomain: 'student.iadt.ie'
} as const;

export function getStudentEmail(studentNumber: string): string {
  const trimmed = studentNumber.trim();
  if (!trimmed) return '';
  const domain = institutionConfig.studentEmailDomain;
  return domain ? `${trimmed}@${domain}` : trimmed;
}
export function getInstitutionAiPolicy(): InstitutionalAiPolicy {
  const label = institutionConfig.aiPolicyLabel;
  const url = institutionConfig.aiPolicyUrl;
  return label && url ? { label, url } : { label: '', url: '' };
}
