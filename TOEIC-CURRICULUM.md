# TOEIC learning path

## Research and scope

Public pages reviewed on 23 October 2026:

- [IIG Vietnam: TOEIC structure](https://iigvietnam.com/bai-thi-toeic/): the authoritative format reference. Listening has 100 questions across Parts 1–4, about 45 minutes; Reading has 100 across Parts 5–7, 75 minutes. Part counts: 6, 25, 39, 30, 30, 16, 54.
- [The MVP TOEIC methodology](https://www.themvptoeic.com/methodology) and [courses](https://www.themvptoeic.com/courses): public descriptions organize preparation around diagnosis, foundations, targeted practice and review. No private lesson material or code was accessed or reused.
- [STUDY4 course walkthrough](https://study4.com/posts/4446/huong-dan-hoc-thu-khoa-complete-toeic-cua-study4/): public examples pair theory with practice, then transcript/explanation review. Goals inform study priorities.
- [OpenQuiz](https://openquiz.ai/vi/): vocabulary in context and spaced review inform links to the existing vocabulary notebook; this is distinct from TOEIC exam assessment.

All questions, scripts, explanations and teaching notes in `english-toeic-course.mjs` are newly authored for this application. No commercial question bank, recordings, branding or implementation was copied.

## Implemented path

1. Choose a planning target: 450, 650 or 800. This changes recommendation ordering, not test scoring or a promised outcome.
2. Optional 22-question skills survey covers all seven Parts. It reuses first-round library material and is explicitly not a standardized placement test or score estimator.
3. Study 14 focused lessons across three stages: short-sentence foundations (1, 2, 5), context (3, 4, 6), and document comparison plus consolidation (7).
4. Each lesson includes a distinct objective, explanation, worked example, procedure, trap and related vocabulary.
5. Submit answers for server-side marking. Review choices, transcript and evidence in Vietnamese. Persist history and revisit explanations later.
6. Retry questions whose most recent response was wrong. Recommendations prioritize Parts below 80% on their most recent relevant attempt. A lesson marker uses its latest lesson attempt only, not the survey.

## Assessment limits

- The initial bank has 44 questions. This is a foundation library, not a complete preparation course for 800+.
- Part 1 uses illustrations for familiarization; the real test uses photographs.
- Browser speech synthesis provides practice listening. It does not reproduce real recordings, multiple authentic accents, or official playback conditions.
- Practice permits replay and optionally viewing transcripts. A submission records whether transcript support was opened in the current page session.
- Internal percentages and the 80% review threshold must not be converted into a TOEIC 10–990 estimate or a CEFR level.
- There is no 200-question full mock, calibrated item difficulty, validated placement score or promised completion date.
- No speculative week-by-week deadline is assigned without an actual starting level and available study time.

## State and operation

`state.learning.toeic` stores the target, an active attempt, and up to 80 results. The normal profile persistence syncs these to Supabase. Answers in progress are temporarily stored per attempt in the current browser tab; submitted results persist across devices. Server snapshots omit correct answers and explanations until submission or retrieval of an already submitted result. The public lesson catalog loads with the profile; detailed question groups load when an attempt starts.

Future content expansion should add independently authored or licensed recordings, photograph-based Part 1 items, more grammar units, longer multi-document reading and a separately authored full-length mock bank. These should be labeled available only when actually implemented.
