
async function test() {
    console.log("--- Testing Real Generation PRO ---");
    const res = await fetch('http://localhost:3001/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: 'gemini-3-pro-preview',
            contents: [{ role: 'user', parts: [{ text: 'Who are you? Reply in one sentence.' }] }]
        })
    });
    console.log("Status:", res.status);
    const data = await res.json();
    console.log("Source:", res.headers.get('x-generation-source'));
    console.log("Response:", JSON.stringify(data, null, 2));
}
test();
