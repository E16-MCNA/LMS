const deployUrl = process.env.DEPLOY_URL;

if (!deployUrl) {
  throw new Error("DEPLOY_URL is required, for example https://lms.example.com");
}

async function main() {
  const health = await fetch(`${deployUrl.replace(/\/$/, "")}/health`);
  if (!health.ok) throw new Error(`Health check failed: ${health.status}`);
  const payload = await health.json();
  if (!payload.ok || payload.database !== "ok") throw new Error(`Unhealthy payload: ${JSON.stringify(payload)}`);
  console.log(JSON.stringify({ ok: true, target: deployUrl, health: payload }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
