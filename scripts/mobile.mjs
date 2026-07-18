// Play the full flow on a phone. Starts the local-DB dev server (so the DevBar
// Play / End game controls work, which only happens when NODE_ENV is not
// production) and opens a public tunnel to it, then prints the URL — and a
// scannable QR code for it — to open on the phone.
//
//   npm run mobile
//
// Prefers cloudflared (no account, quick tunnel) if it is installed, otherwise
// falls back to ngrok. Ctrl-C stops both the server and the tunnel.

import { spawn, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import http from "node:http";
import net from "node:net";
import { once } from "node:events";
import qrcode from "qrcode-terminal";

// Resolved to the first free port at startup so a leftover server doesn't crash
// the launch with EADDRINUSE.
let PORT = process.env.PORT || "3111";
const BIN = (name) => new URL(`../node_modules/.bin/${name}`, import.meta.url).pathname;

function portFree(port) {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.once("error", () => resolve(false));
    s.once("listening", () => s.close(() => resolve(true)));
    s.listen(port, "0.0.0.0");
  });
}

async function pickPort(start) {
  let p = Number(start);
  for (let i = 0; i < 20; i++) {
    if (await portFree(p)) return String(p);
    console.log(`  Port ${p} is busy, trying ${p + 1}…`);
    p++;
  }
  throw new Error(`no free port found starting at ${start}`);
}

const children = [];
let shuttingDown = false;

function stopAll(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const c of children) {
    try {
      c.kill("SIGTERM");
    } catch {
      /* already gone */
    }
  }
  setTimeout(() => process.exit(code), 300);
}
process.on("SIGINT", () => stopAll(0));
process.on("SIGTERM", () => stopAll(0));

function has(cmd) {
  return spawnSync("which", [cmd], { stdio: "ignore" }).status === 0;
}

function waitForServer(port, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get({ host: "127.0.0.1", port, path: "/" }, (res) => {
        res.resume();
        resolve();
      });
      req.on("error", () => {
        if (Date.now() > deadline) reject(new Error("dev server never came up"));
        else setTimeout(tick, 500);
      });
    };
    tick();
  });
}

// Ask ngrok's local API for the public https URL it assigned.
function ngrokUrl(timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const tick = () => {
      http
        .get({ host: "127.0.0.1", port: 4040, path: "/api/tunnels" }, (res) => {
          let body = "";
          res.on("data", (d) => (body += d));
          res.on("end", () => {
            try {
              const tunnels = JSON.parse(body).tunnels || [];
              const https = tunnels.find((t) => t.public_url?.startsWith("https"));
              if (https) return resolve(https.public_url);
            } catch {
              /* not ready */
            }
            if (Date.now() > deadline) reject(new Error("no ngrok url"));
            else setTimeout(tick, 500);
          });
        })
        .on("error", () => {
          if (Date.now() > deadline) reject(new Error("ngrok api unreachable"));
          else setTimeout(tick, 500);
        });
    };
    tick();
  });
}

// Wipe replayed events so every launch is a clean slate: a fixture that was
// played to full time in a past session would otherwise leave the Play button a
// no-op (its cursor is the fixture's stored event count). Local DB file only.
function resetReplayState() {
  const file = process.env.LOCAL_DB_FILE || ".local-db.json";
  if (!existsSync(file)) return;
  try {
    const db = JSON.parse(readFileSync(file, "utf8"));
    db.match_events = [];
    db.match_state = [];
    writeFileSync(file, JSON.stringify(db, null, 2));
    console.log("  Cleared replayed match events — fixtures start fresh.");
  } catch (err) {
    console.warn("  (couldn't reset replay state:", err.message + ")");
  }
}

function banner(url) {
  const line = "─".repeat(url.length + 6);
  console.log(`\n┌${line}┐`);
  console.log(`│   ${url}   │`);
  console.log(`└${line}┘`);
  qrcode.generate(url, { small: true }, (qr) => console.log(`\n${qr}`));
  console.log("Scan that with your phone's camera, or open the URL above. Ctrl-C here stops everything.\n");
}

async function main() {
  // Keep the picker populated: re-date the sample fixtures before we start.
  console.log("→ Seeding local fixtures…");
  const seed = spawnSync("npm", ["run", "seed:local"], { stdio: "inherit" });
  if (seed.status !== 0) console.warn("  (seed failed — fixtures may be stale, continuing)");
  resetReplayState();

  // Dev server in local-DB mode, bound to 0.0.0.0 so the LAN and the tunnel can
  // both reach it. NODE_ENV stays development, so the DevBar and simulate route
  // are live.
  PORT = await pickPort(PORT);
  console.log(`→ Starting dev server on :${PORT}…`);
  const dev = spawn(
    BIN("next"),
    ["dev", "-H", "0.0.0.0", "-p", String(PORT)],
    {
      stdio: "inherit",
      env: { ...process.env, LOCAL_DB: "1", NEXT_PUBLIC_LOCAL_DB: "1" },
    },
  );
  children.push(dev);
  dev.on("exit", (code) => stopAll(code ?? 0));

  await waitForServer(PORT);
  console.log("→ Dev server is up.");

  // Open a tunnel. cloudflared quick tunnels need no account; ngrok needs a
  // one-time authtoken.
  if (has("cloudflared")) {
    console.log("→ Opening cloudflared tunnel…");
    const cf = spawn(
      "cloudflared",
      ["tunnel", "--url", `http://localhost:${PORT}`],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    children.push(cf);
    const onData = (buf) => {
      const s = buf.toString();
      process.stderr.write(s);
      const m = s.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
      if (m) {
        banner(m[0]);
        cf.stdout.off("data", onData);
        cf.stderr.off("data", onData);
      }
    };
    cf.stdout.on("data", onData);
    cf.stderr.on("data", onData);
    cf.on("exit", (code) => stopAll(code ?? 0));
  } else if (has("ngrok")) {
    console.log("→ Opening ngrok tunnel…");
    const ng = spawn("ngrok", ["http", String(PORT)], {
      stdio: ["ignore", "ignore", "inherit"],
    });
    children.push(ng);
    ng.on("exit", (code) => stopAll(code ?? 0));
    try {
      banner(await ngrokUrl());
    } catch {
      console.error(
        "\nCould not read an ngrok URL. If ngrok printed an auth error, run once:\n" +
          "  ngrok config add-authtoken <token from https://dashboard.ngrok.com>\n",
      );
    }
  } else {
    console.error(
      "\nNo tunnel tool found. Install one:\n" +
        "  brew install cloudflared      (no account)\n" +
        "  or configure ngrok authtoken  (free signup)\n" +
        `\nThe dev server is still running at http://localhost:${PORT} for LAN access.\n`,
    );
  }

  await once(dev, "exit");
}

main().catch((err) => {
  console.error(err);
  stopAll(1);
});
