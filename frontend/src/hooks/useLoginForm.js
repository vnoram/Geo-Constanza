import { useState, useEffect } from "react";
import { api } from "../services/api";

const LOCK_ATTEMPTS = 5;
const LOCK_DURATION = 900; // 15 min en segundos

export function useLoginForm({ onLogin }) {
  const [rut, setRut] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState("login"); // "login" | "2fa"
  const [code2fa, setCode2fa] = useState("");
  const [pendingUser, setPendingUser] = useState(null);
  const [attempts, setAttempts] = useState(0);
  const [locked, setLocked] = useState(false);
  const [lockTime, setLockTime] = useState(0);

  useEffect(() => {
    if (!locked || lockTime <= 0) return;
    const timer = setInterval(() => {
      setLockTime(t => {
        if (t <= 1) { setLocked(false); setAttempts(0); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [locked, lockTime]);

  const formatRut = (val) => {
    setRut(val.replace(/[^0-9kK-]/g, ""));
  };

  const handleLogin = async () => {
    if (locked) return;
    setError("");
    if (!rut.trim()) { setError("Ingrese su RUT"); return; }
    if (!pass.trim()) { setError("Ingrese su contraseña"); return; }

    setLoading(true);
    try {
      const result = await api.login(rut.trim(), pass);
      // DEV: 2FA desactivado temporalmente — todos los roles pasan directo al sistema
      // if (result.user.rol === "supervisor" || result.user.rol === "admin") {
      //   setPendingUser(result);
      //   setStep("2fa");
      // } else {
      onLogin(result.user, result.token);
      // }
      setAttempts(0);
    } catch (err) {
      const next = attempts + 1;
      setAttempts(next);
      if (next >= LOCK_ATTEMPTS) {
        setLocked(true);
        setLockTime(LOCK_DURATION);
        setError("Cuenta bloqueada por 15 minutos (5 intentos fallidos)");
      } else {
        setError(`${err.message}. Intento ${next}/${LOCK_ATTEMPTS}`);
      }
    }
    setLoading(false);
  };

  const handle2FA = async () => {
    setError("");
    if (!code2fa.trim() || code2fa.length < 6) { setError("Ingrese el código de 6 dígitos"); return; }
    setLoading(true);
    try {
      await api.verify2FA(code2fa);
      onLogin(pendingUser.user, pendingUser.token);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const resetTo2FA = () => { setStep("login"); setCode2fa(""); setError(""); setPendingUser(null); };

  const lockLabel = `${Math.floor(lockTime / 60)}:${String(lockTime % 60).padStart(2, "0")}`;

  return {
    rut, pass, setPass, error, loading,
    step, code2fa, setCode2fa, pendingUser,
    locked, lockTime, lockLabel,
    formatRut, handleLogin, handle2FA, resetTo2FA,
  };
}
