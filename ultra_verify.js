
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
    if (!token) {
        console.log("No IDE token found!");
        return;
    }
    console.log("Found IDE Token");

    const projects = ["nodal-zodiac-7f3h4", "rising-fact-p41fc", "openpm-486000"];
    const locations = ["us-central1", "global"];
    const endpoints = [
        "https://cloudcode-pa.googleapis.com",
        "https://cloudaicompanion.googleapis.com"
    ];
    const models = [
        "gemini-3-flash-preview",
        "gemini-3-pro-preview",
        "gemini-3-flash",
        "gemini-3-pro"
    ];

    for (const project of projects) {
        for (const location of locations) {
            for (const endpoint of endpoints) {
                for (const model of models) {
                    const url = `${endpoint}/v1internal:generateContent`;
                    const fullModelPath = `projects/${project}/locations/${location}/publishers/google/models/${model}`;

                    const body = {
                        request: {
                            model: fullModelPath,
                            contents: [{ role: "user", parts: [{ text: "echo '3.0 working'" }] }]
                        }
                    };

                    console.log(`\n--- Testing ---`);
                    console.log(`URL: ${url}`);
                    console.log(`ModelPath: ${fullModelPath}`);

                    try {
                        const res = await fetch(url, {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${token}`,
                                'Content-Type': 'application/json',
                                'X-Goog-Api-Client': 'google-cloud-sdk vscode_cloudshelleditor/0.1',
                                'Client-Metadata': JSON.stringify({
                                    ideType: 'VSCODE',
                                    platform: 'WINDOWS',
                                    pluginType: 'GEMINI'
                                })
                            },
                            body: JSON.stringify(body)
                        });

                        console.log(`Status: ${res.status} ${res.statusText}`);
                        const data = await res.text();
                        console.log(`Response: ${data.substring(0, 300)}`);

                        if (res.ok) {
                            console.log("✨ SUCCESS! This combination works.");
                            console.log("Data:", data);
                            process.exit(0);
                        }
                    } catch (e) {
                        console.log(`Error: ${e.message}`);
                    }
                }
            }
        }
    }
}

test();
