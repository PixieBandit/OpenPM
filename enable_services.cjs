
const fs = require("node:fs");
const path = require("node:path");

async function run() {
    const sessionPath = path.join("Q:", "ProgramCentral", "TestAntiGrav", "session.json");
    if (!fs.existsSync(sessionPath)) return;
    const session = JSON.parse(fs.readFileSync(sessionPath, "utf8"));
    const accessToken = session.access_token;
    const PROJECT_ID = "nodal-zodiac-7f3h4";

    const services = [
        "cloudaicompanion.googleapis.com",
        "aiplatform.googleapis.com",
        "generativelanguage.googleapis.com"
    ];

    for (const service of services) {
        console.log(`\nAttempting to enable service: ${service}`);
        const url = `https://serviceusage.googleapis.com/v1/projects/${PROJECT_ID}/services/${service}:enable`;

        try {
            const res = await fetch(url, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/json"
                }
            });

            console.log(`Status: ${res.status}`);
            const data = await res.json();
            console.log("Response:", JSON.stringify(data, null, 2));
        } catch (e) {
            console.error("❌ Error:", e.message);
        }
    }
}

run();
