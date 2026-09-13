const j = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const method = (init?.method || "GET").toUpperCase();
  const headers = new Headers(init?.headers || {});
  if (method !== "GET" && method !== "HEAD" && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  const body = init?.body ?? (method !== "GET" && method !== "HEAD" ? "{}" : undefined);
  const res = await fetch(path, { ...init, headers, body });
  const text = await res.text();
  let data: { simple?: string; error?: string; id?: string } = {};
  try {
    data = text ? (JSON.parse(text) as typeof data) : {};
  } catch {
    throw new Error("پاسخ سرور خوانده نشد. برنامه را ببندید و دوباره Start-Expert را بزنید.");
  }
  if (!res.ok) throw new Error(data.simple || data.error || "خطا");
  return data as T;
};

export const api = {
  createSession: () => j<{ id: string }>("/api/sessions", { method: "POST" }),
  get: (id: string) => j<Record<string, unknown>>(`/api/sessions/${id}`),
  mode: (id: string, mode: string) => j(`/api/sessions/${id}/mode`, { method: "POST", body: JSON.stringify({ mode }) }),
  connect: (id: string, body: unknown) => j(`/api/sessions/${id}/connect`, { method: "POST", body: JSON.stringify(body) }),
  bot: (id: string, body: unknown) => j(`/api/sessions/${id}/bot`, { method: "POST", body: JSON.stringify(body) }),
  source: (id: string, body: unknown) => j(`/api/sessions/${id}/source`, { method: "POST", body: JSON.stringify(body) }),
  webhook: (id: string, body: unknown) => j(`/api/sessions/${id}/webhook`, { method: "POST", body: JSON.stringify(body) }),
  install: (id: string) => j(`/api/sessions/${id}/install`, { method: "POST" }),
  job: (id: string) => j(`/api/sessions/${id}/job`),
  dashboard: (id: string) => j(`/api/sessions/${id}/dashboard`),
  logs: (id: string) => j<{ text: string }>(`/api/sessions/${id}/logs`),
  health: (id: string) => j(`/api/sessions/${id}/health`),
  repair: (id: string, item: unknown) => j(`/api/sessions/${id}/repair`, { method: "POST", body: JSON.stringify({ item }) }),
  service: (id: string, action: string) => j(`/api/sessions/${id}/service/${action}`, { method: "POST" }),
  checkUpdate: (id: string) => j(`/api/sessions/${id}/update`),
  doUpdate: (id: string) => j(`/api/sessions/${id}/update`, { method: "POST" }),
  backups: (id: string) => j<{ items: string[] }>(`/api/sessions/${id}/backups`),
  backup: (id: string) => j(`/api/sessions/${id}/backups`, { method: "POST" }),
  restore: (id: string, bid: string) => j(`/api/sessions/${id}/backups/${bid}/restore`, { method: "POST" }),
  delBackup: (id: string, bid: string) => j(`/api/sessions/${id}/backups/${bid}`, { method: "DELETE" }),
  uninstall: (id: string, level: string) => j(`/api/sessions/${id}/uninstall`, { method: "POST", body: JSON.stringify({ level }) }),
};
