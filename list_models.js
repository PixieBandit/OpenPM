
const apiKey = "AIzaSyDAINWlPcxA96mQcMvUjjlfTiCV82bJCsw";

async function list() {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    try {
        const res = await fetch(url);
        const data = await res.json();
        const geminiModels = data.models
            ? data.models.filter(m => m.name.includes('gemini') || m.name.includes('3.0') || m.name.includes('3-'))
            : [];
        console.log(geminiModels.map(m => m.name));
    } catch (e) {
        console.log(e.message);
    }
}
list();
