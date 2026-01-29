/**
 * Brag List Vocabulary Configuration
 *
 * Defines allowed/banned words, impact themes, and seniority-specific rules
 * for generating credible, non-fluffy performance review language.
 */

import { BragSeniorityMode, BragWordingToggle } from "./types";

// ============================================
// IMPACT THEMES (Allowlist)
// ============================================
// These are the ONLY outcome categories the generator should claim.
// They describe what the user controlled, not external results.

export const IMPACT_THEMES = {
  clarity: {
    description: "Made information easier to understand or find",
    verbs: ["clarified", "documented", "outlined", "structured"],
  },
  risk_reduction: {
    description: "Reduced likelihood of problems or errors",
    verbs: ["mitigated", "prevented", "identified", "flagged"],
  },
  decision_readiness: {
    description: "Enabled others to make informed decisions",
    verbs: ["prepared", "summarized", "compiled", "synthesized"],
  },
  predictability: {
    description: "Made timelines or outcomes more foreseeable",
    verbs: ["scheduled", "planned", "estimated", "tracked"],
  },
  coordination: {
    description: "Improved alignment between people or teams",
    verbs: ["aligned", "coordinated", "facilitated", "synchronized"],
  },
  execution_quality: {
    description: "Delivered work that met or exceeded standards",
    verbs: ["completed", "delivered", "executed", "finalized"],
  },
  enablement: {
    description: "Unblocked or empowered others to do their work",
    verbs: ["enabled", "unblocked", "supported", "provided"],
  },
  standardization: {
    description: "Created consistency or reusable patterns",
    verbs: ["standardized", "templated", "established", "defined"],
  },
  transparency: {
    description: "Made status or progress visible to stakeholders",
    verbs: ["reported", "shared", "communicated", "updated"],
  },
  ownership: {
    description: "Took responsibility and drove work forward",
    verbs: ["owned", "drove", "led", "managed"],
  },
} as const;

export type ImpactTheme = keyof typeof IMPACT_THEMES;

// ============================================
// BANNED VOCABULARY
// ============================================
// These words/phrases claim outcomes the user cannot prove.

export const BANNED_WORDS = [
  // Unverifiable outcome claims
  "winning",
  "won",
  "secured",
  "closed",
  "landed",
  "signed",
  // Hype verbs
  "spearheaded",
  "revolutionized",
  "transformed",
  "disrupted",
  "pioneered",
  "crushed",
  "smashed",
  "nailed",
  // Business outcome claims (unless confirmed)
  "driving growth",
  "increased revenue",
  "boosted sales",
  "grew the business",
  "saved the company",
  "generated leads",
  "expanded market",
  // Emotional/fluffy language
  "delighted",
  "thrilled",
  "excited",
  "passionate",
  "amazing",
  "incredible",
  "game-changing",
  "world-class",
  // Generic fluff
  "build trust",
  "improve productivity",
  "add value",
  "make an impact",
  "move the needle",
  "best practices",
  "synergy",
  "leverage",
  "optimize",
  "streamline",
  // Self-promotional
  "single-handedly",
  "heroically",
  "brilliantly",
  "expertly",
] as const;

export const BANNED_PHRASES = [
  "resulted in significant",
  "led to major improvements",
  "drove substantial growth",
  "delivered exceptional results",
  "exceeded all expectations",
  "transformed the way we",
  "revolutionized our approach",
  "took it to the next level",
  "went above and beyond",
  "knocked it out of the park",
] as const;

// ============================================
// SENIORITY-SPECIFIC VOCABULARY
// ============================================

export interface SeniorityConfig {
  allowedVerbs: readonly string[];
  scopePrefix: string;
  emphasisAreas: readonly string[];
  maxClaimScope: "self" | "team" | "cross-team";
}

