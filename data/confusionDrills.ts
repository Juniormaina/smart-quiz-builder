import { confusionPairs } from '@/data/confusionPairs';
import { Question } from '@/lib/types';

const scenarios: Record<string, { stem: string; correct: 'a' | 'b' }[]> = {
  'policy-vs-rbac': [
    { stem: 'A company must reject storage accounts whose configuration does not meet its encryption rule. Which control fits?', correct: 'a' },
    { stem: 'An analyst should be allowed to view resources but not change them. Which control assigns this permission?', correct: 'b' },
    { stem: 'A governance team wants to audit resources that are deployed outside approved locations. Which control should it use?', correct: 'a' },
    { stem: 'A team member needs permission to create virtual machines in one resource group. Which control grants that access?', correct: 'b' },
    { stem: 'An organization wants to evaluate whether resources comply with required settings. Which control is designed for this?', correct: 'a' },
  ],
  'region-vs-zone': [
    { stem: 'A business chooses a broad geographic area to host its Azure workload. What is it selecting?', correct: 'a' },
    { stem: 'A workload must be spread across physically separate datacenter locations within the same region. What should it use?', correct: 'b' },
    { stem: 'A team selects a location near its users from Azure geography options. Which concept describes that location?', correct: 'a' },
    { stem: 'A service needs protection from a datacenter-level failure without leaving its region. Which placement concept helps?', correct: 'b' },
    { stem: 'An Azure location may contain multiple isolated datacenter locations. What is that broader location called?', correct: 'a' },
  ],
  'arm-vs-bicep': [
    { stem: 'An operations team maintains a declarative Azure deployment file written in JSON. Which format is it using?', correct: 'a' },
    { stem: 'A developer wants a concise declarative language that compiles into Azure deployment JSON. What should they write?', correct: 'b' },
    { stem: 'A deployment pipeline submits a native JSON template to Azure Resource Manager. Which artifact is this?', correct: 'a' },
    { stem: 'A team wants readable source code for repeatable Azure infrastructure deployments. Which authoring language fits?', correct: 'b' },
    { stem: 'The deployment engine receives the compiled JSON representation from a Bicep source file. What is that representation?', correct: 'a' },
  ],
  'iaas-paas-saas': [
    { stem: 'A team needs to control the guest operating system on a cloud virtual machine. Which service model gives that control?', correct: 'a' },
    { stem: 'A developer deploys application code while the provider manages the operating system and runtime platform. Which model fits?', correct: 'b' },
    { stem: 'A company runs a custom legacy application and must install its own software on a virtual machine. Which model fits?', correct: 'a' },
    { stem: 'A team wants a managed application hosting platform instead of patching the guest operating system. Which model fits?', correct: 'b' },
    { stem: 'A user consumes a complete provider-hosted business application rather than deploying their own code. Which model is closest?', correct: 'b' },
  ],
  'capex-vs-opex': [
    { stem: 'A company purchases servers for its own datacenter before workload demand is known. Which spending type is this?', correct: 'a' },
    { stem: 'A team pays for cloud services as it consumes them over time. Which spending type is this?', correct: 'b' },
    { stem: 'A business invests upfront in hardware that it owns and maintains. Which model describes the investment?', correct: 'a' },
    { stem: 'An organization’s cloud bill varies with its ongoing resource usage. Which spending type is this?', correct: 'b' },
    { stem: 'A purchase adds a long-lived physical asset to a company’s datacenter. Which category best describes it?', correct: 'a' },
  ],
  'pricing-vs-tco': [
    { stem: 'A team wants an estimate for the Azure services in a planned cloud solution. Which calculator should it use?', correct: 'a' },
    { stem: 'A company wants to compare current on-premises costs with estimated Azure costs before migration. Which calculator fits?', correct: 'b' },
    { stem: 'A solution architect needs to model Azure service choices and their estimated prices. Which tool is appropriate?', correct: 'a' },
    { stem: 'A finance team wants a migration-oriented comparison including existing datacenter costs. Which tool should it choose?', correct: 'b' },
    { stem: 'A project is estimating the cost of a newly designed Azure deployment, not comparing it to on-premises. Which tool fits?', correct: 'a' },
  ],
  'advisor-monitor-health': [
    { stem: 'An administrator wants personalized recommendations to improve the cost and reliability of Azure resources. Which service helps?', correct: 'a' },
    { stem: 'An operator wants to query workload metrics and logs and create alerts. Which service should they use?', correct: 'b' },
    { stem: 'A team wants recommendations based on the configuration and usage of its Azure resources. Which service fits?', correct: 'a' },
    { stem: 'A team needs to investigate telemetry and alert when application performance degrades. Which service fits?', correct: 'b' },
    { stem: 'A company wants proactive suggestions for improving resource reliability, security, and cost. Which service provides them?', correct: 'a' },
  ],
  'locks-vs-policy': [
    { stem: 'A production resource group must be protected against accidental deletion. Which feature should be applied?', correct: 'a' },
    { stem: 'A company requires that resources use approved configuration values and wants noncompliant deployments audited. Which feature fits?', correct: 'b' },
    { stem: 'An administrator wants an extra safeguard against accidental changes to a critical resource. Which feature is designed for this?', correct: 'a' },
    { stem: 'A governance team wants to evaluate whether deployed resources meet organizational configuration requirements. Which feature fits?', correct: 'b' },
    { stem: 'A resource should remain protected from accidental deletion while its configuration is otherwise compliant. Which control provides that safeguard?', correct: 'a' },
  ],
};

export const confusionDrillQuestions: Question[] = confusionPairs.flatMap((pair) => {
  const cases = scenarios[pair.id];
  return cases.map(({ stem, correct }, index) => {
    const comparison = pair.comparison[0];
    const correctText = correct === 'a' ? pair.a.name : pair.b.name;
    const wrongText = correct === 'a' ? pair.b.name : pair.a.name;
    const answerOptions = [
      { id: 'a', text: pair.a.name },
      { id: 'b', text: pair.b.name },
      { id: 'c', text: 'Both concepts have the same primary purpose' },
      { id: 'd', text: 'Neither concept applies to this scenario' },
    ];
    return {
      id: `pair-${pair.id}-${String(index + 1).padStart(2, '0')}`,
      pairId: pair.id,
      domain: pair.id === 'region-vs-zone' || pair.id === 'capex-vs-opex' ? 'cloud-concepts' as const : 'management-governance' as const,
      subtopic: `${pair.a.name} vs ${pair.b.name}`,
      difficulty: ([1, 2, 2, 3, 2] as const)[index],
      type: 'single' as const,
      stem,
      options: answerOptions,
      correct: [correct],
      explanation: {
        summary: `${correctText} is the better match for this scenario.`,
        whyCorrect: `${correctText}: ${correct === 'a' ? comparison.a : comparison.b}`,
        whyWrong: {
          [correct === 'a' ? 'b' : 'a']: `${wrongText} addresses a different responsibility: ${correct === 'a' ? comparison.b : comparison.a}`,
          c: 'These concepts have distinct responsibilities; choosing both would not identify the requested control or model.',
          d: 'One of the compared Azure concepts is applicable to the scenario.',
        },
        memoryHook: pair.ruleOfThumb,
        docsTopic: pair.a.name,
        keyConcepts: [pair.a.name, pair.b.name],
        keyConceptSynonyms: {
          [pair.a.name]: [pair.a.name.toLowerCase()],
          [pair.b.name]: [pair.b.name.toLowerCase()],
        },
      },
      tags: ['confusion-drill', pair.id],
    };
  });
});
