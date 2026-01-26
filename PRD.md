# Product Requirements Document: Unplaned

**Version:** 1.0
**Status:** Draft

---

## 1. Executive Summary

### Vision

Unplaned is the anti-productivity tool, a single-task AI focus application that helps people who avoid, overthink, or drop important tasks. While other tools optimize for planning and organization, Unplaned optimizes for **doing**.

### Goals

Reduce task avoidance by helping users complete tasks they would otherwise postpone. Minimize time-to-start so users can begin a focus session quickly. Increase task clarity by providing AI-generated structure instantly. Build completion habits that bring users back.

### Key Differentiators

1. **Single-task focus:** No lists, no inbox, no project views
2. **AI-powered structure:** Automatic breakdown, timing, and purpose
3. **Offline-first:** Works without internet via local LLM (Ollama)
4. **Impulse-friendly:** Start immediately, structure catches up

---

## 2. Problem Statement

### The Planning Trap

Modern productivity tools are built for planning. Todoist wants you to organize tasks into projects, set priorities, schedule dates. Notion wants you to build databases, link pages, create workflows. Calendar apps want you to block time, schedule meetings, plan weeks ahead.

These tools assume users already have clarity. But the hardest tasks aren't hard because they're complex, they're hard to get started because they're **manifolded**.

### The Administrative Sand

Even "simple" tasks hide dozens of micro-steps that seem obvious but still consume time and mental energy:

- Find the correct email thread
- Check all recipients are included
- Verify the attachment is actually attached
- Remember that one detail you meant to mention
- Double-check the tone is appropriate

These small administrative grains of sand accumulate. Each one feels trivial: "check recipients, check the attachment", but together they create massive friction, delay, and the nagging sense that the task is bigger than it looks. This is why a "quick email" takes 20 minutes and why we avoid starting in the first place.

Unplaned makes the invisible visible. The AI breakdown surfaces these micro-steps so you can check them off instead of holding them in your head.

### The Avoidance Pattern

When facing an ambiguous task, users typically:

1. Add it to a todo list (feels productive)
2. Postpone it repeatedly (lacks clarity)
3. Feel guilt about not doing it (erodes motivation)
4. Eventually drop it or rush through it (poor outcome)

### The Core Insight

**Clarity creates momentum. Structure follows action.**

Tasks feel heavy not because they're hard, but because we carry the weight of invisible steps in our heads. Unplaned externalizes that weight. Instead of planning → doing, it reverses the flow: **doing → structure**.

---

## 3. Target Users

### Primary Persona: The Overthinker

This person procrastinates on important but broadly scoped tasks. They use todo apps, but tasks linger for days or weeks. They want to feel productive, not just organized.

### Secondary Personas

**The Busy Professional** has too many demands and can't prioritize. They need AI to scope tasks into 30-minute chunks they can actually commit to.

**The Creative** has ideas flowing but execution stalls. They need structure without killing spontaneity, something that catches them in the moment of motivation.

**The Student** is overwhelmed by assignments. They need clear next steps and time boundaries to make progress feel achievable.

**The Easily-Distracted** struggles with task initiation. They need immediate structure and visible progress, no friction between "I should do this" and "I'm doing this."

### What Users Want

A procrastinator wants to enter a task and get immediate structure so they don't have to figure out how to start. An overwhelmed worker wants to see exactly how long a task will take so they can commit to a bounded session. A distracted person wants one screen with no navigation so they stay focused. A doubt-prone achiever wants to see why the task matters so they stay motivated when it gets hard.

---

## 4. Feature Specifications

### 4.1 Task Input

The input screen has one job: capture the user's intent with zero friction.

A single text field asks "What do you want to do?" No categories, no tags, no project selection. Just type what you want to accomplish in natural language: "Write client email about upcoming event" or "Prepare slides for Monday" and hit Start.

The AI handles ambiguity. If something is too vague, it asks one clarifying question. If it's too big, it suggests scoping down. The goal is to never block the user from starting.

### 4.2 AI Task Breakdown

When the user submits a task, the AI analyzes it and returns three things:

