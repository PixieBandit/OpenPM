
const fs = require("node:fs");
const path = require("node:path");

async function run() {
    const sessionPath = path.join("Q:", "ProgramCentral", "TestAntiGrav", "session.json");
    if (!fs.existsSync(sessionPath)) return;
    const session = JSON.parse(fs.readFileSync(sessionPath, "utf8"));
    const accessToken = session.access_token;
    const PROJECT_ID = "nodal-zodiac-7f3h4";

    const endpoint = "https://cloudcode-pa.googleapis.com/v1internal:countTokens";
    const models = [
        "gemini-3.0-pro-preview",
        "gemini-3.0-flash-preview",
        "gemini-3-pro-preview",
        "gemini-3-flash-preview",
        "gemini-3-pro-preview-001",
        "gemini-3-flash-preview-001",
        "gemini-3.0-pro",
        "gemini-3.0-flash"
    ];

    for (const modelName of models) {
        process.stdout.write(`Testing model ${modelName} ... `);
        const body = {
            request: {
                model: `projects/${PROJECT_ID}/locations/us-central1/publishers/google/models/${modelName}`,
                contents: [{ role: "user", parts: [{ text: "hi" }] }]
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

            console.log(`[${res.status}]`);
            if (res.status === 200) {
                console.log("✅ FOUND VALID MODEL NAME");
            }
        } catch (e) {
            console.log("Error");
        }
    }
}

run();
