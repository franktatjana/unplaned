import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Unplaned",
  description: "Single-task AI focus tool",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <main style={mainStyle}>{children}</main>
        <footer style={footerStyle}>
          <span>Unplaned™ © {new Date().getFullYear()}</span>
          <span style={separatorStyle}>·</span>
          <a href="mailto:unplaned.io@gmail.com" style={linkStyle}>
            unplaned.io@gmail.com
          </a>
        </footer>
      </body>
    </html>
  );
}

const mainStyle: React.CSSProperties = {
  flex: 1,
};

const footerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  gap: "0.5rem",
  padding: "2rem 1rem",
  fontSize: "0.75rem",
  color: "var(--fg-muted)",
};

const separatorStyle: React.CSSProperties = {
  color: "var(--border)",
};

const linkStyle: React.CSSProperties = {
  color: "var(--fg-muted)",
  textDecoration: "none",
};
