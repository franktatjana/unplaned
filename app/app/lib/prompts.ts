/**
 * Prompt Management Module
 *
 * This module provides all AI prompts used throughout Unplaned.
 * Prompts are organized into two categories:
 *
 * 1. **JSON-based prompts** (data/prompts.json)
 *    - Used for initial task breakdown and core features
 *    - Loaded once and cached for performance
 *    - Support template variables with {{variable}} syntax
 *
 * 2. **Inline prompts** (this file)
 *    - Used for elaborate, refine, and evaluate operations
 *    - Defined as functions for easier maintenance
 *    - Include the CTA/Deliverable/SoWhat framework
 *
 * @module lib/prompts
 * @see docs/subtask-framework.md for CTA/Deliverable/SoWhat documentation
 */

import { readFileSync } from "fs";
import { join } from "path";
import type { BragSeniorityMode, BragWordingToggle, BragGeneratorInput } from "./types";
import {
  SENIORITY_CONFIG,
  WORDING_CONFIG,
  BANNED_WORDS,
  BANNED_PHRASES,
  IMPACT_THEMES,
} from "./brag-vocabulary";

// ============================================
// Types for JSON-based Prompts
// ============================================

/**
 * Configuration for a single prompt with system and template parts
 */
interface PromptConfig {
  /** System prompt - sets the AI's role/persona */
  system: string;
  /** Template with {{variable}} placeholders */
  template: string;
}

/**
 * Structure of the prompts.json file
 */
interface PromptsData {
  /** Guidelines for generating "core why" statements */
  coreWhyStyle: string;
  /** Allowed tags for task categorization */
  allowedTags: string[];
  /** Policy for handling deadlines */
  deadlinePolicy: string;
  /** CTA brevity rules */
  ctaRules: string;
  /** Deliverable brevity rules */
  deliverableRules: string;
  /** SoWhat brevity rules */
  soWhatRules: string;
  /** Initial task breakdown prompt */
  generateBreakdownCore: PromptConfig;
  /** Task metadata generation prompt */
  generateMetadata: PromptConfig;
  /** Step refinement prompt */
  refineBreakdown: PromptConfig;
  /** Text polishing/cleanup prompt */
  polishText: PromptConfig;
  /** Time re-estimation prompt */
  reestimateTime: PromptConfig;
  /** Breakdown validation prompt */
  validateBreakdown: PromptConfig;
  /** Elaborate/analyze prompt */
  elaborate: PromptConfig;
  /** Clarification prompt */
  clarification: PromptConfig;
  /** External AI merge prompt */
  refineExternal: PromptConfig;
  /** Template evaluation prompt */
  evaluateTemplate: PromptConfig;
  /** Value statement prompt */
  valueStatement: PromptConfig;
}

// ============================================
// JSON Prompt Loading
// ============================================

/** Cached prompts data - loaded once on first use */
let cachedPrompts: PromptsData | null = null;

/**
 * Loads prompts from data/prompts.json with caching.
 * The file is read from disk only once per server lifetime.
 *
 * @returns Parsed prompts data
 * @throws Error if file cannot be read or parsed
 */
export function loadPrompts(): PromptsData {
  if (cachedPrompts) return cachedPrompts;

  const filePath = join(process.cwd(), "data", "prompts.json");
  const content = readFileSync(filePath, "utf-8");
  cachedPrompts = JSON.parse(content) as PromptsData;
  return cachedPrompts;
}

/**
 * Renders a template string by replacing {{variable}} placeholders.
 *
 * @param template - Template string with {{variable}} placeholders
 * @param variables - Key-value pairs for replacement
 * @returns Rendered string with all variables replaced
 *
 * @example
 * renderTemplate("Hello {{name}}!", { name: "World" })
 * // Returns: "Hello World!"
 */
export function renderTemplate(template: string, variables: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    // Escape special regex characters in key, match {{key}}
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
  }
  return result;
}

// ============================================
// Motivation Personalities
// ============================================

/**
 * Personality styles for generating motivational "why" statements.
 * Each personality provides a different tone for task motivation.
 *
 * Used in task breakdown to generate personalized encouragement.
 */
