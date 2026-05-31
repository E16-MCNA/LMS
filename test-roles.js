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

async function testRole(roleName, buttonTextSelector) {
  const outputLines = [];
  function log(msg) {
    console.log(`[${roleName.toUpperCase()}] ${msg}`);
    outputLines.push(`[${roleName.toUpperCase()}] ${msg}`);
  }

  log("Starting Chrome...");
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

    // Wait for login page to render
    await delay(2000);

    // Let's find the quick login button and click it
    log("Attempting to click login button...");
    const clickResult = await sendCommand("Runtime.evaluate", {
      expression: `
        (() => {
          const buttons = Array.from(document.querySelectorAll('button[type="button"]'));
          const target = buttons.find(b => b.textContent.includes('${buttonTextSelector}'));
          if (target) {
            target.click();
            return "Clicked " + target.textContent.trim().replace(/\\s+/g, ' ');
          }
          return "Button not found";
        })()
      `,
      returnByValue: true
    });
    log("Click Action Result: " + clickResult.result.value);

    // Now click the submit button
    await delay(1000);
    log("Submitting login form...");
    const submitResult = await sendCommand("Runtime.evaluate", {
      expression: `
        (() => {
          const submitBtn = document.querySelector('button[type="submit"]');
          if (submitBtn) {
            submitBtn.click();
            return "Clicked Submit";
          }
          return "Submit button not found";
        })()
      `,
      returnByValue: true
    });
    log("Submit Action Result: " + submitResult.result.value);

    // Wait 5 seconds for dashboard to render and check for errors
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
        log("\x1b[32mSUCCESS: Logged in successfully and dashboard loaded!\x1b[0m");
      } else {
        log("\x1b[33mWARNING: Remained on the login page.\x1b[0m");
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
    { name: "Admin", btn: "Manager" },
    { name: "Teacher", btn: "Giảng Viên" },
    { name: "Student", btn: "Học Viên" }
  ];

  const allLogs = [];
  for (const r of roles) {
    console.log(`\n================ Testing ${r.name} ================`);
    const res = await testRole(r.name, r.btn);
    allLogs.push(...res.outputLines);
    await delay(2000); // cooldown
  }

  fs.writeFileSync(LOG_FILE, allLogs.join("\n"));
  console.log("\nAll role logs saved to " + LOG_FILE);
}

runAllTests();