**Subtasks (3–7 steps):** Concrete, actionable steps that start with verbs. "Open email client." "Draft subject line." "Write greeting and context." Each step should be completable in 2–10 minutes. The AI surfaces the administrative sand, the obvious-but-time-consuming steps that users forget to account for.

**Time estimate (15, 30, 45, or 60 minutes):** Realistic, not optimistic. A quick email is 15 minutes. A draft or small research task is 30. A substantial report is 45–60. The AI errs on the side of giving more time, not less.

**Why statement (one line):** A motivational anchor that connects the task to its purpose. "Keep the client informed." "Move the project forward." "Reduce future stress." This stays visible throughout the session to remind users why they started.

Example output:

```text
Task: "Write client email about upcoming event"

Subtasks:
1. Find the email thread with this client
2. Draft the subject line
3. Write greeting and context
4. List key event details (date, time, location)
5. Add clear call-to-action
6. Review for typos and tone
7. Send

Time: 15 min
Why: "Keep the client informed and maintain the relationship"
```

### 4.3 Focus Session

The focus session is one screen, one task, no escape.

The task title sits at the top in large, bold text. Below it, the "why" statement stays visible and highlighted, a constant anchor. On the left, the subtask checklist. On the right, the countdown timer.

Users check off subtasks as they go. Each completed step provides a small dopamine hit. The timer counts down, creating gentle urgency. There's no back button, this is intentional. The point is to stay in the session.

Pause is available but discouraged. If users pause too often, the feature isn't working. Ending early prompts a confirmation ("Are you sure?") and goes to the summary.

### 4.4 Timer

The timer creates bounded commitment. It shows MM:SS in large monospace font, counting down second by second.

Available durations are 15, 30, 45, and 60 minutes. The AI suggests a duration based on the task, but users can adjust before starting. During a session, they can add 15 minutes if needed.

When the timer completes, there's a visual flash and optional chime. The session automatically transitions to the summary screen.

### 4.5 Session Summary

When time is up, users see what they accomplished: "5/6 subtasks completed (83%)."

A simple reflection prompt asks: "Was this session useful?" Three options: Yes, Partially, No. This captures signal without demanding analysis.

Then users choose what's next: start a new task, continue this task with remaining subtasks, or mark it done and return to the input screen.

---

## 5. AI Features

### Task Analysis Engine

The AI needs to understand intent, not just parse words. "Write the email" could mean a quick reply or a complex proposal. "Prepare for Monday" could mean slides, notes, or mental preparation.

The AI should recognize what the user actually wants to accomplish, determine if it fits a 15–60 minute window, and adjust the breakdown style based on the domain (work tasks get more professional language, personal tasks are more casual).

For edge cases: if the input is too vague ("Do work"), prompt for specificity. If it's too large ("Build an app"), suggest focusing on the first concrete step. If it's already clear ("Reply to John's email"), keep the breakdown minimal. If it's non-actionable ("Think about life"), reframe it into actionable steps.

### Local AI with Ollama

Unplaned is offline-first. The AI runs locally using Ollama, so no internet is required after initial setup. If Ollama isn't available, manual mode lets users write their own subtasks.

### AI Behavior

The AI follows a simple principle: break the task into 3–7 actionable subtasks, estimate realistic time (15–60 min), and generate a one-line "why" that anchors motivation. If the task is unclear, it asks one clarifying question before proceeding.

---

## 6. Offline-First Architecture

### Design Principles

All data is stored on the device first. Designed to work offline-first. Cloud sync is an optional enhancement, not a requirement. No data leaves the device unless the user explicitly opts in.

### Data Storage

The app uses three layers:

- **Zustand** for runtime state (current session, UI state)
- **AsyncStorage** for simple settings (theme, sound preferences, default duration)
- **SQLite** for structured session history (used for analytics and improving estimates)

### Future Sync

If cloud sync is added later, data will be encrypted before upload. User accounts will be optional — the app should work perfectly without them.

---

## 7. Technical Requirements

### Platforms

Starting with web, with cross-platform mobile planned. Implementation details may change as the project evolves.

### Tech Stack

