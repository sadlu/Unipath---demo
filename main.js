import v from "fs";
import { app as s, ipcMain as c, shell as x, BrowserWindow as T, Notification as D } from "electron";
import o from "path";
import A from "os";
import { fileURLToPath as L } from "url";
import { spawn as y, spawnSync as B } from "child_process";
const N = L(import.meta.url), b = o.dirname(N);
process.env.DIST = o.join(b, "../dist");
process.env.VITE_PUBLIC = s.isPackaged ? process.env.DIST : o.join(process.env.DIST, "../public");
let e = null, a = null;
const U = s.requestSingleInstanceLock();
U || s.quit();
const _ = process.env.VITE_DEV_SERVER_URL, d = s.isPackaged ? o.join(process.resourcesPath, "..") : o.resolve(b, "..");
s.isPackaged ? o.join(process.resourcesPath, "backend") : o.join(d, "backend");
const m = A.platform() === "win32", w = s.isPackaged ? o.join(process.resourcesPath, "backend-bin", m ? "unipath-backend.exe" : "unipath-backend") : null;
function $() {
  const n = m ? ["python", "python3"] : ["python3", "python"];
  for (const t of n)
    try {
      if (B(t, ["--version"], { stdio: "pipe" }).status === 0) return t;
    } catch {
    }
  return m ? "python" : "python3";
}
function O() {
  const n = m ? [
    o.join(d, "backend", ".venv", "Scripts", "python.exe"),
    o.join(d, ".venv", "Scripts", "python.exe")
  ] : [
    o.join(d, "backend", ".venv", "bin", "python3"),
    o.join(d, "backend", ".venv", "bin", "python"),
    o.join(d, ".venv", "bin", "python3"),
    o.join(d, ".venv", "bin", "python")
  ];
  for (const t of n)
    try {
      return v.accessSync(t), t;
    } catch {
    }
  return null;
}
const I = 8e3, g = `http://localhost:${I}`;
function C() {
  return new Promise((n) => {
    const t = s.getPath("userData"), r = { ...process.env, UNIPATH_DATA_DIR: t };
    let i = !1, l = 0;
    const h = 3;
    function p() {
      var P, S;
      if (l >= h) {
        console.warn("Backend failed to start after max attempts"), i = !0, n();
        return;
      }
      if (l++, s.isPackaged && w && v.existsSync(w))
        a = y(w, [], {
          cwd: t,
          stdio: ["ignore", "pipe", "pipe"],
          env: r
        });
      else {
        const u = O() || $(), f = ["-m", "uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", String(I)];
        a = y(u, f, {
          cwd: d,
          stdio: ["ignore", "pipe", "pipe"],
          env: r
        });
      }
      (P = a.stdout) == null || P.on("data", (u) => {
        const f = u.toString();
        !i && f.includes("Uvicorn running on") && (i = !0, console.log("Backend started successfully"), n());
      }), (S = a.stderr) == null || S.on("data", (u) => {
        const f = u.toString();
        !i && f.includes("Uvicorn running on") && (i = !0, console.log("Backend started successfully"), n());
      }), a.on("error", () => {
        i || (console.warn(`Backend attempt ${l} failed, retrying...`), a = null, setTimeout(p, 2e3));
      }), a.on("exit", (u) => {
        a = null, i || (console.warn(`Backend exited with code ${u}, retrying...`), setTimeout(p, 2e3));
      });
    }
    p(), setTimeout(() => {
      i || (i = !0, n());
    }, 25e3);
  });
}
function E() {
  e = new T({
    width: 1200,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    frame: !1,
    webPreferences: {
      preload: o.join(b, "preload.js"),
      contextIsolation: !0,
      nodeIntegration: !1,
      nativeWindowOpen: !0
    }
  }), e.webContents.setWindowOpenHandler(({ url: n }) => (x.openExternal(n), { action: "deny" })), _ ? e.loadURL(_) : e.loadFile(o.join(process.env.DIST, "index.html"));
}
c.handle("get-backend-url", () => g);
c.handle("get-backend-status", async () => {
  try {
    return { running: (await fetch(`${g}/api/health`, { signal: AbortSignal.timeout(3e3) })).ok };
  } catch {
    return { running: !1 };
  }
});
c.handle("select-image", async () => {
  const { dialog: n } = await import("electron"), t = await n.showOpenDialog(e, {
    properties: ["openFile"],
    filters: [{ name: "Images", extensions: ["jpg", "jpeg", "png", "gif", "webp"] }]
  });
  if (t.canceled || t.filePaths.length === 0) return { canceled: !0 };
  const r = t.filePaths[0], i = v.readFileSync(r), l = o.extname(r).slice(1);
  return { canceled: !1, data: i.toString("base64"), ext: l, name: o.basename(r) };
});
c.on("window:minimize", () => e == null ? void 0 : e.minimize());
c.on("window:maximize", () => {
  e != null && e.isMaximized() ? e.unmaximize() : e == null || e.maximize();
});
c.on("window:close", () => e == null ? void 0 : e.close());
c.handle("open-external", async (n, t) => {
  typeof t == "string" && t.startsWith("https://") && await x.openExternal(t);
});
c.handle("show-notification", (n, { title: t, body: r }) => {
  !e || e.isFocused() || new D({ title: t, body: r }).show();
});
let k = null;
async function R() {
  const { pipeline: n } = await import("@xenova/transformers");
  k = await n("text2text-generation", "Xenova/LaMini-T5-61M", {
    quantized: !0
  });
}
const M = 'You are a helpful assistant for the "Uni Path" app. Answer based ONLY on the search results provided. Never make up URLs. Focus on Nepal.';
function V(n, t) {
  return `${M}

User query: ${n}

Search results:
${t || "(No results)"}

Answer:`;
}
c.handle("generate-answer", async (n, { query: t, snippets: r }) => {
  var i, l;
  try {
    k || await R();
    const h = V(t, r), p = await k(h, {
      max_new_tokens: 500,
      temperature: 0.3,
      do_sample: !0
    });
    return { answer: ((l = (i = p == null ? void 0 : p[0]) == null ? void 0 : i.generated_text) == null ? void 0 : l.trim()) || null };
  } catch (h) {
    return { answer: null, error: h.message };
  }
});
function j() {
  if (a) {
    try {
      m ? y("taskkill", ["/pid", String(a.pid), "/f", "/t"]) : (a.kill("SIGTERM"), setTimeout(() => {
        try {
          a == null || a.kill("SIGKILL");
        } catch {
        }
      }, 3e3));
    } catch {
    }
    a = null;
  }
}
s.on("before-quit", () => j());
s.on("window-all-closed", () => {
  j(), process.platform !== "darwin" && (s.quit(), e = null);
});
s.on("activate", () => {
  T.getAllWindows().length === 0 && E();
});
s.whenReady().then(async () => {
  await C(), E(), e && e.webContents.on("did-finish-load", async () => {
    const n = Date.now();
    for (; Date.now() - n < 15e3; ) {
      try {
        if ((await fetch(`${g}/api/health`, { signal: AbortSignal.timeout(2e3) })).ok) {
          e == null || e.webContents.send("backend-ready", g);
          break;
        }
      } catch {
      }
      await new Promise((t) => setTimeout(t, 1e3));
    }
  }), R().catch((n) => console.error("Failed to load AI model:", n));
});
