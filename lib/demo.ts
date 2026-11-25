// Demo mode: the app runs on an embedded PGlite snapshot (demo/pgdata.tar.gz) with recorded
// model output, signed in as a fictional candidate. No database server, no model, no keys.
export const DEMO = process.env.DEMO_MODE === "1";
export const DEMO_USER_ID = "demo-candidate";
export const DEMO_EMAIL = "demo@shortlist.local";
export const DEMO_UNAVAILABLE = "This runs on your own machine with the local model. The demo shows recorded results.";

// Searches with recorded embeddings, so semantic search works for them in the demo.
export const DEMO_QUERIES = [
  "frontend internship in India",
  "LLM evaluation",
  "react developer remote europe",
  "backend engineer bangalore",
  "machine learning intern",
];
