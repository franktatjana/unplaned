# Unplaned

> **Prototype. Local-first. No production guarantees.**

## Why “Unplaned”?

In woodworking, unplaned wood is raw, it’s uneven, unfinished. You work with the grain, shape it, and apply a finish when it’s ready.

Tasks often start the same way: they don’t arrive as clean plans, usually start as rough thoughts, half-formed intentions. When you try to force "done" too early, things stall, split.

Unplaned is built for that stage: it helps you take a raw task, follow its natural flow, shape it into clear steps, and bring it to a finished state.


## What is this?

**Unplaned** is a single-task AI focus tool for people who avoid, overthink, or drop important tasks. You enter a task, something you actually want to get done, and the tool helps you break it down, reconnect with why it matters, and stay with it long enough to finish.

Instead of juggling todo lists, Unplaned gives you one clear screen: your task, a checklist of subtasks, a countdown timer, and your reason for doing it.

## Why does this exist?

Most tools are built for planning not for doing. They assume you already know how to tackle the task, how long it'll take, and why you even started. But in practice, we stall, tasks get blurred, energy drops. The "why" gets buried under meetings, messages, options of implementation, and mental noise.

Unplaned flips the flow: you act first and the structure catches up. It's not about tracking your week but about making **this one task** finishable, now.

## How does it work?

You type in a task:
`Write client email about upcoming event`

Unplaned:

- Uses AI to break it down into 3–7 subtasks
- Estimates how long it should take
- Suggests a one-line "why" based on your (even imaginary) goal
- Starts a countdown timer so you stay in it

You check off subtasks as you go. When time's up, you get a simple summary: what's done, what's left, and whether it was worth it.

## Features

- **Input → Output**: enter any task, get AI-generated subtasks, estimate, and purpose
- **Single-task mode**: one screen, one task, no switching, no inboxes
- **Timer**: 15–60 min countdown with visual progress
- **Why reminder**: your purpose stays visible to keep you anchored
- **Progress tracking**: see time estimates vs actual time per subtask
- **Task Kanban**: three-column board (Backlog / In Progress / Done)
- **Template Library**: save and reuse task breakdowns
- **Step details**: CTA (what to do first), Deliverable (proof of done), SoWhat (pain avoided)
- **Definition of done**: track ripple effects beyond core task (notify, log, follow-up)
- **Motivation personalities**: choose your style - Stoic, Coach, Drill, or Friend
- **AI analysis**: enrich steps with CTAs, deliverables, and completion criteria
- **Sample data**: try the app with pre-loaded example tasks

## The Mantra

**"If it's worth starting, it's worth finishing."**
**"Structure follows impulse."**

Unplaned doesn't ask for your productivity philosophy. It just helps you get through the next 30-60 minutes with clarity, structure, and intention.

## How to Run

```bash
cd app
npm install
npm run dev
```

Open <http://localhost:3000>

For AI features (task breakdown), install [Ollama](https://ollama.ai):

```bash
ollama serve
ollama pull llama3
```

The app works fully offline. All data stays on your machine - no accounts, no cloud sync.

## Project Structure

```text
unplaned/
├── README.md           # This file
├── PRD.md              # Product requirements
├── LICENSE
└── app/                # Next.js 14 application
    ├── app/
    │   ├── page.tsx        # Home (task input + list)
    │   ├── overview/       # Task Kanban (3-column board)
    │   ├── templates/      # Template Library
    │   ├── focus/          # Focus session
    │   ├── help/           # How to use
    │   ├── api/            # API routes
    │   ├── components/     # React components
    │   └── lib/            # Types, storage, actions
    └── data/               # JSON storage (local-first)
```

## License

MIT License - see [LICENSE](LICENSE) for details.
