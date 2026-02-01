import { getTasks, getSessions } from "./lib/storage";
import TaskInput from "./components/TaskInput";
import TaskList from "./components/TaskList";
import NavSection from "./components/NavSection";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [tasks, sessions] = await Promise.all([getTasks(), getSessions()]);

  // Get active sessions (those without completedAt)
  const activeSessions = sessions.filter(s => !s.completedAt);

  return (
    <main style={styles.main}>
      <header style={styles.header}>
        <h1 style={styles.title}>Unplaned</h1>
        <p style={styles.subtitle}>One task at a time. Focus. Finish.</p>
      </header>

      <section style={styles.content}>
        <TaskInput />
        <NavSection />
        <TaskList tasks={tasks} activeSessions={activeSessions} />
      </section>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  main: {
    maxWidth: "640px",
    margin: "0 auto",
    padding: "2rem 1.5rem 1rem 1.5rem",
  },
  header: {
    marginBottom: "1.5rem",
    textAlign: "center",
  },
  title: {
    fontSize: "2rem",
    fontWeight: 700,
    color: "var(--fg-primary)",
    margin: 0,
  },
  subtitle: {
    fontSize: "1rem",
    color: "var(--fg-muted)",
    margin: "0.25rem 0 0 0",
  },
  content: {
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
  },
};
