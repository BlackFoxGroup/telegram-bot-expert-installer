import { NavLink, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { Download, HeartPulse, LayoutDashboard, Moon, Phone, ScrollText, Shield, Sun, Trash2, Wrench } from "lucide-react";
import { api } from "./api";
import { Wizard } from "./Wizard";
import { I18nProvider, LanguageMenu, useI18n } from "./i18n";
import type { CheckItem } from "@expert/shared";

function sid() {
  return localStorage.getItem("expert.session") || "";
}
function setSid(id: string) {
  localStorage.setItem("expert.session", id);
}

function Toast({ text, onClose }: { text: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);
  return <div className="toast" role="status">{text}</div>;
}

function Contact() {
  const { t } = useI18n();
  return (
    <section className="contact install-block">
      <div className="contact-head">
        <img className="contact-logo" src="/contact-logo.png" alt="Black Fox Group" />
        <h2>{t("contact")}</h2>
      </div>
      <p>{t("version")} : 1.0</p>
      <p>{t("maker")} : Black Fox Group</p>
      <p>{t("site")} : <a href="https://foxnext.net/" target="_blank" rel="noreferrer">https://foxnext.net/</a></p>
      <p>{t("github")} : <a href="https://github.com/BlackFoxGroup" target="_blank" rel="noreferrer">https://github.com/BlackFoxGroup</a></p>
      <a className="btn" href="https://foxnext.net/en/download.html" target="_blank" rel="noreferrer">{t("update")}</a>
    </section>
  );
}

function InstallBot({ onWebhook, onPolling }: { onWebhook: () => void; onPolling: () => void }) {
  const { t } = useI18n();
  return (
    <section className="install-block">
      <h2>{t("installBot")}</h2>
      <p className="muted">{t("installHint")}</p>
      <div className="cards">
        <div className="card">
          <h3>{t("webhookTitle")}</h3>
          <p className="muted">{t("webhookShort")}</p>
          <button className="btn" type="button" onClick={onWebhook}>{t("startSteps")}</button>
        </div>
        <div className="card">
          <h3>{t("pollingTitle")}</h3>
          <p className="muted">{t("pollingShort")}</p>
          <button className="btn" type="button" onClick={onPolling}>{t("startSteps")}</button>
        </div>
      </div>
    </section>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const [dark, setDark] = useState(() => localStorage.getItem("theme") !== "light");
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);
  const id = sid();
  const Item = ({ to, icon: Icon, label }: { to: string; icon: typeof LayoutDashboard; label: string }) => (
    <NavLink to={to} className={({ isActive }) => (isActive ? "active" : "")}>
      <Icon size={18} aria-hidden /> {label}
    </NavLink>
  );
  return (
    <div className="shell">
      <header className="topbar">
        <div className="header-actions">
          <LanguageMenu />
          <button className="btn ghost" type="button" onClick={() => setDark((v) => !v)} aria-label={t("theme")}>
            {dark ? <Sun size={16} /> : <Moon size={16} />} {t("theme")}
          </button>
        </div>
      </header>
      <div className="app">
        <aside className="side">
          <div className="brand">
            <img className="brand-logo" src="/logo.png" alt="Telegram Bot Expert Installer" />
            <div>
              <strong>Telegram Bot Expert</strong>
              <p className="muted">Black Fox Group</p>
            </div>
          </div>
          <Item to={id ? `/app/${id}` : "/"} icon={LayoutDashboard} label={t("dash")} />
          <Item to="/install" icon={Download} label={t("installBot")} />
          <Item to={id ? `/app/${id}/logs` : "/logs"} icon={ScrollText} label={t("logs")} />
          <Item to={id ? `/app/${id}/health` : "/"} icon={HeartPulse} label={t("health")} />
          <Item to={id ? `/app/${id}/repair` : "/"} icon={Wrench} label={t("repair")} />
          <Item to={id ? `/app/${id}/backup` : "/"} icon={Shield} label={t("backup")} />
          <Item to={id ? `/app/${id}/uninstall` : "/"} icon={Trash2} label={t("uninstall")} />
          <Item to="/contact" icon={Phone} label={t("contact")} />
        </aside>
        <div className="main-col">
          <main className="main">{children}</main>
        </div>
      </div>
    </div>
  );
}

function Welcome() {
  const { t } = useI18n();
  return (
    <div className="hero">
      <img className="logo-lg" src="/logo.png" alt="Telegram Bot Expert Installer" />
      <h1>Telegram Bot Expert</h1>
      <p>{t("welcome")}</p>
    </div>
  );
}

function InstallPage() {
  const { t } = useI18n();
  const nav = useNavigate();
  const existing = sid();
  const [err, setErr] = useState("");
  const go = async (mode: "webhook" | "polling") => {
    setErr("");
    try {
      let id = existing;
      if (id) {
        try { await api.mode(id, mode); } catch { id = ""; }
      }
      if (!id) {
        const s = await api.createSession();
        if (!s.id) throw new Error(t("sessionFail"));
        setSid(s.id);
        id = s.id;
        await api.mode(id, mode);
      }
      nav(`/wizard/${id}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };
  return (
    <div>
      {err && <p className="fail" role="alert">{err}</p>}
      <InstallBot onWebhook={() => void go("webhook")} onPolling={() => void go("polling")} />
    </div>
  );
}

function Dash() {
  const { t } = useI18n();
  const { id = "" } = useParams();
  const [d, setD] = useState<Record<string, unknown> | null>(null);
  const [toast, setToast] = useState("");
  const load = () => api.dashboard(id).then((x) => setD(x as Record<string, unknown>)).catch((e) => setToast(e.message));
  useEffect(() => { load(); }, [id]);
  const act = async (a: string) => { await api.service(id, a); setToast(t("done")); load(); };
  const bot = (d?.bot || {}) as { name?: string; username?: string; telegramOk?: boolean };
  const vps = (d?.vps || {}) as { host?: string; os?: string; cpuCores?: number; ramMb?: number; diskGb?: number };
  const svc = (d?.service || {}) as { running?: boolean; enabled?: boolean };
  return (
    <div>
      <h1>{t("dash")}</h1>
      <div className="cards">
        <div className="card"><h2>{t("botStatus")}</h2><p className={svc.running ? "ok" : "fail"}>{svc.running ? t("running") : t("stopped")}</p></div>
        <div className="card"><h2>{t("mode")}</h2><p>{String(d?.mode || "")}</p></div>
        <div className="card"><h2>VPS</h2><p>{vps.host} · {vps.os} · CPU {vps.cpuCores} · RAM {vps.ramMb} · {t("disk")} {vps.diskGb}</p></div>
        <div className="card"><h2>{t("name")}</h2><p>{bot.name} @{bot.username} · {bot.telegramOk ? t("tgOn") : t("tgOff")}</p></div>
        <div className="card"><h2>{t("service")}</h2><p>{svc.enabled ? t("bootOn") : t("bootOff")}</p></div>
      </div>
      <div className="row" style={{ marginTop: 16 }}>
        <button className="btn" onClick={() => act("start")}>Start</button>
        <button className="btn ghost" onClick={() => act("stop")}>Stop</button>
        <button className="btn ghost" onClick={() => act("restart")}>Restart</button>
        <button className="btn ghost" onClick={() => act("enable")}>Enable on Boot</button>
        <button className="btn ghost" onClick={() => act("disable")}>Disable on Boot</button>
      </div>
      {toast && <Toast text={toast} onClose={() => setToast("")} />}
    </div>
  );
}

function Logs() {
  const { t } = useI18n();
  const { id = "" } = useParams();
  const session = id || sid();
  const [raw, setRaw] = useState("");
  const [kind, setKind] = useState<"empty" | "needVps" | "needSession" | "text">("empty");
  const shown = kind === "needVps" ? t("needVps") : kind === "needSession" ? t("needSession") : raw || t("noLog");
  const load = () => {
    if (!session) {
      setKind("needSession");
      setRaw("");
      return;
    }
    api.logs(session).then((r) => {
      setRaw(r.text);
      setKind(r.text ? "text" : "empty");
    }).catch((e) => {
      const msg = e instanceof Error ? e.message : String(e);
      if (/VPS|اتصال|connect|SSH/i.test(msg)) setKind("needVps");
      else {
        setKind("text");
        setRaw(msg);
      }
    });
  };
  useEffect(() => { load(); }, [session]);
  return (
    <div>
      <h1>{t("logs")}</h1>
      <div className="row">
        <button className="btn" type="button" onClick={load}>{t("refresh")}</button>
        <button className="btn ghost" type="button" onClick={() => { setRaw(""); setKind("empty"); }}>{t("clear")}</button>
        <button className="btn ghost" type="button" onClick={() => {
          const blob = new Blob([shown], { type: "text/plain" });
          const a = document.createElement("a");
          a.href = URL.createObjectURL(blob); a.download = "bot.log"; a.click();
        }}>{t("downloadLog")}</button>
      </div>
      <pre className="log">{shown}</pre>
    </div>
  );
}

function Health() {
  const { t } = useI18n();
  const { id = "" } = useParams();
  const [items, setItems] = useState<CheckItem[]>([]);
  const [toast, setToast] = useState("");
  const load = () => api.health(id).then((r) => setItems((r as { items: CheckItem[] }).items)).catch((e) => setToast(e.message));
  useEffect(() => { load(); }, [id]);
  return (
    <div>
      <h1>{t("healthTitle")}</h1>
      {items.map((i) => (
        <div key={i.id} className="step">
          <span className={i.status}>{i.status === "ok" ? t("ok") : t("bad")} {i.label} — {i.simple}</span>
          {i.fixable && i.status !== "ok" && (
            <button className="btn" onClick={() => api.repair(id, i).then((r) => setToast((r as { message: string }).message)).then(load)}>{t("autoFix")}</button>
          )}
        </div>
      ))}
      {toast && <Toast text={toast} onClose={() => setToast("")} />}
    </div>
  );
}

function Backup() {
  const { t } = useI18n();
  const { id = "" } = useParams();
  const [items, setItems] = useState<string[]>([]);
  const [toast, setToast] = useState("");
  const load = () => api.backups(id).then((r) => setItems(r.items));
  useEffect(() => { load(); }, [id]);
  const bid = (b: string) => b.replace(".tgz", "").replace(".meta.json", "");
  return (
    <div>
      <h1>{t("backup")}</h1>
      <button className="btn" onClick={() => api.backup(id).then(load)}>Create Backup</button>
      {items.map((b) => (
        <div key={b} className="step">
          <span>{b}</span>
          <span className="row">
            <button className="btn ghost" onClick={() => { if (confirm(t("restoreQ"))) api.restore(id, bid(b)).then(() => setToast(t("restored"))); }}>Restore</button>
            <button className="btn danger" onClick={() => api.delBackup(id, bid(b)).then(load)}>Delete</button>
          </span>
        </div>
      ))}
      {toast && <Toast text={toast} onClose={() => setToast("")} />}
    </div>
  );
}

function Uninstall() {
  const { t } = useI18n();
  const { id = "" } = useParams();
  const [toast, setToast] = useState("");
  const go = (level: string) => {
    if (!confirm(t("irreversible"))) return;
    api.uninstall(id, level).then(() => setToast(t("removed")));
  };
  return (
    <div className="card">
      <h1>{t("uninstallTitle")}</h1>
      <p>{t("uninstallP")}</p>
      <div className="row">
        <button className="btn ghost" onClick={() => go("app")}>{t("rmApp")}</button>
        <button className="btn ghost" onClick={() => go("app-data")}>{t("rmAppData")}</button>
        <button className="btn danger" onClick={() => go("everything")}>{t("rmAll")}</button>
      </div>
      {toast && <Toast text={toast} onClose={() => setToast("")} />}
    </div>
  );
}

function RoutesApp() {
  const wrap = (el: React.ReactNode) => <Layout>{el}</Layout>;
  return (
    <Routes>
      <Route path="/" element={wrap(<Welcome />)} />
      <Route path="/install" element={wrap(<InstallPage />)} />
      <Route path="/contact" element={wrap(<Contact />)} />
      <Route path="/logs" element={wrap(<Logs />)} />
      <Route path="/wizard/:id" element={wrap(<Wizard />)} />
      <Route path="/app/:id" element={wrap(<Dash />)} />
      <Route path="/app/:id/logs" element={wrap(<Logs />)} />
      <Route path="/app/:id/health" element={wrap(<Health />)} />
      <Route path="/app/:id/repair" element={wrap(<Health />)} />
      <Route path="/app/:id/backup" element={wrap(<Backup />)} />
      <Route path="/app/:id/uninstall" element={wrap(<Uninstall />)} />
    </Routes>
  );
}

export function App() {
  return (
    <I18nProvider>
      <RoutesApp />
    </I18nProvider>
  );
}
