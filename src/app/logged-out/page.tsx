export default function LoggedOutPage() {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      minHeight: "100vh", background: "var(--bg-base)",
    }}>
      <div style={{
        textAlign: "center", padding: "2.5rem 3rem",
        background: "var(--bg-surface)", border: "1px solid var(--border)",
        borderRadius: "8px", boxShadow: "var(--shadow-md)",
      }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--accent)", marginBottom: "0.5rem" }}>
          iSolutions
        </h1>
        <p style={{ color: "var(--text-secondary)", marginBottom: "1.75rem", fontSize: "0.9rem" }}>
          You have been signed out successfully.
        </p>
        <a href="/" style={{
          display: "inline-block", padding: "0.55rem 1.5rem",
          background: "var(--accent)", color: "var(--accent-text)",
          borderRadius: "4px", fontWeight: 600, fontSize: "0.875rem",
          textDecoration: "none",
        }}>
          Sign In
        </a>
      </div>
    </div>
  );
}
