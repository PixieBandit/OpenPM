import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const PORT = 3001;

async function killPort(port: number) {
    try {
        const platform = process.platform;

        if (platform === 'win32') {
            const { stdout } = await execAsync(`netstat -ano | findstr :${port}`);
            if (!stdout) return;

            const lines = stdout.trim().split('\n');
            for (const line of lines) {
                const parts = line.trim().split(/\s+/);
                const pid = parts[parts.length - 1];
                if (pid && parseInt(pid) > 0) {
                    try {
                        await execAsync(`taskkill /F /PID ${pid}`);
                        console.log(`Killed process ${pid} on port ${port}`);
                    } catch (e) {
                        // Ignore if already dead
                    }
                }
            }
        } else {
            // Unix/Linux/Mac
            try {
                await execAsync(`lsof -i :${port} -t | xargs kill -9`);
                console.log(`Killed processes on port ${port}`);
            } catch (e) {
                // Ignore
            }
        }
    } catch (error) {
        // Port likely free
    }
}

killPort(PORT).then(() => {
    console.log(`Port ${PORT} is clear.`);
    process.exit(0);
});