export const PERSONALITY_STYLES: Record<string, { name: string; style: string; example: string }> = {
  /** Calm, philosophical wisdom inspired by Marcus Aurelius */
  stoic: {
    name: "Stoic",
    style: "Like Marcus Aurelius - calm, philosophical, focused on what's in your control. Brief and wise.",
    example: "This is within your control. Act on it.",
  },
  /** Encouraging and supportive, like a sports coach */
  coach: {
    name: "Coach",
    style: "Like an encouraging sports coach - energetic, supportive, believes in you. Motivating but not cheesy.",
    example: "You've got this! Let's make it happen.",
  },
  /** Direct and discipline-focused, no-nonsense approach */
  drill: {
    name: "Drill Sergeant",
    style: "Like a firm but fair drill sergeant - direct, no excuses, discipline-focused. Short and commanding.",
    example: "No excuses. Execute now.",
  },
  /** Warm and conversational, like a supportive friend */
  friend: {
    name: "Friend",
    style: "Like a supportive friend over coffee - warm, understanding, gentle nudge. Conversational.",
    example: "Hey, let's knock this out together.",
  },
};

// ============================================
// JSON-based Prompt Accessors
// ============================================

/**
 * Gets the task breakdown prompt with personality and variables filled in.
 *
 * @param task - The task description to break down
 * @param personality - Motivation style (stoic, coach, drill, friend)
 * @returns Rendered prompt ready for LLM
 */
export function getBreakdownPrompt(task: string, personality: string = "coach"): string {
  const prompts = loadPrompts();
  const style = PERSONALITY_STYLES[personality] || PERSONALITY_STYLES.coach;

  return renderTemplate(prompts.generateBreakdownCore.template, {
    task,
    personalityName: style.name,
    personalityStyle: style.style,
    personalityExample: style.example,
    coreWhyStyle: prompts.coreWhyStyle,
  });
}

/** Gets the system prompt for task breakdown */
export function getBreakdownSystemPrompt(): string {
  const prompts = loadPrompts();
  return prompts.generateBreakdownCore.system;
}

/**
 * Gets the validation prompt to check breakdown quality.
 *
 * @param task - The task description
 * @param subtasks - Array of subtask texts
 * @param duration - Estimated duration in minutes
 * @returns Rendered prompt
 */
export function getValidatePrompt(task: string, subtasks: string[], duration: number): string {
  const prompts = loadPrompts();
  return renderTemplate(prompts.validateBreakdown.template, {
    task,
    subtasks: subtasks.map((s, i) => `${i + 1}. ${s}`).join("\n"),
    duration: String(duration),
  });
}

/** Gets the system prompt for validation */
export function getValidateSystemPrompt(): string {
  const prompts = loadPrompts();
  return prompts.validateBreakdown.system;
}

/**
 * Gets the time re-estimation prompt.
 *
 * @param task - The task description
 * @param subtasks - Array of subtask texts
 * @returns Rendered prompt
 */
export function getReestimatePrompt(task: string, subtasks: string[]): string {
  const prompts = loadPrompts();
  return renderTemplate(prompts.reestimateTime.template, {
    task,
    subtasks: subtasks.map((s, i) => `${i + 1}. ${s}`).join("\n"),
  });
}

/** Gets the system prompt for re-estimation */
export function getReestimateSystemPrompt(): string {
  const prompts = loadPrompts();
  return prompts.reestimateTime.system;
}

/**
 * Gets the text polishing prompt for cleaning up user input.
 *
 * @param text - Raw text to polish
 * @returns Rendered prompt
 */
export function getPolishPrompt(text: string): string {
  const prompts = loadPrompts();
  return renderTemplate(prompts.polishText.template, { text });
}

/** Gets the system prompt for text polishing */
export function getPolishSystemPrompt(): string {
  const prompts = loadPrompts();
  return prompts.polishText.system;
}

// ============================================
// JSON-based Prompt Builders for API Routes
// ============================================
// These prompts are now loaded from data/prompts.json for easier maintenance.
// They implement the CTA/Deliverable/SoWhat framework for actionable subtasks.
// See docs/subtask-framework.md for detailed documentation.

