import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { CheckItem, JobEvent, VpsFacts } from "@expert/shared";
import { api } from "./api";
import { useI18n } from "./i18n";

function Toast({ text, onClose }: { text: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);
  return <div className="toast" role="status">{text}</div>;
}

export function Wizard() {
  const { t } = useI18n();
  const { id = "" } = useParams();
  const nav = useNavigate();
  const [step, setStep] = useState(1);
  const [toast, setToast] = useState("");
  const [facts, setFacts] = useState<VpsFacts | null>(null);
  const [checks, setChecks] = useState<CheckItem[]>([]);
  const [job, setJob] = useState<JobEvent | null>(null);
  const [mode, setMode] = useState("polling");
  const [auth, setAuth] = useState({ host: "", port: 22, username: "root", method: "password", password: "", privateKey: "" });
  const [bot, setBot] = useState({ token: "", name: "", username: "", adminId: "", supportId: "", language: "fa", timezone: "Asia/Tehran", environment: "production", installDir: "/opt/telegram-bot" });
  const [source, setSource] = useState({ kind: "git", gitUrl: "", branch: "main", existingPath: "" });
  const [wh, setWh] = useState({ domain: "", listenPort: 8080, useNginx: true, email: "" });
  const [preview, setPreview] = useState<string[]>([]);

  useEffect(() => {
    api.get(id).then((s) => setMode(String(s.mode || "polling")));
  }, [id]);

  const fail = (e: unknown) => setToast(e instanceof Error ? e.message : String(e));

  return (
    <div>
      <h1>{t("wizard")}</h1>
      <p className="muted">{t("stepOf", { n: step })} · {mode === "webhook" ? "Webhook" : t("noWebhook")}</p>

      {step === 1 && (
        <div className="card">
          <p>{t("wizIntro")}</p>
          <button className="btn" onClick={() => setStep(2)}>{t("connectVps")}</button>
        </div>
      )}

      {step === 2 && (
        <div className="card">
          <label>{t("host")}<input value={auth.host} onChange={(e) => setAuth({ ...auth, host: e.target.value })} /></label>
          <label>{t("sshPort")}<input type="number" value={auth.port} onChange={(e) => setAuth({ ...auth, port: Number(e.target.value) })} /></label>
          <label>{t("username")}<input value={auth.username} onChange={(e) => setAuth({ ...auth, username: e.target.value })} /></label>
          <label>{t("authMethod")}
            <select value={auth.method} onChange={(e) => setAuth({ ...auth, method: e.target.value })}>
              <option value="password">{t("password")}</option>
              <option value="key">{t("sshKey")}</option>
            </select>
          </label>
          {auth.method === "password" ? (
            <label>{t("password")}<input type="password" autoComplete="off" value={auth.password} onChange={(e) => setAuth({ ...auth, password: e.target.value })} /></label>
          ) : (
            <label>{t("privateKey")}<textarea value={auth.privateKey} onChange={(e) => setAuth({ ...auth, privateKey: e.target.value })} /></label>
          )}
          <button className="btn" onClick={() => api.connect(id, auth).then((r) => {
            const x = r as { facts: VpsFacts; checks: CheckItem[] };
            setFacts(x.facts); setChecks(x.checks); setToast(t("connected")); setStep(3);
          }).catch(fail)}>{t("testConn")}</button>
        </div>
      )}

      {step === 3 && facts && (
        <div className="card">
          <h2>{t("detect")}</h2>
          <p>{facts.os} · {facts.arch} · CPU {facts.cpuCores} · RAM {facts.ramMb}MB · {t("disk")} {facts.diskGb}GB · IP {facts.publicIp} · {t("kernel")} {facts.kernel}</p>
          <p className="muted">{t("openPorts")}: {facts.openPorts.join(", ") || "—"}</p>
          {checks.map((c) => (
            <div key={c.id} className="step">
              <span className={c.status}>{c.status === "ok" ? t("ready") : c.status === "warn" ? t("warn") : t("problem")} — {c.label}</span>
              <span className="muted">{c.simple}</span>
            </div>
          ))}
          <button className="btn" onClick={() => setStep(4)}>{t("continueBot")}</button>
        </div>
      )}

      {step === 4 && (
        <div className="card">
          <label>{t("token")}<input type="password" autoComplete="off" value={bot.token} onChange={(e) => setBot({ ...bot, token: e.target.value })} /></label>
          <label>{t("name")}<input value={bot.name} onChange={(e) => setBot({ ...bot, name: e.target.value })} /></label>
          <label>{t("uname")}<input value={bot.username} onChange={(e) => setBot({ ...bot, username: e.target.value })} /></label>
          <label>{t("admin")}<input value={bot.adminId} onChange={(e) => setBot({ ...bot, adminId: e.target.value })} /></label>
          <label>{t("support")}<input value={bot.supportId} onChange={(e) => setBot({ ...bot, supportId: e.target.value })} /></label>
          <label>{t("lang")}<input value={bot.language} onChange={(e) => setBot({ ...bot, language: e.target.value })} /></label>
          <label>{t("tz")}<input value={bot.timezone} onChange={(e) => setBot({ ...bot, timezone: e.target.value })} /></label>
          <label>{t("installDir")}<input value={bot.installDir} onChange={(e) => setBot({ ...bot, installDir: e.target.value })} /></label>
          <button className="btn" onClick={() => api.bot(id, bot).then(() => setStep(5)).catch(fail)}>{t("saveBot")}</button>
        </div>
      )}

      {step === 5 && (
        <div className="card">
          <h2>{t("source")}</h2>
          <label>{t("method")}
            <select value={source.kind} onChange={(e) => setSource({ ...source, kind: e.target.value })}>
              <option value="git">{t("gitRepo")}</option>
              <option value="existing">{t("existingDir")}</option>
            </select>
          </label>
          {source.kind === "git" && (
            <>
              <label>{t("repoUrl")}<input value={source.gitUrl} onChange={(e) => setSource({ ...source, gitUrl: e.target.value })} /></label>
              <label>{t("branch")}<input value={source.branch} onChange={(e) => setSource({ ...source, branch: e.target.value })} /></label>
            </>
          )}
          {source.kind === "existing" && <label>{t("path")}<input value={source.existingPath} onChange={(e) => setSource({ ...source, existingPath: e.target.value })} /></label>}
          {mode === "webhook" && (
            <>
              <h2>Webhook</h2>
              <label>{t("domain")}<input value={wh.domain} onChange={(e) => setWh({ ...wh, domain: e.target.value })} /></label>
              <label>{t("certEmail")}<input value={wh.email} onChange={(e) => setWh({ ...wh, email: e.target.value })} /></label>
              <label>{t("innerPort")}<input type="number" value={wh.listenPort} onChange={(e) => setWh({ ...wh, listenPort: Number(e.target.value) })} /></label>
              {preview.map((p) => <p key={p}>{p}</p>)}
            </>
          )}
          <div className="row">
            <button className="btn ghost" onClick={() => api.source(id, source).then(() => setToast(t("sourceSaved"))).catch(fail)}>{t("saveSource")}</button>
            {mode === "webhook" && (
              <button className="btn ghost" onClick={() => api.webhook(id, wh).then((r) => {
                const x = r as { ok: boolean; reason: string; preview: string[] };
                setPreview(x.preview || []);
                setToast(x.reason);
                if (x.ok) setStep(6);
              }).catch(fail)}>{t("checkDomain")}</button>
            )}
            {mode !== "webhook" && <button className="btn" onClick={() => setStep(6)}>{t("continueInstall")}</button>}
          </div>
        </div>
      )}

      {step === 6 && (
        <div className="card">
          <h2>{t("install")}</h2>
          <p>{t("installP")}</p>
          <button className="btn" onClick={() => api.source(id, source).then(() => api.install(id)).then((r) => {
            const ev = r as JobEvent;
            setJob(ev);
            if (ev.status === "success") nav(`/app/${id}`);
            else setToast(ev.message || t("installFail"));
          }).catch(fail)}>{t("startReal")}</button>
          <div className="steps" style={{ marginTop: 16 }}>
            {(job?.steps || []).map((s) => (
              <div key={s.id} className="step">
                <span>{s.title}{s.detail ? ` — ${s.detail}` : ""}</span>
                <span className={s.status === "done" ? "ok" : s.status === "failed" ? "fail" : ""}>
                  {s.status === "done" ? t("finished") : s.status === "failed" ? t("failed") : s.status === "running" ? t("running") : t("wait")}
                </span>
              </div>
            ))}
          </div>
          {job?.status === "failed" && (
            <button className="btn" onClick={() => setJob(null)}>{t("retry")}</button>
          )}
        </div>
      )}
      {toast && <Toast text={toast} onClose={() => setToast("")} />}
    </div>
  );
}
