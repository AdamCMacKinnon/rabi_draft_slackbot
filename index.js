import pkg from "@slack/bolt";
const { App } = pkg;
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  appToken: process.env.SLACK_APP_TOKEN,
  socketMode: true,
});

const DRAFT_FILE = "./draftOrder.json";
let draft = JSON.parse(fs.readFileSync(DRAFT_FILE, "utf8"));

const TOTAL_ROUNDS = 5;

function saveDraft() {
  fs.writeFileSync(DRAFT_FILE, JSON.stringify(draft, null, 2));
}

async function postNextPick() {
  const userId = draft.rounds[draft.currentRound - 1][draft.currentIndex];
  const round = draft.currentRound;

  const result = await app.client.chat.postMessage({
    channel: process.env.SLACK_CHANNEL,
    text: `📢 Round ${round}, Pick ${
      draft.currentIndex + 1
    }: <@${userId}> you’re up! Reply to this message with your pick.`,
  });

  draft.currentThread = result.ts;
  saveDraft();
}

app.event("message", async ({ event, say }) => {
  console.log("Message event received:", {
    user: event.user,
    text: event.text,
    thread_ts: event.thread_ts,
    currentThread: draft.currentThread,
    currentUser: draft.order[draft.currentIndex],
  });
  // Ignore bot messages
  if (event.subtype === "bot_message") return;

  // Only handle replies in the current thread
  if (event.thread_ts && event.thread_ts === draft.currentThread) {
    const currentUser = draft.order[draft.currentIndex];

    // Only accept replies from the user whose turn it is
    if (event.user === currentUser) {
      const pick = event.text.trim();
      const round = draft.currentRound;

      draft.picks.push({
        user: currentUser,
        pick,
        round,
      });
      saveDraft();

      // Announce pick
      await app.client.chat.postMessage({
        channel: process.env.DRAFT_CHANNEL_ID,
        text: `✅ Round ${round}, Pick ${
          draft.currentIndex + 1
        }: <@${currentUser}> drafted *${pick}*!`,
      });

      // Move to next pick
      draft.currentIndex++;

      // If we’ve reached the end of the order, move to next round
      if (draft.currentIndex >= draft.rounds[draft.currentRound - 1].length) {
        draft.currentRound++;
        draft.currentIndex = 0;
      }

      // If draft complete
      if (draft.currentRound > TOTAL_ROUNDS) {
        await app.client.chat.postMessage({
          channel: process.env.DRAFT_CHANNEL_ID,
          text: `🏁 Draft complete! ${TOTAL_ROUNDS} rounds done.`,
        });
      } else {
        await postNextPick();
      }
    } else {
      // Not their turn
      await say({
        text: `⛔ It’s not your turn yet.`,
        thread_ts: event.thread_ts,
      });
    }
  }
});

// Start the draft manually with a slash command
app.command("/startdraft", async ({ ack, respond }) => {
  await ack();
  draft.currentIndex = 0;
  draft.currentRound = 1;
  draft.picks = [];
  saveDraft();

  await respond(`🏁 Starting the draft! Total rounds: ${TOTAL_ROUNDS}`);
  await postNextPick();
});

(async () => {
  await app.start(process.env.PORT || 3000);
  console.log("⚾ Fantasy Draft Bot is running!");
})();
