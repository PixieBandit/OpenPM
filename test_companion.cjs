
const fs = require("node:fs");
const path = require("node:path");

async function run() {
    const sessionPath = path.join("Q:", "ProgramCentral", "TestAntiGrav", "session.json");
    if (!fs.existsSync(sessionPath)) return;
    const session = JSON.parse(fs.readFileSync(sessionPath, "utf8"));
    const accessToken = session.access_token;
    const PROJECT_ID = "nodal-zodiac-7f3h4";

    const url = `https://cloudaicompanion.googleapis.com/v1/projects/${PROJECT_ID}/locations/global/companions/default:generateChat`;

    const body = {
        prompt: "Hello Gemini 3. Are you there? This is an automated probe."
    };

    try {
        const res = await fetch(url, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
                "X-Goog-Api-Client": "google-cloud-sdk vscode_cloudshelleditor/0.1"
            },
            body: JSON.stringify(body)
        });

        console.log(`Status: ${res.status}`);
        const data = await res.text();
        console.log(`Response: ${data}`);
    } catch (e) {
        console.error("❌ Error:", e.message);
    }
}

run();