/**
 * Builds the elaborate/analyze prompt for reviewing task breakdowns.
 * Loads from data/prompts.json and renders with provided variables.
 *
 * @param task - The task description
 * @param subtasksList - Numbered list of subtasks as string
 * @param contextSection - Optional additional context from user
 * @returns Complete prompt ready for LLM
 */
export function buildElaboratePrompt(
  task: string,
  subtasksList: string,
  contextSection: string = ""
): string {
  const prompts = loadPrompts();
  return renderTemplate(prompts.elaborate.template, {
    task,
    subtasksList,
    contextSection: contextSection ? `\nContext: ${contextSection}\n` : "",
    ctaRules: prompts.ctaRules,
    deliverableRules: prompts.deliverableRules,
    soWhatRules: prompts.soWhatRules,
  });
}

/** Gets the system prompt for elaborate/analyze */
export function getElaborateSystemPrompt(): string {
  const prompts = loadPrompts();
  return prompts.elaborate.system;
}

/**
 * Builds the clarification prompt to determine if more context is needed.
 * Loads from data/prompts.json.
 *
 * @param task - The task description
 * @param subtasksList - Numbered list of subtasks as string
 * @returns Prompt for clarification assessment
 */
export function buildClarificationPrompt(task: string, subtasksList: string): string {
  const prompts = loadPrompts();
  return renderTemplate(prompts.clarification.template, {
    task,
    subtasksList,
  });
}

/**
 * Builds the refine prompt for merging external AI suggestions.
 * Loads from data/prompts.json.
 *
 * @param originalTask - The task description
 * @param originalSubtasks - Array of current subtask texts
 * @param externalResponse - Raw text from external AI
 * @param currentDuration - Current time estimate in minutes
 * @returns Prompt for refinement
 */
export function buildRefinePrompt(
  originalTask: string,
  originalSubtasks: string[],
  externalResponse: string,
  currentDuration: number
): string {
  const prompts = loadPrompts();
  const subtasksList = (originalSubtasks || [])
    .map((st: string, i: number) => `${i + 1}. ${st}`)
    .join("\n") || "(none)";

  return renderTemplate(prompts.refineExternal.template, {
    originalTask,
    subtasksList,
    currentDuration: String(currentDuration || 15),
    externalResponse,
  });
}

/** Gets the system prompt for external refine */
export function getRefineExternalSystemPrompt(): string {
  const prompts = loadPrompts();
  return prompts.refineExternal.system;
}

/**
 * Builds the template evaluation prompt.
 * Loads from data/prompts.json.
 *
 * @param taskName - The task description
 * @param subtasks - Array of subtask texts
 * @returns Prompt for template evaluation
 */
export function buildEvaluateTemplatePrompt(taskName: string, subtasks: string[]): string {
  const prompts = loadPrompts();
  const subtasksList = subtasks.map((st, i) => `${i + 1}. ${st}`).join("\n");

  return renderTemplate(prompts.evaluateTemplate.template, {
    taskName,
    subtasksList,
  });
}

/** Gets the system prompt for template evaluation */
export function getEvaluateTemplateSystemPrompt(): string {
  const prompts = loadPrompts();
  return prompts.evaluateTemplate.system;
}

// ============================================
// Brag List / Performance Review Prompts (v2 - Credibility-focused)
// ============================================

/**
 * Builds the credibility-focused brag list prompt.
 *
 * Key differences from v1:
 * - Only claims what user controlled (quality, clarity, risk reduction)
 * - Never fabricates metrics or claims external outcomes
 * - Adapts language based on seniority level and wording toggle
 *
 * @param completedTasks - Array of completed task data
 * @param mode - User seniority (ic, senior, lead)
 * @param wording - Wording style (safe, ambitious)
 * @returns Prompt for brag list generation
 */
