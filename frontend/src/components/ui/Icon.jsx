import {
  ArrowLeft, Bell, Building2, CalendarDays, Camera, ChartColumn, Check, ChevronDown,
  ChevronRight, CircleAlert, Download, ClipboardCheck, ClipboardList, Clock, Crosshair, Eye, EyeOff,
  FileText, Folder, IdCard, Info, KeyRound, LayoutDashboard, LogOut, Map, MapPin, Menu,
  Pencil, Plus, RadioTower, ScrollText, Search, Settings, TriangleAlert, UserRound,
  UserRoundCheck, Users, Wifi, WifiOff, X,
} from "lucide-react";

// Un solo set lineal (Lucide), trazo de 1.5 px. Se importa por nombre para que
// el empaquetado solo incluya los íconos usados.
const ICONS = {
  "arrow-left": ArrowLeft, bell: Bell, "building-2": Building2, "calendar-days": CalendarDays,
  camera: Camera, "chart-column": ChartColumn, check: Check, "chevron-down": ChevronDown,
  "chevron-right": ChevronRight, "circle-alert": CircleAlert, "clipboard-check": ClipboardCheck,
  "clipboard-list": ClipboardList, download: Download, clock: Clock, crosshair: Crosshair, eye: Eye, "eye-off": EyeOff,
  "file-text": FileText, folder: Folder, "id-card": IdCard, info: Info, "key-round": KeyRound,
  "layout-dashboard": LayoutDashboard, "log-out": LogOut, map: Map, "map-pin": MapPin, menu: Menu,
  pencil: Pencil, plus: Plus, "radio-tower": RadioTower, "scroll-text": ScrollText, search: Search,
  settings: Settings, "triangle-alert": TriangleAlert, "user-round": UserRound,
  "user-round-check": UserRoundCheck, users: Users, wifi: Wifi, "wifi-off": WifiOff, x: X,
};

export function Icon({ name, size = 18, color = "currentColor", style }) {
  const Cmp = ICONS[name];
  if (!Cmp) return null;
  return <Cmp size={size} strokeWidth={1.5} color={color} aria-hidden="true" style={{ flex: "none", ...style }} />;
}
