import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import * as learning from "../english-learning.mjs";

// Exercise the existing single-file bot without loading .env, logging in to Zalo,
// starting schedulers or calling external services. Only HTTP responses are mocked.
const source = fs.readFileSync(new URL("../bot.mjs", import.meta.url), "utf8")
  .replace(/^import .*;\r?\n/gm, "")
  .split("// ── Entrypoint")[0]
  .replace(/^export \{[^\n]+\};\r?$/gm, "");

function createCoach(t, env = {}) {
  const testDirectory = path.dirname(fileURLToPath(import.meta.url));
  const tempRoot = fs.mkdtempSync(path.join(testDirectory, ".english-test-"));
  t.after(() => {
    assert.equal(path.dirname(path.resolve(tempRoot)), path.resolve(testDirectory));
    assert(path.basename(tempRoot).startsWith(".english-test-"));
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });
  const messages = [];
  const requests = [];
  const responses = [];
  const context = vm.createContext({
    ...learning, createWebPairingCode: () => "TESTCODE",
    isEnglishCloudConfigured: () => false,
    loadEnglishCoachProfile: async () => null,
    saveEnglishCoachProfile: async () => {},
    fs, path, Buffer, AbortSignal,
    http: {}, net: {}, WebSocket: class {}, nodemailer: {}, Zalo: class {},
    Reactions: {}, ThreadType: { User: 0, Group: 1 }, dotenv: { config() {} },
    console: { log() {}, warn() {}, error() {} },
    process: {
      env: {
        GEMINI_API_KEY: "test-placeholder", RATE_LIMIT_ENABLED: "false",
        ENGLISH_COACH_ENABLED: "true", ENGLISH_DEFAULT_LEVEL: "A2",
        HISTORY_DIR: path.join(tempRoot, "history"),
        ENGLISH_COACH_DIR: path.join(tempRoot, "progress"),
        ...env,
      },
      exit() { throw new Error("Bot startup must not execute in tests"); },
    },
    setInterval() { throw new Error("Schedulers must not start in tests"); },
    fetch: async (url, options) => {
      requests.push({ url, body: JSON.parse(options.body) });
      const response = responses.shift() || { content: "Sure! Would you like it hot or iced?" };
      if (response.throws) throw new Error("Simulated network failure");
      return {
        ok: response.ok !== false, status: response.status || 200,
        text: async () => "Simulated API error",
        json: async () => ({ choices: [{ message: { content: response.content ?? "" } }] }),
      };
    },
  });
  vm.runInContext(`${source}\nglobalThis.coach = {
    handleEnglishCommand, loadEnglishProgress, saveEnglishProgress,
    englishHistoryId, getHistory, englishSupportAction, findEnglishTopic,
    localDateKey, deliverScheduledVocabulary, runtime: coachRuntime,
  };`, context, { filename: "bot.mjs" });
  const api = { sendMessage: async payload => messages.push(payload.msg) };
  const message = { threadId: "learner-1", type: 0, data: { uidFrom: "learner-1" } };
  return {
    ...context.coach, messages, requests, responses,
    failCloud: value => { context.isEnglishCloudConfigured = () => { if (value) throw new Error("Cloud unavailable"); return false; }; },
    send: (text, user = "learner-1", type = 0) => context.coach.handleEnglishCommand(
      api, { ...message, threadId: user, type, data: { uidFrom: user } }, text
    ),
    state: (user = "learner-1") => context.coach.loadEnglishProgress(user),
    deliverVocabulary: () => context.coach.deliverScheduledVocabulary(api, "learner-1.json"),
  };
}

test("a serverless POSIX timezone does not prevent lessons from starting", async t => {
  const coach = createCoach(t, { TZ: ":UTC" });
  assert.equal(coach.localDateKey(new Date("2026-10-22T18:00:00Z")), "2026-10-23");
  const result = await coach.runtime.command("learner-1", "/english lesson smalltalk");
  assert.equal(result.session.active, true);
  assert.match(result.messages[0].text, /Nice to meet you/);
});

test("web lesson opens a session and surfaces command failures without blocking the next request", async t => {
  const coach = createCoach(t);
  coach.failCloud(true);
  await assert.rejects(coach.runtime.command("learner-1", "/english lesson cafe"), /Cloud unavailable/);
  coach.failCloud(false);
  const result = await coach.runtime.command("learner-1", "/english lesson cafe");
  assert.equal(result.session.active, true);
  assert.equal(result.session.topic, "cafe");
  assert.match(result.notifications[0], /Welcome! What would you like to order/);
  assert.equal(result.messages.length, 1);
});

