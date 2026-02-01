
const fs = require("node:fs");
const path = require("node:path");

async function run() {
    const sessionPath = path.join("Q:", "ProgramCentral", "TestAntiGrav", "session.json");
    if (!fs.existsSync(sessionPath)) return;
    const session = JSON.parse(fs.readFileSync(sessionPath, "utf8"));
    const accessToken = session.access_token;

    const endpoint = "https://cloudcode-pa.googleapis.com/v1internal:generateContent";

    const body = {
        request: {
            model: "gemini-1.5-flash",
            contents: [{ role: "user", parts: [{ text: "echo 'Replied'" }] }]
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
        const text = await res.text();
        console.log(`Response: ${text.substring(0, 1000)}`);
    } catch (e) {
        console.error("❌ Error:", e.message);
    }
}

run();
