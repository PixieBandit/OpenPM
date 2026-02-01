
const fs = require("node:fs");
const path = require("node:path");

const decode = (s) => Buffer.from(s, "base64").toString();
const CLIENT_ID = decode("MTA3MTAwNjA2MDU5MS10bWhzc2luMmgyMWxjcmUyMzV2dG9sb2poNGc0MDNlcC5hcHBzLmdvb2dsZXVzZXJjb250ZW50LmNvbQ==");
const CLIENT_SECRET = decode("R09DU1BYLUs1OEZXUjQ4NkxkTEoxbUxCOHNYQzR6NnFEQWY=");
const TOKEN_URL = "https://oauth2.googleapis.com/token";

async function refresh() {
    const sessionPath = path.join("Q:", "ProgramCentral", "TestAntiGrav", "session.json");
    if (!fs.existsSync(sessionPath)) {
        console.log("No session.json found");
        return;
    }
    const session = JSON.parse(fs.readFileSync(sessionPath, "utf8"));
    const refreshToken = session.refresh_token;

    if (!refreshToken) {
        console.log("No refresh_token found in session.json");
        return;
    }

    console.log("Refreshing access token...");
    try {
        const res = await fetch(TOKEN_URL, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                refresh_token: refreshToken,
                grant_type: "refresh_token",
            }),
        });

        const data = await res.json();
        if (!res.ok) {
            console.error("❌ Refresh Failed:", JSON.stringify(data, null, 2));
            return;
        }

        console.log("✅ Refresh Successful.");
        session.access_token = data.access_token;
        if (data.refresh_token) session.refresh_token = data.refresh_token; // Sometimes provider gives new refresh token
        fs.writeFileSync(sessionPath, JSON.stringify(session, null, 2));
    } catch (e) {
        console.error("❌ Error:", e.message);
    }
}

refresh();
