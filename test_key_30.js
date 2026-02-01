
const apiKey = "AIzaSyDAINWlPcxA96mQcMvUjjlfTiCV82bJCsw";

async function run() {
    const model = "gemini-3.0-flash-preview";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    console.log(`Testing model ${model} with API Key...`);
    try {
        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ role: "user", parts: [{ text: "Hello! Confirm 3.0 working." }] }]
            })
        });

        console.log(`Status: ${res.status}`);
        const data = await res.json();
        console.log("Response:", JSON.stringify(data, null, 2));
    } catch (e) {
        console.log(e.message);
    }
}
run();