TypeScript, React-based framework, local-first storage, Ollama for AI. Standard modern web/mobile stack — nothing exotic.

### Design Goals

The app should feel fast and responsive. Timer accuracy matters. Privacy by default — no analytics without consent, no data leaves device unless user opts in.

---

## 8. UX Design Principles

### Core Principles

**Zero friction:** Remove every unnecessary step. One input field. One button. No onboarding flow.

**Visible progress:** Always show where you are. Timer counting down. Checkmarks appearing. Percentage climbing.

**Anchored purpose:** Keep the "why" visible throughout the session. Always there.

**Intentional constraints:** Limit options to reduce decisions. No settings during a session. No navigation. Just the task.

**Honest defaults:** AI suggestions should be realistic. Better to overestimate time than underestimate. Users should finish early, not feel rushed.

### Key Screens

**Input:** One text field, one button, one question: "What do you want to do?"

**Processing:** Brief loading state while AI generates the breakdown. Shows the task being analyzed.

**Focus Session:** The main event. Task, subtasks, timer, why. Nothing else.

**Summary:** What got done, reflection prompt, what's next.

**Settings:** Theme, sound, AI preferences. Minimal.

---

## 9. Success Metrics

### What We Measure

- **Session completion rate:** Do users finish what they start?
- **Subtask completion:** Is the AI breakdown actually useful?
- **Time to first session:** Is the onboarding frictionless?
- **Return usage:** Do users come back?
- **Usefulness rating:** Do users find sessions valuable?

### What We Don't Optimize

Time in app (more time ≠ more productive), tasks created (lists are the enemy), features used (simplicity is the goal).

---

## 10. Risks and Mitigations

**AI quality is inconsistent.** Poor breakdowns frustrate users. Mitigation: extensive prompt testing with real tasks, always offer manual fallback.

**Ollama setup is too complex.** Users abandon before their first session. Mitigation: clear documentation, manual mode as fallback.

**Timer feels punishing.** Stressed users avoid the app. Mitigation: pause feature exists, copy is encouraging not demanding, time estimates are generous.

**Too simple for power users.** Limited audience. Mitigation: this is intentional. Simplicity is the feature, not a limitation.

**Scope creep.** Product becomes another todo app. Mitigation: strict "non-features" list, say no often, remember the vision.

---

## 11. Competitive Analysis

### Direct Competitors

**Forest** gamifies focus with timers and tree-growing mechanics. It's fun and social, but provides no task structure. Users still have to figure out what to do during the session.

**Focus@Will** provides ambient music for concentration. Great for the environment, but no task tracking. It helps you focus but doesn't help you know what to focus on.

**Centered** is an AI coach for focus sessions. Sophisticated, but complex and subscription-based. Unplaned is simpler and works offline.

### Indirect Competitors

**Todoist** captures tasks well but doesn't help you do them. You end up with a long list of things you're avoiding.

**Notion** does everything, which means it's 100x more complex than necessary for someone who just wants to finish one task.

**Pomodoro apps** have timers but no AI structure. You still need to break down the task yourself.

**Bullet journaling** is simple but analog. Unplaned brings the same philosophy to digital with AI assistance.

### Our Position

Unplaned sits at the intersection of high structure (AI breakdown) and high focus (single-task mode). Forest has focus but no structure. Notion has structure but no focus. We do both.

---

## 12. Open Questions

**Should users edit AI subtasks?** Yes makes it flexible, No keeps it simple. Middle ground: add/remove only.

**What if a task is bigger than 60 minutes?** Options: always scope down, allow longer sessions, or split into multiple sessions.

**Should we save session history?** History enables patterns but staying ephemeral matches "no lists" philosophy. Could be optional.

---

## 13. Appendix

### Glossary

**Session:** One complete cycle from input through breakdown, focus, and summary.

**Subtask:** An AI-generated actionable step within a task.

**Why statement:** The one-line purpose that anchors motivation.

**Ollama:** Open-source local LLM runtime that enables offline AI.

**Administrative sand:** The small, obvious-but-time-consuming steps that accumulate and make tasks feel bigger than they are.
