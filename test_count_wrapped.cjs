
const fs = require("node:fs");
const path = require("node:path");

async function run() {
    const sessionPath = path.join("Q:", "ProgramCentral", "TestAntiGrav", "session.json");
    if (!fs.existsSync(sessionPath)) return;
    const session = JSON.parse(fs.readFileSync(sessionPath, "utf8"));
    const accessToken = session.access_token;

    const endpoint = "https://cloudcode-pa.googleapis.com/v1internal:countTokens";

    const body = {
        request: {
            model: "projects/nodal-zodiac-7f3h4/locations/us-central1/publishers/google/models/gemini-3-pro-preview",
            contents: [{ role: "user", parts: [{ text: "Test token count" }] }]
        }
    };

    try {
        const res = await fetch(endpoint, {
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
