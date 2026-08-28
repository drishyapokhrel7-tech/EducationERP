#!/usr/bin/env node
/**
 * One-time setup script. Run this once to obtain a refresh token
 * covering BOTH: Google Drive storage (Phase 7h — Documents &
 * Certificates) and sending real verification/reset-code/notification
 * email via Gmail (services/api/src/modules/communication/
 * delivery-provider.ts, EMAIL_DRIVER="gmail"). It never runs as part
 * of the app itself. If you already have a GOOGLE_REFRESH_TOKEN from
 * running the old drive-only version of this script, re-run this once
 * to get a new token that also covers Gmail — the old one only has
 * the drive.file scope and cannot send mail.
 *
 * Usage:
 *   GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... node scripts/google-get-refresh-token.js
 *
 * The redirect URI below (http://localhost:4500/oauth2callback) must
 * be added as an "Authorized redirect URI" on this OAuth client in
 * Google Cloud Console (APIs & Services -> Credentials -> your OAuth
 * client -> Authorized redirect URIs) before running this. The Gmail
 * API must also be enabled for this same project (APIs & Services ->
 * Library -> Gmail API -> Enable) or the consent screen will still
 * work but sending will fail later.
 *
 * This opens a local server, prints a URL for YOU to open in YOUR OWN
 * browser (already signed into the Google account that should own
 * Drive storage and send this app's email), and waits for the
 * redirect back with an authorization code, which it exchanges for a
 * refresh token.
 */
const http = require("http");
const { google } = require("googleapis");

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = "http://localhost:4500/oauth2callback";

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in the environment first.");
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

// drive.file (not the broad "drive" scope — the app can only ever
// see/manage files it creates itself) + gmail.send (send-only, can't
// read the mailbox) — narrowest scopes that do both jobs.
const authUrl = oauth2Client.generateAuthUrl({
  access_type: "offline",
  prompt: "consent", // forces a refresh_token even on a re-auth
  scope: [
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/gmail.send",
  ],
});

console.log(
  "\nOpen this URL in YOUR OWN browser (signed into the Google account\nthat should store these documents and send this app's email) and\napprove access:\n",
);
console.log(authUrl);
console.log("\nWaiting for the redirect back to localhost:4500 ...\n");

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, REDIRECT_URI);
  if (url.pathname !== "/oauth2callback") {
    res.writeHead(404);
    res.end();
    return;
  }
  const code = url.searchParams.get("code");
  if (!code) {
    res.writeHead(400, { "Content-Type": "text/plain" });
    res.end("No authorization code in the callback.");
    return;
  }
  try {
    const { tokens } = await oauth2Client.getToken(code);
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Done — you can close this tab and check the terminal.");
    if (tokens.refresh_token) {
      console.log("Success. Add this to services/api/.env:\n");
      console.log(`GOOGLE_REFRESH_TOKEN="${tokens.refresh_token}"`);
      console.log(
        "\nAlso set (if sending real email):\n  EMAIL_DRIVER=\"gmail\"\n  GMAIL_SENDER_EMAIL=\"<the address you just signed in with>\"",
      );
    } else {
      console.log(
        "No refresh_token came back — this Google account may already have an\nactive grant for this app. Revoke it at https://myaccount.google.com/permissions\nand run this script again.",
      );
    }
  } catch (err) {
    console.error("Token exchange failed:", err.message);
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end("Token exchange failed — check the terminal.");
  } finally {
    server.close();
  }
});

server.listen(4500);
