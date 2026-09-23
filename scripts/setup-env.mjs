// Crea .env.local (si no existe) a partir de .env.example con llaves VAPID y CRON_SECRET nuevas.
// Uso: node scripts/setup-env.mjs
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import webpush from "web-push";

const target = new URL("../.env.local", import.meta.url);
if (existsSync(target)) {
  console.log(".env.local ya existe; no se modificó.");
  process.exit(0);
}

const { publicKey, privateKey } = webpush.generateVAPIDKeys();
const env = readFileSync(new URL("../.env.example", import.meta.url), "utf8")
  .replace(/^NEXT_PUBLIC_VAPID_PUBLIC_KEY=.*$/m, `NEXT_PUBLIC_VAPID_PUBLIC_KEY=${publicKey}`)
  .replace(/^VAPID_PRIVATE_KEY=.*$/m, `VAPID_PRIVATE_KEY=${privateKey}`)
  .replace(/^CRON_SECRET=.*$/m, `CRON_SECRET=${randomBytes(24).toString("hex")}`);

writeFileSync(target, env);
console.log(".env.local creado. Completa las llaves de Supabase.");
