import test from "node:test";
import assert from "node:assert/strict";
import { ensureLearningState, parseEnglishLearningReply, recordEnglishLearning, reviewLearningCard, getLearningSnapshot } from "../english-learning.mjs";

test("only corrections quoted from the learner and phrases used in the conversation are kept", () => {
  const turn = parseEnglishLearningReply(JSON.stringify({ reply: "A latte? Sure. What size would you like?", correction: { original: "I want coffee", corrected: "I'd like a coffee", reason: "Lịch sự hơn", skill: "clarity" }, phrases: [{ english: "What size would you like?", vietnamese: "Bạn muốn cỡ nào?" }, { english: "Invented phrase", vietnamese: "Không hề xuất hiện" }] }), "I want coffee");
  assert.equal(turn.correction.original, "I want coffee");
  assert.equal(turn.phrases.length, 1);
  const madeUp = parseEnglishLearningReply(JSON.stringify({ reply: "Sure!", correction: { original: "She go yesterday", corrected: "She went yesterday" } }), "I'd like a latte.");
  assert.equal(madeUp.correction, null);
});

test("actual corrections repeat-count without duplicating cards", () => {
  const state = { level: "A2" };
  const turn = { reply: "What size would you like?", feedback: "", correction: { original: "she go", corrected: "she goes", reason: "Thêm s", skill: "grammar" }, phrases: [{ english: "What size would you like?", vietnamese: "Bạn muốn cỡ nào?" }] };
  recordEnglishLearning(state, turn, "cafe", 1000);
  recordEnglishLearning(state, turn, "cafe", 2000);
  assert.equal(state.learning.corrections.length, 1);
  assert.equal(state.learning.corrections[0].count, 2);
  assert.equal(state.learning.cards.length, 1);
  assert.equal(state.learning.lastReply.at, 2000);
});

test("card recall schedules 1 day, 3 days and a 10-minute relearning interval", () => {
  const state = { learning: { cards: [{ id: "one", stage: 0, dueAt: 0, reviews: 0 }] } };
  reviewLearningCard(state, "one", "good", 0);
  assert.equal(state.learning.cards[0].dueAt, 86_400_000);
  reviewLearningCard(state, "one", "good", 86_400_000);
  assert.equal(state.learning.cards[0].dueAt, 4 * 86_400_000);
  reviewLearningCard(state, "one", "again", 1000);
  assert.equal(state.learning.cards[0].dueAt, 601000);
  assert.equal(state.learning.cards[0].stage, 0);
  assert.throws(() => reviewLearningCard(state, "missing", "good"));
  assert.throws(() => reviewLearningCard(state, "one", "invented"));
});

test("Vietnamese work and travel goals reorder the recommended study plan", () => {
  const work = { level: "A2", learning: { goal: "Giao tiếp công việc và trao đổi với đồng nghiệp" }, topics: { smalltalk: 8 } };
  assert.equal(getLearningSnapshot(work).recommended.topic, "work");
  const travel = { level: "A2", learning: { goal: "Giao tiếp khi đi du lịch" }, topics: { smalltalk: 8 } };
  assert.equal(getLearningSnapshot(travel).recommended.topic, "cafe");
});

test("an empty learner profile has no invented weaknesses, achievements or cards", () => {
  const result = getLearningSnapshot({ level: "A2" });
  assert.equal(result.totalTurns, 0);
  assert.equal(result.dueCount, 0);
  assert.equal(result.practicedUnits, 0);
  assert(result.weaknesses.every(item => item.count === 0));
  assert.equal(result.corrections.length, 0);
  assert.equal(result.plan.length, 10);
});

test("plain replies remain compatible and malformed structured output is rejected", () => {
  assert.equal(parseEnglishLearningReply("What would you like?", "Hello").reply, "What would you like?");
  assert.equal(parseEnglishLearningReply('{"reply":', "Hello"), null);
  const state = { learning: { minutesPerDay: 999, goal: "" } };
  assert.equal(ensureLearningState(state).minutesPerDay, 15);
});
