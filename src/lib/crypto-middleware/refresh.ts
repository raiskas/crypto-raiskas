import { spawn } from "child_process";
import path from "path";
import { CRYPTO_MW_BASE_DIR } from "@/lib/crypto-middleware/paths";

interface RefreshState {
  running: boolean;
  started_at: string | null;
  finished_at: string | null;
  exit_code: number | null;
  message: string;
}

declare global {
  // eslint-disable-next-line no-var
  var __cryptoMwRefreshState: RefreshState | undefined;
}

function getState(): RefreshState {
  if (!global.__cryptoMwRefreshState) {
    global.__cryptoMwRefreshState = {
      running: false,
      started_at: null,
      finished_at: null,
      exit_code: null,
      message: "idle",
    };
  }
  return global.__cryptoMwRefreshState;
}

export function getRefreshStatus() {
  return { ok: true, status: { ...getState() } };
}

export function startRefreshRun() {
  const state = getState();
  if (state.running) {
    return {
      ok: false,
      started: false,
      status: { ...state },
      message: "já existe atualização em andamento",
    };
  }

  state.running = true;
  state.started_at = new Date().toISOString();
  state.finished_at = null;
  state.exit_code = null;
  state.message = "executando middleware.py...";

  const scriptPath = path.join(CRYPTO_MW_BASE_DIR, "middleware.py");
  const child = spawn("python3", [scriptPath], {
    cwd: CRYPTO_MW_BASE_DIR,
    stdio: ["ignore", "pipe", "pipe"],
  });

  let stderr = "";
  let stdout = "";

  child.stdout.on("data", (chunk: Buffer) => {
    stdout += chunk.toString();
  });

  child.stderr.on("data", (chunk: Buffer) => {
    stderr += chunk.toString();
  });

  child.on("close", (code) => {
    state.running = false;
    state.finished_at = new Date().toISOString();
    state.exit_code = code ?? null;
    if ((code ?? 1) === 0) {
      state.message = "ok";
    } else {
      const lines = `${stderr}\n${stdout}`
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      state.message = lines.length ? lines[lines.length - 1].slice(0, 240) : "falha ao executar middleware.py";
    }
  });

  child.on("error", (err) => {
    state.running = false;
    state.finished_at = new Date().toISOString();
    state.exit_code = 1;
    state.message = `falha ao iniciar refresh: ${err.message}`;
  });

  return {
    ok: true,
    started: true,
    status: { ...state },
    message: "refresh iniciado",
  };
}
