import { createCoachWebServer } from "../coach-web-server.mjs";
import {
  consumeSharedPairingCode,
  getEnglishCloudConfig,
  loadEnglishCoachProfile,
  saveEnglishCoachProfile,
} from "../english-cloud-store.mjs";

let serverPromise;

export async function getServer() {
  if (!process.env.ENGLISH_WEB_SESSION_SECRET || !process.env.ENGLISH_WEB_ACCESS_PASSWORD) {
    throw new Error("Vercel environment is missing web access settings.");
  }
  if (!getEnglishCloudConfig()) {
    throw new Error("Vercel environment is missing Supabase settings.");
  }
  process.env.ENGLISH_COACH_ENABLED = "true";
  process.env.ENGLISH_COACH_DIR = "/tmp/english-coach";
  process.env.HISTORY_DIR = "/tmp/english-history";
  serverPromise ||= (async () => {
    const { coachRuntime } = await import("../bot.mjs");
    return createCoachWebServer(coachRuntime, {
      allowRemote: true,
      secureCookies: true,
      requireAuth: true,
      accessPassword: process.env.ENGLISH_WEB_ACCESS_PASSWORD,
      sessionSecret: process.env.ENGLISH_WEB_SESSION_SECRET,
      loadLearner: loadEnglishCoachProfile,
      saveLearner: saveEnglishCoachProfile,
      consumePairingCode: consumeSharedPairingCode,
    });
  })();
  return serverPromise;
}

export default async function handler(req, res) {
  try {
    const server = await getServer();
    server.emit("request", req, res);
  } catch (error) {
    console.error("[Coach web startup]", error.message);
    res.statusCode = 503;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.end(JSON.stringify({ error: "Ứng dụng chưa được cấu hình đầy đủ. Hãy kiểm tra biến môi trường của Vercel." }));
  }
}
