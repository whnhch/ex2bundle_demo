// Guide-mode explanations, keyed by the `tip` of each "?" badge.
export const GUIDE_TIPS = {
  documents: "Every document plays one role. Sources are where you pick example sentences; Ex2Bundle extracts a snippet from each Target. Off leaves a document out.",
  sources: "The sentences you select in a source document form one example snippet. Ex2Bundle learns your intent from the topics your example snippets cover.",
  profile: "How strongly this example snippet covers each topic, summed over its sentences. The range across all your examples becomes the intent Ex2Bundle looks for.",
  topics: "One slider per topic. Neutral is the intent learned from your examples; slide left to ask for less of a topic, right for more. If a target can't satisfy a position, its snippet uses the nearest setting that works for it.",
  retrieve: "Learns your intent from the example snippets, adjusts it so every target can satisfy it, and extracts the most informative matching snippet from each target.",
  results: "One snippet per target document. The highlighted sentences are the snippet: the most informative set of sentences whose topic mix stays within the intent learned from your examples.",
} as const;

export type GuideTip = keyof typeof GUIDE_TIPS;
