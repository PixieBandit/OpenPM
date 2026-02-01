
const fs = require("node:fs");
const path = require("node:path");

async function run() {
    const sessionPath = path.join("Q:", "ProgramCentral", "TestAntiGrav", "session.json");
    if (!fs.existsSync(sessionPath)) return;
    const session = JSON.parse(fs.readFileSync(sessionPath, "utf8"));
    const accessToken = session.access_token;
    const PROJECT_ID = "nodal-zodiac-7f3h4";

    const endpoint = "https://cloudcode-pa.googleapis.com/v1internal:streamGenerateContent";
    const models = [
        "gemini-3.0-flash-preview",
        "gemini-3-flash-preview"
    ];

    for (const modelName of models) {
        console.log(`\nTesting Model: ${modelName}`);
        const body = {
            request: {
                model: `projects/${PROJECT_ID}/locations/global/publishers/google/models/${modelName}`,
                contents: [{ role: "user", parts: [{ text: "Hello Gemini 3.0! Are you there?" }] }]
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
            console.log(`Response: ${text.substring(0, 500)}`);
        } catch (e) {
            console.error("❌ Error:", e.message);
        }
    }
}

run();
