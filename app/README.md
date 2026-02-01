# Unplaned

A focus-first task management app that helps you work on one task at a time. Instead of endless planning, Unplaned emphasizes **doing** - breaking tasks into actionable steps and tracking progress through focused sessions.

## Why Unplaned?

Most task apps encourage you to plan endlessly. Unplaned takes a different approach:

- **One task at a time** - Resist the urge to multitask
- **AI-powered breakdown** - Let AI help split tasks into 15-60 minute focused sessions
- **Actionable steps** - Each step has a clear CTA, deliverable, and reason
- **Local-first** - Your data stays on your machine, works offline

## Features

### Task Creation

Enter a task description and let AI break it down into actionable steps with time estimates.

```text
"Prepare quarterly report" →
  1. Gather data from dashboard (~10min)
  2. Create summary charts (~15min)
  3. Write executive summary (~20min)
  4. Send to stakeholders (~5min)
```

### Brain Dump

Bulk add tasks from a brain dump or existing todo list:

1. Click "Brain Dump" (yellow button on home page)
2. Paste your raw todo list (example below)
3. AI parses and cleans up each task
4. Preview with suggested durations and tags
5. Edit titles/durations as needed
6. Click "Create N Tasks" - each gets full AI breakdown

Example input:

```text
* Write blog post about frameworks
* Email contractor about window replacement
* Plan next week based on calendar
* Read for 30 minutes
* Learn about AI agents - watch YouTube videos
```

Works with bullets (`*`, `-`), numbered lists, or plain text. Falls back to simple parsing if AI is unavailable.

### Focus Mode

Full-screen distraction-free mode with:

- Countdown timer based on your estimate
- Step-by-step progress tracking
- Per-step time tracking
- Motivational "why" statements
- Visual progress indicators

### AI Analysis

Click "Analyze" to get AI-powered suggestions:

- Time estimates for each step
- Missing critical steps
- Complex steps that should be separate tasks
- "Done means" - what makes the task truly complete

### 2nd Opinion

Get a second opinion from external AI (ChatGPT, You.com, Perplexity, DeepSeek):

1. Click icon to copy **anonymized** task prompt (names/entities removed)
2. Paste into your preferred AI
3. Paste the response back
4. Review suggestions in side-by-side comparison
5. Toggle individual changes and apply selected

**Privacy**: Your data stays local - only 2nd opinion sends anonymized data externally.

### Template Library

Save frequently-used task breakdowns as templates:

- Reuse proven workflows
- Quick task creation from templates
- Track template usage

### Brag List

Track your accomplishments for performance reviews:

- AI-generated value statements for each completed task
- Executive-ready language focused on organizational impact
- STAR method grouping (Situation, Task, Action, Result)
- Edit, delete, and regenerate entries
- Export to markdown file for sharing
- Groups similar tasks into single entries

### Task Kanban

Visual overview of all tasks:

- **Backlog** - Tasks waiting to be started
- **In Progress** - Active focus sessions
- **Done** - Completed tasks

## Getting Started

### Prerequisites

- Node.js 18+
- [Ollama](https://ollama.ai/) running locally with `llama3` model

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/unplaned.git
cd unplaned/app

# Install dependencies
npm install

# Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Setting Up Ollama

1. Install Ollama from [ollama.ai](https://ollama.ai/)
2. Pull the llama3 model:
   ```bash
   ollama pull llama3
   ```
3. Ollama runs automatically on `http://localhost:11434`

### Environment Variables (Optional)

Create a `.env.local` file to customize:

```env
# Use a different Ollama URL
OLLAMA_URL=http://localhost:11434

# Use a different model
OLLAMA_MODEL=llama3
```

## How to Use

### Creating a Task

1. Type your task in the input box (e.g., "Write blog post about productivity")
2. Press Enter or click "Go"
3. AI generates subtasks with time estimates
4. Adjust duration (15/30/45/60 min) if needed
5. Click "Start Focus" to begin

### During a Focus Session

1. See your current step highlighted
2. Timer counts down from your estimate
3. Click a step to mark it "in progress" (highlighted)
4. Click again to mark it "complete" (checked)
5. Move through steps until done
6. Timer turns red if you go overtime

### Getting AI Help

**Analyze** - Review your breakdown:

- Click "Analyze" on any task card
- Review AI suggestions in the side-by-side panel
- Toggle individual changes on/off
- Click "Apply Selected" to accept

**2nd Opinion** - External AI consultation:

- Click "2nd Opinion" on any task card
- Copy the anonymized prompt
- Paste into ChatGPT/Claude/etc.
- Copy the response
- Paste back and click "Apply"

### Saving Templates

1. Complete a task or create a good breakdown
2. Click "Save as Template"
3. Template appears in the Template Library
4. Use "Use Template" to create new tasks

## Project Structure

```
app/
├── app/
│   ├── page.tsx              # Landing page
│   ├── help/                 # Help page
│   ├── overview/             # Task Kanban
│   ├── templates/            # Template Library
│   ├── brag/                 # Brag List (achievements)
│   ├── focus/[sessionId]/    # Focus session
│   ├── api/                  # API routes
│   │   ├── tasks/            # Task CRUD
│   │   ├── breakdown/        # AI breakdown
│   │   ├── elaborate/        # AI analysis
│   │   ├── refine/           # AI refinement
│   │   ├── value-statement/  # AI value statements
│   │   ├── brag/             # AI brag list generation
│   │   └── ...
│   ├── components/           # React components
│   └── lib/
│       ├── types.ts          # TypeScript types
│       ├── storage.ts        # JSON file storage
│       ├── ollama.ts         # Ollama client
│       └── prompts.ts        # AI prompts
├── data/
│   ├── tasks.json            # Data store
│   ├── templates.json        # Task templates
│   └── hints.json            # UI tips
└── docs/                     # Documentation
```

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Storage**: JSON file (local-first)
- **AI**: Ollama (local LLM)
- **Styling**: CSS Modules + inline styles

## Documentation

- [DESIGN.md](docs/DESIGN.md) - Architecture and design decisions
- [CHANGELOG.md](docs/CHANGELOG.md) - Version history
- [STRATEGY.md](docs/STRATEGY.md) - Product roadmap
- [api-routes.md](docs/api-routes.md) - API architecture guide
- [subtask-framework.md](docs/subtask-framework.md) - CTA/Deliverable/SoWhat framework
- [brag-generator.md](docs/brag-generator.md) - Credibility-focused brag list generator

## Contributing

Contributions welcome! Please read the design docs before submitting PRs.

## License

MIT
