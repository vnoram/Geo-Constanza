import { useState } from "react";
import { T, FONT } from "../../theme/theme";
import { Icon } from "./Icon";

// `icon`: nombre de un ícono Lucide (ver Icon.jsx). `mono`: para RUT, códigos y coordenadas.
export function Input({ label, type = "text", value, onChange, icon, error, placeholder, maxLength, mono }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ marginBottom: 16 }}>
      {label && <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: T.textSec, marginBottom: 6 }}>{label}</label>}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        background: T.bgInput, border: `1px solid ${error ? T.alert : focused ? T.borderFocus : T.border}`,
        borderRadius: T.radius, padding: "0 12px", minHeight: 42, transition: "border-color 0.15s",
      }}>
        {icon && <Icon name={icon} size={17} color={focused ? T.focusText : T.textMut} />}
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          maxLength={maxLength}
          style={{
            flex: 1, minWidth: 0, background: "none", border: "none", outline: "none",
            color: T.text, fontSize: 15, padding: "10px 0",
            fontFamily: mono ? FONT.mono : FONT.ui,
            letterSpacing: type === "password" ? 3 : 0,
          }}
        />
      </div>
      {error && <div style={{ fontSize: 12, color: T.alert, marginTop: 5 }}>{error}</div>}
    </div>
  );
}
