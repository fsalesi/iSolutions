export default function LoggedOutPage() {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "100vh",
      background: "#f4f5f7",
      fontFamily: "system-ui, -apple-system, sans-serif",
    }}>
      <div style={{
        textAlign: "center",
        padding: "2.5rem 3rem",
        background: "#fff",
        border: "1px solid #e2e8f0",
        borderRadius: "8px",
        boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
        maxWidth: "380px",
        width: "100%",
      }}>
        {/* Icon */}
        <div style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: "48px",
          height: "48px",
          borderRadius: "10px",
          background: "#2563eb",
          marginBottom: "1.25rem",
        }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/>
            <path d="M2 17l10 5 10-5"/>
            <path d="M2 12l10 5 10-5"/>
          </svg>
        </div>

        <h1 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#1a202c", margin: "0 0 0.5rem" }}>
          iSolutions
        </h1>
        <p style={{ color: "#64748b", marginBottom: "1.75rem", fontSize: "0.9rem", margin: "0 0 1.75rem" }}>
          Thanks for using iSolutions. You have been signed out.
        </p>
        <a href="/" style={{
          display: "inline-block",
          padding: "0.55rem 1.75rem",
          background: "#2563eb",
          color: "#fff",
          borderRadius: "4px",
          fontWeight: 600,
          fontSize: "0.875rem",
          textDecoration: "none",
        }}>
          Sign In
        </a>
      </div>
    </div>
  );
}
