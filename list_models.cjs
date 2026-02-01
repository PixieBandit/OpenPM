
const fetch = require('node-fetch');
const apiKey = "AIzaSyDAINWlPcxA96mQcMvUjjlfTiCV82bJCsw";

async function list() {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    try {
        const res = await fetch(url);
        const data = await res.json();
        console.log(JSON.stringify(data, null, 2));
    } catch (e) {
        console.log(e.message);
    }
}
list();