test("the first learner answer follows the saved opening in the assigned role", async t => {
  const coach = createCoach(t);
  await coach.send("/english lesson cafe");
  let state = coach.state();
  assert.equal(state.mode, "lesson");
  assert.equal(state.currentSession.targetTurns, 8);
  assert.match(coach.messages[0], /khách gọi món/);
  assert.match(coach.messages[0], /nhân viên quán cà phê/);
  assert.equal(coach.requests.length, 0);
  await coach.send("I'd like a latte, please.");
  const request = coach.requests[0].body;
  assert(request.messages.some(item => item.role === "assistant" && /What would you like to order/.test(item.content)));
  assert.equal(request.messages.at(-1).content, "I'd like a latte, please.");
  assert.match(request.messages[0].content, /không bắt đầu lại/);
  assert(!request.messages.some(item => /TÍN HIỆU HỘI THOẠI/.test(item.content)));
  assert(!request.messages[0].content.includes("Bạn là Ham Si Tơ"));
  assert(!coach.messages.at(-1).includes("XP"));
  assert.equal(coach.state().sessionTurns, 1);
});

test("help requests use the pending conversation without earning XP or replacing history", async t => {
  const coach = createCoach(t);
  await coach.send("/english start cafe");
  for (const text of ["gợi ý", "không hiểu", "/english example", "/english repeat"]) {
    const before = JSON.stringify(coach.state());
    const state = coach.state();
    const historyId = coach.englishHistoryId("learner-1", state);
    const history = JSON.stringify(coach.getHistory(historyId));
    await coach.send(text);
    assert.equal(JSON.stringify(coach.state()), before, text);
    assert.equal(JSON.stringify(coach.getHistory(historyId)), history, text);
    assert(coach.requests.at(-1).body.messages.some(item => item.role === "assistant" && /What would you like to order/.test(item.content)));
  }
  await coach.send("I'd like a latte.");
  assert.equal(coach.state().sessionTurns, 1);
  assert(!coach.requests.at(-1).body.messages.some(item => /Đây là yêu cầu hỗ trợ/.test(item.content)));
});

test("eight guided turns produce a review and conversation continues without a forced quiz", async t => {
  const coach = createCoach(t);
  await coach.send("/english lesson cafe");
  const historyId = coach.state().practiceHistoryId;
  for (let turn = 0; turn < 8; turn++) await coach.send(`Practice reply ${turn + 1}`);
  let state = coach.state();
  assert.equal(state.mode, "conversation");
  assert.equal(state.active, true);
  assert.equal(state.quiz, null);
  assert.equal(state.game.lessonsCompleted, 1);
  assert.equal(state.practiceHistoryId, historyId);
  assert.match(coach.requests.at(-1).body.messages[0].content, /Đã tới mốc ôn nhanh/);
  assert.equal(coach.requests.at(-1).body.messages.at(-1).content, "Practice reply 8");
  await coach.send("Can I pay by card?");
  state = coach.state();
  assert.equal(state.sessionTurns, 9);
  assert.equal(state.game.lessonsCompleted, 1);
  assert.equal(state.active, true);
  await coach.send("/english stop");
  assert.equal(coach.state().active, false);
  assert.equal(coach.state().sessionLog.at(-1).status, "completed");
});

test("a new topic has separate history and preserves the previous session", async t => {
  const coach = createCoach(t);
  await coach.send("/english start cafe");
  await coach.send("I'd like a latte.");
  const oldHistoryId = coach.state().practiceHistoryId;
  const oldHistory = JSON.stringify(coach.getHistory(oldHistoryId));
  await coach.send("/english start công việc");
  assert.equal(coach.state().topic, "work");
  assert.notEqual(coach.state().practiceHistoryId, oldHistoryId);
  await coach.send("I'm working on the schedule.");
  const dialogue = coach.requests.at(-1).body.messages.filter(item => item.role !== "system");
  assert(!dialogue.some(item => item.content === "I'd like a latte."));
  assert.equal(JSON.stringify(coach.getHistory(oldHistoryId)), oldHistory);
  assert.equal(coach.state().sessionLog.length, 2);
});

test("different learners have independent scenarios and helper history", async t => {
  const coach = createCoach(t);
  await coach.send("/english start cafe");
  await coach.send("/english start du lịch", "learner-2");
  await coach.send("không hiểu", "learner-2");
  assert.equal(coach.state("learner-2").topic, "travel");
  assert.equal(coach.state().topic, "cafe");
  assert(coach.requests.at(-1).body.messages.some(item => /Riverside Hotel/.test(item.content)));
  assert(!coach.requests.at(-1).body.messages.some(item => /What would you like to order/.test(item.content)));
});

test("failed and empty Gemini replies do not consume a learner turn or XP", async t => {
  const coach = createCoach(t);
  await coach.send("/english lesson cafe");
  const before = JSON.stringify(coach.state());
  const historyId = coach.state().practiceHistoryId;
  const history = JSON.stringify(coach.getHistory(historyId));
  for (const failure of [{ ok: false, status: 429 }, { throws: true }]) {
    coach.responses.push(failure);
    await coach.send("I'd like a latte.");
    assert.equal(JSON.stringify(coach.state()), before);
  }
  coach.responses.push({ content: "" }, { content: "" });
  await coach.send("I'd like a latte.");
  assert.equal(JSON.stringify(coach.state()), before);
  assert.equal(JSON.stringify(coach.getHistory(historyId)), history);
});

