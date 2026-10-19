import { cloudConceptQuestions } from '@/data/questions/cloud-concepts';
import { architectureServicesQuestions } from '@/data/questions/architecture-services';
import { managementGovernanceQuestions } from '@/data/questions/management-governance';
import { Question, QuestionInput } from '@/lib/types';
import { confusionDrillQuestions } from '@/data/confusionDrills';

const pairByQuestionId: Record<string, string> = {
  'cc-003': 'capex-vs-opex',
  'cc-005': 'region-vs-zone',
  'cc-006': 'region-vs-zone',
  'cc-007': 'region-vs-zone',
  'cc-012': 'capex-vs-opex',
  'cc-015': 'capex-vs-opex',
  'as-001': 'iaas-paas-saas',
  'as-002': 'iaas-paas-saas',
  'as-017': 'iaas-paas-saas',
  'as-023': 'iaas-paas-saas',
  'mg-001': 'policy-vs-rbac',
  'mg-002': 'locks-vs-policy',
  'mg-003': 'policy-vs-rbac',
  'mg-004': 'pricing-vs-tco',
  'mg-005': 'advisor-monitor-health',
  'mg-006': 'advisor-monitor-health',
  'mg-007': 'advisor-monitor-health',
  'mg-009': 'pricing-vs-tco',
  'mg-011': 'arm-vs-bicep',
  'mg-012': 'policy-vs-rbac',
  'mg-013': 'pricing-vs-tco',
  'mg-019': 'pricing-vs-tco',
};

const rawQuestionBank: QuestionInput[] = [
  ...cloudConceptQuestions,
  ...architectureServicesQuestions,
  ...managementGovernanceQuestions,
  ...confusionDrillQuestions,
];

export const questionBank: Question[] = rawQuestionBank.map((question) => ({
  ...question,
  pairId: question.pairId ?? pairByQuestionId[question.id],
  explanation: {
    ...question.explanation,
    keyConcepts: question.explanation.keyConcepts ?? Array.from(new Set([
      question.subtopic,
      ...question.tags,
      question.explanation.docsTopic,
      question.explanation.memoryHook.split(/[.;,]/)[0],
      question.explanation.summary.slice(0, 80),
    ])).filter(Boolean).slice(0, 4),
  },
}));

export const domainQuestionCounts = {
  'cloud-concepts': cloudConceptQuestions.length,
  'architecture-services': architectureServicesQuestions.length,
  'management-governance': managementGovernanceQuestions.length,
};
