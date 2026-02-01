
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
    const endpoint = "https://cloudcode-pa.googleapis.com/v1internal:streamGenerateContent";
    const project = "nodal-zodiac-7f3h4";
    const models = ["gemini-3-flash-preview", "gemini-3-pro-preview"];

    for (const model of models) {
        console.log(`\nTesting Model: ${model}`);
        const body = {
            request: {
                model: `projects/${project}/locations/us-central1/publishers/google/models/${model}`,
                contents: [{ role: "user", parts: [{ text: "Hello Gemini 3! Confirm you are working." }] }],
                generationConfig: { maxOutputTokens: 100 }
            }
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
            console.log(`Response Snippet: ${data.substring(0, 500)}`);

            if (res.ok) {
                console.log("SUCCESS!");
            }
        } catch (e) {
            console.log(`Error: ${e.message}`);
        }
    }
}

test();