test("the Gemini retry preserves the partner's question", async t => {
  const coach = createCoach(t);
  await coach.send("/english start cafe");
  coach.responses.push({ content: "" }, { content: "Sure! Hot or iced?" });
  await coach.send("I'd like a latte.");
  assert.equal(coach.requests.length, 2);
  assert(coach.requests[1].body.messages.some(item => item.role === "assistant" && /What would you like to order/.test(item.content)));
  assert.equal(coach.state().sessionTurns, 1);
});

test("legacy progress can continue and an explicit quiz still works", async t => {
  const coach = createCoach(t);
  const state = coach.state();
  delete state.practiceHistoryId;
  state.version = 2;
  state.active = true;
  state.topic = "cafe";
  coach.saveEnglishProgress("learner-1", state);
  await coach.send("I'd like a latte.");
  assert.equal(coach.state().sessionTurns, 1);
  await coach.send("/english quiz");
  assert.equal(coach.state().mode, "quiz");
  const answer = coach.state().quiz.questions[0].answer;
  await coach.send(["A", "B", "C"][answer]);
  assert.equal(coach.state().quiz.index, 1);
});

test("English commands remain DM-only and help is available without a session", async t => {
  const coach = createCoach(t);
  assert.equal(await coach.send("/english start cafe", "group-1", 1), false);
  await coach.send("/english hint");
  assert.equal(coach.requests.length, 0);
  assert.match(coach.messages.at(-1), /english start cafe/);
  await coach.send("/english");
  assert.equal(coach.state().active, true);
  await coach.send("/english stop");
  assert.equal(await coach.send("Just a normal message."), false);
});

test("scheduled vocabulary delivery preserves the active conversation and runs once per day", async t => {
  const coach = createCoach(t);
  await coach.send("/english lesson cafe");
  const state = coach.state();
  const historyId = state.practiceHistoryId;
  const words = ["order", "menu", "coffee", "small", "please"];
  state.dailyVocab.enabled = true;
  state.dailyVocab.deliveryHour = 0;
  state.dailyVocab.deliveryMinute = 0;
  state.dailyVocab.lesson = {
    date: coach.localDateKey(), title: "At the cafe", theme: "Cafe", level: "A2",
    words: words.map(word => ({ word, meaning: "test meaning" })),
    paragraph: "__1__ __2__ __3__ __4__ __5__", wordBank: words, answers: words,
  };
  coach.saveEnglishProgress("learner-1", state);
  await coach.deliverVocabulary();
  await coach.deliverVocabulary();
  assert.equal(coach.messages.length, 2);
  assert.equal(coach.requests.length, 0);
  const after = coach.state();
  assert.equal(after.mode, "lesson");
  assert.equal(after.active, true);
  assert.equal(after.topic, "cafe");
  assert.equal(after.practiceHistoryId, historyId);
  assert.equal(after.dailyVocab.lastDeliveredDate, coach.localDateKey());
});

test("structured coaching saves evidence and phrases while keeping JSON out of chat history", async t => {
  const coach = createCoach(t);
  await coach.send("/english start cafe");
  coach.responses.push({ content: JSON.stringify({ reply: "A latte, of course. Would you like it iced?", feedback: "Dùng I'd like để gọi món lịch sự hơn.", correction: { original: "I want a latte", corrected: "I'd like a latte", reason: "Gọi món lịch sự", skill: "clarity" }, phrases: [{ english: "Would you like it iced?", vietnamese: "Bạn muốn dùng với đá không?" }] }) });
  await coach.send("I want a latte");
  const state = coach.state();
  assert.equal(state.learning.corrections.length, 1);
  assert.equal(state.learning.cards.length, 1);
  assert.match(coach.messages.at(-1), /A latte, of course/);
  const history = coach.getHistory(coach.englishHistoryId("learner-1", state));
  assert(!JSON.stringify(history).includes('"phrases"'));
  assert.equal(history.at(-2).parts[0].text, "I want a latte");
});

test("goal-based today command starts a lesson and cards require an explicit recall rating", async t => {
  const coach = createCoach(t);
  await coach.send("/english goal Giao tiếp công việc");
  await coach.send("/english time 20");
  await coach.send("/english today");
  assert.equal(coach.state().mode, "lesson");
  assert.equal(coach.state().learning.minutesPerDay, 20);
  const state = coach.state();
  state.learning.cards.push({ id: "remember-one", english: "Nice to meet you.", vietnamese: "Rất vui được gặp bạn.", stage: 0, dueAt: 0 });
  coach.saveEnglishProgress("learner-1", state);
  await coach.send("/english cards");
  assert(!coach.messages.at(-1).includes("Nice to meet you."));
  await coach.send("/english card show");
  assert.match(coach.messages.at(-1), /Nice to meet you/);
  await coach.send("/english card good");
  assert(coach.state().learning.cards[0].dueAt > Date.now());
});
