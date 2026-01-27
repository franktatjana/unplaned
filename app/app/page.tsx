import Link from "next/link";
import { getTasks, getSessions } from "./lib/storage";
import TaskInput from "./components/TaskInput";
import TaskList from "./components/TaskList";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [tasks, sessions] = await Promise.all([getTasks(), getSessions()]);

  // Get active sessions (those without completedAt)
  const activeSessions = sessions.filter(s => !s.completedAt);

  return (
    <main style={styles.main}>
      <header style={styles.header}>
        <div style={styles.headerTop}>
          <Link href="/overview" style={styles.helpLink}>
            Overview
          </Link>
          <h1 style={styles.title}>Unplaned</h1>
          <Link href="/help" style={styles.helpLink}>
            How to use
          </Link>
        </div>
        <p style={styles.subtitle}>One task at a time. Focus. Finish.</p>
      </header>

      <section style={styles.content}>
        <TaskInput />
        <TaskList tasks={tasks} activeSessions={activeSessions} />
      </section>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  main: {
    maxWidth: "640px",
    margin: "0 auto",
    padding: "2rem 1.5rem",
    minHeight: "100vh",
  },
  header: {
    marginBottom: "1.5rem",
    textAlign: "center",
  },
  headerTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "1rem",
    marginBottom: "0.25rem",
  },
  title: {
    fontSize: "2rem",
    fontWeight: 700,
    color: "var(--fg-primary)",
  },
  helpLink: {
    fontSize: "0.75rem",
    color: "#FFFF00",
    textDecoration: "none",
    padding: "0.375rem 0.625rem",
    background: "var(--bg-secondary)",
    border: "1px solid #FFFF00",
    borderRadius: "4px",
    transition: "opacity 0.15s",
  },
  subtitle: {
    fontSize: "1rem",
    color: "var(--fg-muted)",
  },
  content: {
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
  },
};
