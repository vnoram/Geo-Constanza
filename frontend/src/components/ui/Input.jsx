import { useState } from "react";
import { T } from "../../theme/theme";

export function Input({ label, type = "text", value, onChange, icon, error, placeholder, maxLength }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ marginBottom: 18 }}>
      {label && <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: T.textSec, marginBottom: 6, letterSpacing: 1.5, textTransform: "uppercase" }}>{label}</label>}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        background: T.bgInput, border: `1.5px solid ${error ? T.red : focused ? T.borderFocus : T.border}`,
        borderRadius: 12, padding: "12px 14px", transition: "all 0.25s",
        boxShadow: focused ? `0 0 0 3px ${T.accentGhost}` : "none",
      }}>
        {icon && <span style={{ fontSize: 18, opacity: 0.5 }}>{icon}</span>}
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          maxLength={maxLength}
          style={{
            flex: 1, background: "none", border: "none", outline: "none",
            color: T.text, fontSize: 15, fontFamily: "'Outfit', sans-serif",
            letterSpacing: type === "password" ? 4 : 0,
          }}
        />
      </div>
      {error && <div style={{ fontSize: 12, color: T.red, marginTop: 5, fontWeight: 500 }}>{error}</div>}
    </div>
  );
}
