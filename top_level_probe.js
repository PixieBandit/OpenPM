
import path from 'path';
import os from 'os';
import Database from 'better-sqlite3';

const getIdeToken = () => {
    const dbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'Antigravity', 'User', 'globalStorage', 'state.vscdb');
    try {
        const db = new Database(dbPath, { readonly: true });
        const row = db.prepare("SELECT value FROM ItemTable WHERE key = 'antigravityAuthStatus'").get();
        db.close();
        if (row && row.value) {
            const match = row.value.match(/ya29\.[a-zA-Z0-9_\-\.]+/);
            if (match) return match[0];
        }
    } catch (error) { }
    return null;
};

async function test() {
    const token = getIdeToken();
    const endpoint = "https://cloudcode-pa.googleapis.com/v1internal:generateContent";
    const models = ["gemini-3-flash-preview", "gemini-3-pro-preview"];

    for (const model of models) {
        console.log(`\nTesting Top-Level Payload: ${model}`);
        const body = {
            metadata: {
                ideType: "VSCODE",
                platform: "PLATFORM_UNSPECIFIED",
                pluginType: "GEMINI"
            },
            contents: [{ role: "user", parts: [{ text: "echo 'Replied'" }] }],
            model: model
        };

        try {
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'X-Goog-Api-Client': 'google-cloud-sdk vscode_cloudshelleditor/0.1'
                },
                body: JSON.stringify(body)
            });

            console.log(`Status: ${res.status} ${res.statusText}`);
            const data = await res.text();
            console.log(`Response: ${data.substring(0, 500)}`);
        } catch (e) {
            console.log(`Error: ${e.message}`);
        }
    }
}

test();