export const SENIORITY_CONFIG: Record<BragSeniorityMode, SeniorityConfig> = {
  ic: {
    allowedVerbs: [
      "completed", "delivered", "prepared", "created", "documented",
      "updated", "drafted", "compiled", "organized", "researched",
      "analyzed", "reviewed", "tested", "fixed", "implemented",
    ],
    scopePrefix: "",
    emphasisAreas: ["execution_quality", "clarity", "risk_reduction"],
    maxClaimScope: "self",
  },
  senior: {
    allowedVerbs: [
      "completed", "delivered", "prepared", "created", "documented",
      "coordinated", "facilitated", "mentored", "guided", "established",
      "standardized", "designed", "architected", "led", "owned",
    ],
    scopePrefix: "Owned",
    emphasisAreas: ["standardization", "enablement", "coordination", "ownership"],
    maxClaimScope: "team",
  },
  lead: {
    allowedVerbs: [
      "led", "coordinated", "facilitated", "established", "standardized",
      "aligned", "defined", "shaped", "drove", "managed", "oversaw",
      "sponsored", "championed", "enabled", "structured",
    ],
    scopePrefix: "Led",
    emphasisAreas: ["coordination", "standardization", "predictability", "transparency"],
    maxClaimScope: "cross-team",
  },
} as const;

// ============================================
// WORDING TOGGLE CONFIGURATION
// ============================================

export interface WordingConfig {
  assertivenessLevel: number; // 1-5
  lengthMultiplier: number;
  scopeEscalation: boolean;
  verbStrength: "neutral" | "confident";
  quantifierStyle: "conservative" | "direct";
}

export const WORDING_CONFIG: Record<BragWordingToggle, WordingConfig> = {
  safe: {
    assertivenessLevel: 2,
    lengthMultiplier: 1.0,
    scopeEscalation: false,
    verbStrength: "neutral",
    quantifierStyle: "conservative",
  },
  ambitious: {
    assertivenessLevel: 4,
    lengthMultiplier: 1.2,
    scopeEscalation: true,
    verbStrength: "confident",
    quantifierStyle: "direct",
  },
} as const;

// ============================================
// VALIDATION FUNCTIONS
// ============================================

/**
 * Checks if text contains any banned words or phrases.
 * Returns list of violations found.
 */
export function detectBannedVocabulary(text: string): string[] {
  const lowerText = text.toLowerCase();
  const violations: string[] = [];

  for (const word of BANNED_WORDS) {
    if (lowerText.includes(word.toLowerCase())) {
      violations.push(word);
    }
  }

  for (const phrase of BANNED_PHRASES) {
    if (lowerText.includes(phrase.toLowerCase())) {
      violations.push(phrase);
    }
  }

  return violations;
}

/**
 * Determines confidence level based on outcome confirmations and input richness.
 */
export function calculateConfidence(
  outcomeConfirmations: Record<string, boolean | undefined>,
  stepsCount: number,
  hasTimeSpent: boolean,
  hasNotes: boolean
): "high" | "medium" | "low" {
  const confirmedOutcomes = Object.values(outcomeConfirmations).filter(Boolean).length;

  // High confidence: confirmed outcome + rich input
  if (confirmedOutcomes > 0 && stepsCount >= 3 && hasTimeSpent) {
    return "high";
  }

  // Medium confidence: good input but no confirmed outcomes
  if (stepsCount >= 3 || (hasTimeSpent && hasNotes)) {
    return "medium";
  }

  // Low confidence: sparse input
  return "low";
}

/**
 * Returns the appropriate impact theme based on task category and steps.
 */
export function inferImpactTheme(
  category: string,
  steps: string[]
): ImpactTheme {
  const categoryLower = category.toLowerCase();
  const stepsText = steps.join(" ").toLowerCase();

  // Category-based inference
  if (categoryLower.includes("planning") || categoryLower.includes("preparation")) {
    return "decision_readiness";
  }
  if (categoryLower.includes("delivery") || categoryLower.includes("execution")) {
    return "execution_quality";
  }
  if (categoryLower.includes("communication") || categoryLower.includes("meeting")) {
    return "coordination";
  }
  if (categoryLower.includes("documentation") || categoryLower.includes("writing")) {
    return "clarity";
  }

  // Steps-based inference
  if (stepsText.includes("review") || stepsText.includes("check")) {
    return "risk_reduction";
  }
  if (stepsText.includes("share") || stepsText.includes("update") || stepsText.includes("report")) {
    return "transparency";
  }
  if (stepsText.includes("template") || stepsText.includes("standard")) {
    return "standardization";
  }
  if (stepsText.includes("unblock") || stepsText.includes("help") || stepsText.includes("support")) {
    return "enablement";
  }

  // Default
  return "execution_quality";
}
