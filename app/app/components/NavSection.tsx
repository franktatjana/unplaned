"use client";

import { useState } from "react";
import Link from "next/link";
import ImportDialog from "./ImportDialog";

export default function NavSection() {
  const [showImport, setShowImport] = useState(false);

  return (
    <>
      <nav style={styles.nav}>
        <button onClick={() => setShowImport(true)} style={styles.importBtn}>
          Brain Dump
        </button>
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
      <ImportDialog isOpen={showImport} onClose={() => setShowImport(false)} />
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  nav: {
    display: "flex",
    justifyContent: "center",
    gap: "0.5rem",
    marginTop: "0.75rem",
    flexWrap: "wrap",
  },
  importBtn: {
    fontSize: "0.8rem",
    color: "#000",
    padding: "0.5rem 1rem",
    background: "#FFFF00",
    border: "none",
    borderRadius: "6px",
    fontWeight: 600,
    cursor: "pointer",
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
};
