
const fs = require("node:fs");
const path = require("node:path");

async function run() {
    const sessionPath = path.join("Q:", "ProgramCentral", "TestAntiGrav", "session.json");
    if (!fs.existsSync(sessionPath)) return;
    const session = JSON.parse(fs.readFileSync(sessionPath, "utf8"));
    const accessToken = session.access_token;

    const endpoint = "https://cloudcode-pa.googleapis.com/v1internal:listModels";

    try {
        const res = await fetch(endpoint, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
                "X-Goog-Api-Client": "google-cloud-sdk vscode_cloudshelleditor/0.1"
            },
            body: JSON.stringify({
                metadata: {
                    ideType: "VSCODE",
                    platform: "PLATFORM_UNSPECIFIED",
                    pluginType: "GEMINI"
                }
            })
        });

        console.log(`Status: ${res.status}`);
        const data = await res.json();
        console.log("Response:", JSON.stringify(data, null, 2));
    } catch (e) {
        console.error("❌ Error:", e.message);
    }
}

run();
