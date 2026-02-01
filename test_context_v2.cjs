
const BACKEND_URL = 'http://localhost:3001/api';
const MODEL = 'gemini-2.0-flash'; // Use flash for speed

async function runTest() {
    console.log('Testing Context Preservation...');

    // 1. Single turn (baseline)
    // This mimics what the current code does (stateless) if we just send the second question.
    console.log('\n--- Baseline Check (Stateless) ---');
    try {
        const response1 = await generate('What is my name?');
        console.log('Response (No Context):', response1);
    } catch (e) {
        console.log('Baseline failed (expected if no context):', e.message);
    }

    // 2. Multi-turn (Context Check)
    console.log('\n--- Context Check (Multi-turn) ---');

    const history = [
        { role: 'user', parts: [{ text: "My name is Maverick." }] },
        { role: 'model', parts: [{ text: "Hello Maverick, nice to meet you." }] }
    ];

    const question = "What is my name?";

    const payload = {
        model: MODEL,
        contents: [
            ...history,
            { role: 'user', parts: [{ text: question }] }
        ]
    };

    try {
        const res = await fetch(`${BACKEND_URL}/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const txt = await res.text();
            throw new Error(`API Error: ${res.status} ${txt}`);
        }

        const data = await res.json();
        const answer = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        console.log('Response (With Context):', answer);

        if (answer.includes('Maverick')) {
            console.log('✅ PASS: Context was preserved! Backend supports multi-turn.');
        } else {
            console.log('❌ FAIL: Context lost. Backend might not support multi-turn or model ignored it.');
        }

    } catch (e) {
        console.error('Test Failed:', e);
    }
}

async function generate(prompt) {
    const res = await fetch(`${BACKEND_URL}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: MODEL,
            contents: [{ parts: [{ text: prompt }] }]
        })
    });
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

runTest();
