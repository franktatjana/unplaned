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
        <h1 style={styles.title}>Unplaned</h1>
        <p style={styles.subtitle}>One task at a time. Focus. Finish.</p>
      </header>

      <section style={styles.content}>
        <TaskInput />
        <nav style={styles.nav}>
          <Link href="/overview" style={styles.navLink}>
            Kanban
          </Link>
          <Link href="/templates" style={styles.navLink}>
            Templates
          </Link>
          <Link href="/brag" style={styles.navLinkBrag}>
            Brag List
          </Link>
          <Link href="/help" style={styles.navLinkHelp}>
            ?
          </Link>
        </nav>
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
  nav: {
    display: "flex",
    justifyContent: "center",
    gap: "0.5rem",
    marginTop: "0.75rem",
  },
  navLink: {
    fontSize: "0.8rem",
    color: "var(--fg-primary)",
    textDecoration: "none",
    padding: "0.5rem 1rem",
    background: "var(--bg-primary)",
    border: "1px solid var(--border)",
    borderRadius: "6px",
    transition: "opacity 0.15s",
    fontWeight: 500,
  },
  navLinkBrag: {
    fontSize: "0.8rem",
    color: "#28a745",
    textDecoration: "none",
    padding: "0.5rem 1rem",
    background: "rgba(40, 167, 69, 0.1)",
    border: "1px solid rgba(40, 167, 69, 0.3)",
    borderRadius: "6px",
    transition: "opacity 0.15s",
    fontWeight: 500,
  },
  navLinkHelp: {
    fontSize: "0.8rem",
    color: "var(--fg-muted)",
    textDecoration: "none",
    padding: "0.5rem 0.625rem",
    background: "transparent",
    border: "1px solid var(--border)",
    borderRadius: "6px",
    transition: "opacity 0.15s",
  },
  content: {
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
  },
};
