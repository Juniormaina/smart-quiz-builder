export type AfricanContextLens = "standard" | "analogy" | "pidgin_swahili";

export interface LensOption {
  id: AfricanContextLens;
  label: string;
  icon: string;
  description: string;
}

export const LENS_OPTIONS: LensOption[] = [
  {
    id: "standard",
    label: "Standard",
    icon: "📚",
    description: "Official Azure Learn style explanation",
  },
  {
    id: "analogy",
    label: "Local Analogy",
    icon: "🌍",
    description:
      "African business & daily life analogies (Markets, Solar, Transport)",
  },
  {
    id: "pidgin_swahili",
    label: "Pidgin / Local",
    icon: "🗣️",
    description: "Simple regional terms & pidgin explanations",
  },
];

export function applyAfricanContextPrompt(
  promptText: string,
  lens: AfricanContextLens,
): string {
  if (lens === "analogy") {
    return `${promptText}\n\n[INSTRUCTION: Explain this Azure concept using a practical real-world African business or daily life analogy—e.g., market stalls, mobile money networks, public transport, or gated community security.]`;
  }

  if (lens === "pidgin_swahili") {
    return `${promptText}\n\n[INSTRUCTION: Explain this Azure concept in simple, clear Nigerian Pidgin or simple regional terms with plain analogies so a beginner immediately grasps it.]`;
  }

  return promptText;
}
