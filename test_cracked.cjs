
const fs = require("node:fs");
const path = require("node:path");

async function run() {
    const sessionPath = path.join("Q:", "ProgramCentral", "TestAntiGrav", "session.json");
    if (!fs.existsSync(sessionPath)) {
        console.log("No session.json found at", sessionPath);
        return;
    }
    const session = JSON.parse(fs.readFileSync(sessionPath, "utf8"));
    const accessToken = session.access_token;
    const PROJECT_ID = "nodal-zodiac-7f3h4";

    const models = [
        "gemini-3-pro-preview",
        "gemini-3-flash-preview",
        "gemini-3-flash"
    ];

    const endpoint = "https://cloudcode-pa.googleapis.com/v1internal:streamGenerateContent";

    for (const modelName of models) {
        console.log(`\n--- Testing Model: ${modelName} ---`);
        const modelPath = `projects/${PROJECT_ID}/locations/us-central1/publishers/google/models/${modelName}`;

        const body = {
            request: {
                model: modelPath,
                contents: [{ role: "user", parts: [{ text: "Hello! If you are Gemini 3, please reply with 'YES I AM GEMINI 3'." }] }],
                generationConfig: {
                    maxOutputTokens: 100,
                    temperature: 0.1
                }
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

            if (res.status === 200) {
                console.log("✅ SUCCESS for " + modelName);
            }
        } catch (e) {
            console.error("❌ Error:", e.message);
        }
    }
}

run();
