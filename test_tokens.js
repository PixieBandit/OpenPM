
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
    const url = "https://cloudaicompanion.googleapis.com/v1internal:countTokens";

    const body = {
        metadata: { ideType: "IDE_UNSPECIFIED" },
        prompt: "Test token count"
    };

    try {
        const res = await fetch(url, {
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
        console.log(`Response: ${data}`);
    } catch (e) {
        console.log(`Error: ${e.message}`);
    }
}

test();
