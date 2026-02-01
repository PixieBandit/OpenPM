
async function test() {
    const res = await fetch('http://localhost:3001/api/debug/test-antigravity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'gemini-3-flash-preview' })
    });
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
}
test();
