import { T } from "../../theme/theme";

export function Input({ label, icon, value, onChange, placeholder, type = "text", maxLength, error }) {
  return (
    <div style={{ marginBottom: 16 }}>
      {label && (
        <div style={{ fontSize: 11, fontWeight: 700, color: T.textMut, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 6 }}>
          {label}
        </div>
      )}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        background: T.bgInput, border: `1px solid ${error ? T.red : T.border}`,
        borderRadius: 12, padding: "10px 14px",
      }}>
        {icon && <span style={{ fontSize: 16 }}>{icon}</span>}
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          style={{
            flex: 1, background: "none", border: "none", outline: "none",
            color: T.text, fontSize: 14, fontFamily: "inherit",
          }}
        />
      </div>
      {error && <div style={{ fontSize: 11, color: T.red, marginTop: 4 }}>{error}</div>}
    </div>
  );
}