export function buildBragListPrompt(
  completedTasks: Array<{
    text: string;
    completedAt: string;
    subtaskCount: number;
    totalMinutes: number;
    coreWhy: string;
    outcomeConfirmations?: Record<string, boolean>;
  }>,
  mode: BragSeniorityMode = "ic",
  wording: BragWordingToggle = "safe"
): string {
  const seniorityConfig = SENIORITY_CONFIG[mode];
  const wordingConfig = WORDING_CONFIG[wording];

  const tasksList = completedTasks.map((t, i) => {
    const date = new Date(t.completedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const confirmations = t.outcomeConfirmations
      ? Object.entries(t.outcomeConfirmations)
          .filter(([, v]) => v)
          .map(([k]) => k)
          .join(", ") || "none"
      : "none";
    return `${i + 1}. "${t.text}" (${date}, ${t.subtaskCount} steps, ~${t.totalMinutes}min)
   Context: ${t.coreWhy || "Task completed"}
   Confirmed outcomes: ${confirmations}`;
  }).join("\n\n");

  const allowedVerbsList = seniorityConfig.allowedVerbs.join(", ");
  const bannedWordsList = BANNED_WORDS.slice(0, 15).join(", ");
  const impactThemesList = Object.keys(IMPACT_THEMES).join(", ");

  const assertivenessNote = wordingConfig.assertivenessLevel >= 4
    ? "Use confident framing. Emphasize scope and ownership where accurate."
    : "Use neutral, factual framing. Avoid superlatives.";

  const scopeNote = mode === "lead"
    ? "You may reference cross-team coordination or organizational scope."
    : mode === "senior"
    ? "You may reference team-level scope and mentoring."
    : "Keep scope to individual contributions only.";

  return `You are a Performance Review Assistant that produces CREDIBLE, NON-FLUFFY achievement statements.

**SENIORITY LEVEL:** ${mode.toUpperCase()}
**WORDING STYLE:** ${wording.toUpperCase()}

**MY COMPLETED TASKS:**
${tasksList}

**YOUR TASK:**
Convert these into professional achievement statements that:
1. Describe what I CONTROLLED: quality, clarity, readiness, risk reduction, execution, enablement
2. NEVER claim external outcomes unless explicitly marked as "confirmed"
3. Are short and copy-pasteable

**ALLOWED VERBS (use only these):**
${allowedVerbsList}

**BANNED WORDS (never use):**
${bannedWordsList}

**IMPACT THEMES (frame achievements around these):**
${impactThemesList}

**TONE RULES:**
- ${assertivenessNote}
- ${scopeNote}
- Never fabricate metrics. If time was spent, mention effort, not savings.
- If task is generic (e.g., "Process inbox"), keep claims narrow.

**CONFIDENCE SCORING:**
- "high": Confirmed outcome + rich input (3+ steps, time tracked)
- "medium": Good input but no confirmed outcome
- "low": Sparse input or generic task

**REPLY WITH ONLY THIS JSON:**
{
  "entries": [
    {
      "title": "Short headline (5-10 words)",
      "bullet": "[Verb] + [what you did] + [internal impact]",
      "metrics": "Only mention effort invested, NOT fabricated savings",
      "category": "Primary category (Delivery | Planning | Communication | Operations | Leadership)",
      "tags": ["DELIVERY", "PLANNING", "etc - 1-3 relevant tags from: DELIVERY, PLANNING, COMMUNICATION, OPERATIONS, LEADERSHIP, ANALYSIS, DOCUMENTATION, COORDINATION"],
      "overallImpact": "1-2 sentences describing the cumulative value of this entry",
      "taskIds": [1, 2],
      "frequency": "Recurring | One-time | Daily practice",
      "confidence": "high | medium | low"
    }
  ],
  "summary": {
    "totalTasks": ${completedTasks.length},
    "totalTimeInvested": "sum of minutes as hours",
    "topCategory": "most common category",
    "overallImpact": "1 sentence about execution quality, NOT business outcomes"
  }
}

**CRITICAL RULES:**
1. GROUP similar tasks - maximum 5-7 entries
2. NEVER use: ${BANNED_PHRASES.slice(0, 5).join(", ")}
3. Focus on WHAT YOU DID, not what supposedly happened as a result
4. Keep bullets under 15 words
5. If no outcome is confirmed, use phrases like "prepared", "enabled", "reduced risk of"

JSON response:`;
}

/**
 * System prompt for the credibility-focused brag list assistant.
 */
export function getBragListSystemPrompt(
  mode: BragSeniorityMode = "ic",
  wording: BragWordingToggle = "safe"
): string {
  const modeDescriptions: Record<BragSeniorityMode, string> = {
    ic: "individual contributor focusing on personal execution quality",
    senior: "senior professional who may reference team impact and standardization",
    lead: "team lead who may reference cross-functional coordination and organizational scope",
  };

  const wordingDescriptions: Record<BragWordingToggle, string> = {
    safe: "conservative, factual, and defensible",
    ambitious: "confident and assertive while remaining accurate",
  };

  return `You are a Performance Review Assistant that produces CREDIBLE achievement statements.

Your role: Writing for a ${modeDescriptions[mode]}.
Your style: ${wordingDescriptions[wording]}.

STRICT RULES:
1. Never claim outcomes you cannot prove (no "won", "secured", "drove growth")
2. Never fabricate metrics (no "saved X hours" unless explicitly provided)
3. Focus on what the person CONTROLLED: quality, preparation, clarity, risk reduction
4. Use neutral corporate language, no hype words
5. If unsure about impact, describe the ACTION and EFFORT, not the result

BANNED VOCABULARY (regenerate if you use these):
- Hype verbs: spearheaded, revolutionized, transformed, crushed, nailed
- Unverifiable outcomes: winning, secured, closed, landed
- Fluffy phrases: build trust, move the needle, game-changing, world-class
- Business claims (unless confirmed): drove growth, increased revenue, generated leads

ALLOWED IMPACT THEMES:
- clarity, risk_reduction, decision_readiness, predictability
- coordination, execution_quality, enablement, standardization
- transparency, ownership

Always respond with valid JSON only.`;
}

/**
 * Builds a single-entry brag prompt for one task with full input schema.
 * Used for real-time generation when user completes a task.
 */
export function buildSingleBragPrompt(input: BragGeneratorInput): string {
  const { task_title, steps, time_spent_minutes, category_tag, user_role_mode, wording_toggle, outcome_confirmations, optional_notes } = input;

  const seniorityConfig = SENIORITY_CONFIG[user_role_mode];
  const wordingConfig = WORDING_CONFIG[wording_toggle];

  const confirmedOutcomes = Object.entries(outcome_confirmations)
    .filter(([, v]) => v)
    .map(([k]) => k.replace(/_/g, " "));

  const stepsFormatted = steps.map((s, i) => `  ${i + 1}. ${s}`).join("\n");
  const timeNote = time_spent_minutes ? `Time invested: ~${time_spent_minutes} minutes` : "Time: not tracked";
  const confirmationsNote = confirmedOutcomes.length > 0
    ? `CONFIRMED OUTCOMES: ${confirmedOutcomes.join(", ")}`
    : "NO CONFIRMED OUTCOMES - do not claim external results";

  const assertiveness = wordingConfig.assertivenessLevel >= 4
    ? "Be confident and assertive in framing."
    : "Be factual and conservative.";

  return `Generate an IMPACT-FOCUSED brag entry for this completed task.

**TASK:** ${task_title}
**CATEGORY:** ${category_tag}
**STEPS COMPLETED:**
${stepsFormatted}
${timeNote}
${optional_notes ? `NOTES: ${optional_notes}` : ""}

${confirmationsNote}

**SENIORITY:** ${user_role_mode.toUpperCase()}
**WORDING:** ${wording_toggle.toUpperCase()} - ${assertiveness}

**ALLOWED VERBS:** ${seniorityConfig.allowedVerbs.slice(0, 10).join(", ")}

**OUTPUT FORMAT (JSON only):**
{
  "headline": "5-10 word outcome-focused title (what was achieved, not what was done)",
  "impact_sentence": "Start with OUTCOME, not action. Format: [Result achieved] by/through [mechanism]",
  "scope_context": "Optional: team/project context if relevant, or empty string",
  "evidence": ["1-3 bullets showing OUTCOMES from steps, not the steps themselves"],
  "confidence": "high|medium|low",
  "disallowed_claims": ["claims you avoided, or empty array"],
  "copy_text": "Final 2-3 line impact statement ready for performance review"
}

**CRITICAL RULES:**
1. NEVER describe what you did - describe what RESULTED from it
2. NEVER use first person ("I", "my", "we")
3. NEVER use vague impact words ("ensuring", "helping", "supporting")
4. START with measurable outcome: numbers, time saved, risk prevented, decisions enabled
5. ${confirmedOutcomes.length > 0 ? `You MAY reference confirmed outcomes: ${confirmedOutcomes.join(", ")}` : "Do NOT claim any external outcome"}
6. Keep copy_text under 50 words, outcome-first structure

**EXAMPLES:**
BAD copy_text: "I prepared the Q2 proposal, ensuring clear communication with stakeholders."
GOOD copy_text: "De-risked Q2 revenue by front-loading decision criteria. Stakeholders unblocked to approve budget without follow-up cycles."

BAD copy_text: "Created documentation for the new feature to help the team."
GOOD copy_text: "Freed senior dev capacity by enabling self-serve onboarding. New team members now productive in hours instead of days."

BAD copy_text: "Zero inbox achieved through efficient email management process."
GOOD copy_text: "Recovered 2+ hours of focus time by eliminating notification debt. Decision backlog cleared, no pending blockers for stakeholders."

JSON response:`;
}

/**
 * System prompt for single brag entry generation.
 */
export function getSingleBragSystemPrompt(
  mode: BragSeniorityMode,
  wording: BragWordingToggle
): string {
  const assertiveness = wording === "ambitious"
    ? "confident but accurate"
    : "conservative and defensible";

  const scopeRules: Record<BragSeniorityMode, string> = {
    ic: "Keep scope to your individual work. No team-level claims.",
    senior: "You may reference team enablement and standardization efforts.",
    lead: "You may reference cross-team coordination and organizational scope.",
  };

  return `You generate BUSINESS VALUE statements for performance reviews. Frame everything in terms of organizational impact, not task completion.

ROLE: ${mode.toUpperCase()} contributor
STYLE: ${assertiveness}

${scopeRules[mode]}

**BUSINESS VALUE THEMES (frame outcomes using these):**
- Execution velocity: faster decisions, reduced cycle time
- Focus preservation: protected deep work, reduced context switching
- Reliability: consistent delivery, predictable output
- Stakeholder impact: unblocked teams, enabled decisions
- Strategic capacity: freed time for high-value work
- Operational efficiency: reduced overhead, streamlined workflows

**CRITICAL RULES:**
- NEVER start with "I" or describe task activity
- NEVER use process words (achieved, completed, managed, organized)
- ALWAYS frame as BUSINESS OUTCOME for stakeholders
- Include numbers when possible: time saved, decisions enabled, people unblocked

**BANNED PATTERNS:**
- "Zero inbox achieved..." → Instead: "Recovered focus time by eliminating decision backlog"
- "Prepared/created/organized..." → Instead: "Accelerated/Enabled/Unblocked..."
- "Ensuring/helping/supporting..." → Instead: "De-risked/Preserved/Protected..."

**BANNED WORDS:** achieved, completed, managed, organized, ensuring, helping, supporting, process

**USE BUSINESS VERBS:** accelerated, de-risked, unblocked, preserved, protected, enabled, recovered, freed

**FORMULA:** [Business verb] + [stakeholder/resource] + [by/through] + [value delivered]

Example transformations:
- ❌ "I prepared meeting materials for clear communication"
- ✅ "Enabled 30-minute decision in 2-hour meeting through pre-aligned agenda"

- ❌ "Drafted proposal ensuring stakeholder alignment"
- ✅ "Unlocked $50K budget approval by addressing all decision criteria upfront"

Respond with valid JSON only.`;
}

/**
 * Builds a prompt for generating a value statement from a completed task.
 * Loads from data/prompts.json.
 *
 * @param task - The completed task text
 * @returns Formatted prompt for value statement generation
 */
export function buildValueStatementPrompt(task: string): string {
  const prompts = loadPrompts();
  return renderTemplate(prompts.valueStatement.template, { task });
}

/**
 * System prompt for generating executive-ready value statements.
 * Loads from data/prompts.json.
 */
export function getValueStatementSystemPrompt(): string {
  const prompts = loadPrompts();
  return prompts.valueStatement.system;
}
