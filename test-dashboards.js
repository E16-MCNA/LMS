import { spawn } from 'child_process';
import fs from 'fs';

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const LOG_FILE = "C:\\Users\\Admin\\.gemini\\antigravity\\scratch\\browser_logs.txt";

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getWebSocketUrl() {
  for (let i = 0; i < 10; i++) {
    try {
      const response = await fetch("http://127.0.0.1:9222/json/list");
      const list = await response.json();
      const page = list.find(item => item.type === 'page');
      if (page && page.webSocketDebuggerUrl) {
        return page.webSocketDebuggerUrl;
      }
    } catch (e) {
      // ignore
    }
    await delay(500);
  }
  throw new Error("Could not find chrome debugging page websocket URL");
}

async function testDashboard(roleName, email, password) {
  const outputLines = [];
  function log(msg) {
    console.log(`[${roleName.toUpperCase()}] ${msg}`);
    outputLines.push(`[${roleName.toUpperCase()}] ${msg}`);
  }

  log(`Testing ${roleName} dashboard...`);
  const chrome = spawn(CHROME_PATH, [
    "--headless",
    "--disable-gpu",
    "--remote-debugging-port=9222",
    "http://localhost:3100"
  ]);

  try {
    const wsUrl = await getWebSocketUrl();
    const ws = new WebSocket(wsUrl);

    let nextMsgId = 1;
    const pendingRequests = new Map();

    function sendCommand(method, params = {}) {
      const id = nextMsgId++;
      return new Promise((resolve, reject) => {
        pendingRequests.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    ws.onopen = async () => {
      await sendCommand("Console.enable");
      await sendCommand("Runtime.enable");
      await sendCommand("Page.enable");
    };

    const exceptions = [];
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && pendingRequests.has(msg.id)) {
        const { resolve, reject } = pendingRequests.get(msg.id);
        pendingRequests.delete(msg.id);
        if (msg.error) reject(msg.error);
        else resolve(msg.result);
      } else if (msg.method === "Runtime.exceptionThrown") {
        const details = msg.params.exceptionDetails;
        const text = details.exception ? details.exception.description : details.text;
        exceptions.push(text);
        log(`\x1b[31m[EXCEPTION] ${text}\x1b[0m`);
      } else if (msg.method === "Console.messageAdded") {
        const details = msg.params.message;
        log(`[BROWSER CONSOLE ${details.level.toUpperCase()}] ${details.text}`);
      }
    };

    // Wait for initial load
    await delay(2000);

    // Call login API via fetch inside the browser to get cookie and set CSRF
    log("Logging in via browser-side fetch...");
    const loginResult = await sendCommand("Runtime.evaluate", {
      expression: `
        (async () => {
          const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: '${email}', password: '${password}' })
          });
          const data = await res.json();
          if (res.ok) {
            sessionStorage.setItem('mcna_lms_csrf', data.csrfToken);
            return { ok: true, role: data.user.role };
          }
          return { ok: false, error: data.error };
        })()
      `,
      awaitPromise: true,
      returnByValue: true
    });

    log("Login Result: " + JSON.stringify(loginResult.result.value));
    if (!loginResult.result.value || !loginResult.result.value.ok) {
      throw new Error("Login failed: " + JSON.stringify(loginResult.result.value));
    }

    // Now reload the page so the app starts with valid session and CSRF token!
    log("Reloading page to render dashboard...");
    await sendCommand("Page.reload");

    // Wait 5 seconds for dashboard to load and check for exceptions
    await delay(5000);

    // Evaluate root innerHTML to check if it's empty
    const rootHtml = await sendCommand("Runtime.evaluate", {
      expression: "document.getElementById('root').innerHTML",
      returnByValue: true
    });

    const htmlVal = rootHtml.result.value || "";
    if (htmlVal.trim() === "") {
      log("\x1b[31mRESULT: Rendered empty screen (WHITE SCREEN)!\x1b[0m");
    } else {
      log(`RESULT: Rendered successfully. HTML length: ${htmlVal.length}`);
      if (htmlVal.includes("HỆ THỐNG ĐÀO TẠO MCNA LMS") || htmlVal.includes("Đăng xuất")) {
        log("\x1b[32mSUCCESS: Dashboard loaded successfully!\x1b[0m");
      } else {
        log("\x1b[31mRESULT: Dashboard did not load (remained on login or blank)!\x1b[0m");
      }
    }

    ws.close();
    chrome.kill();
    return { exceptions, htmlLength: htmlVal.length, outputLines };
  } catch (err) {
    log("Failed with error: " + err.message);
    chrome.kill();
    return { exceptions: [err.message], htmlLength: 0, outputLines };
  }
}

async function runAllTests() {
  const roles = [
    { name: "Admin", email: "admin@mcna.local", pass: "admine16" },
    { name: "Teacher", email: "teacher@mcna.local", pass: "teachere16" },
    { name: "Student", email: "student@mcna.local", pass: "studente16" },
    { name: "Finance", email: "finance@mcna.local", pass: "finance16" },
    { name: "Reception", email: "le_tan@mcna.local", pass: "letane16" },
    { name: "Academic", email: "academic@mcna.local", pass: "academice16" }
  ];

  const allLogs = [];
  for (const r of roles) {
    console.log(`\n================ Testing ${r.name} ================`);
    const res = await testDashboard(r.name, r.email, r.pass);
    allLogs.push(...res.outputLines);
    await delay(2000); // cooldown
  }

  fs.writeFileSync(LOG_FILE, allLogs.join("\n"));
  console.log("\nAll role logs saved to " + LOG_FILE);
}

runAllTests();
