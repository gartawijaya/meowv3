const fs = require('fs');
const axios = require('axios');
const { DateTime } = require('luxon');
const colors = require('colors');
const readline = require('readline');

class CatsAPI {
    constructor() {
        this.baseURL = 'https://api.catshouse.club';
    }

    headers(authorization) {
        return {
            'accept': '*/*',
            'accept-language': 'en-US,en;q=0.5',
            'authorization': `tma ${authorization}`,
            'content-type': 'application/json',
            'origin': 'https://cats-frontend.tgapps.store',
            'referer': 'https://cats-frontend.tgapps.store/',
            'sec-ch-ua': '"Not)A;Brand";v="99", "Google Chrome";v="127", "Chromium";v="127"',
            'sec-ch-ua-mobile': '?1',
            'sec-ch-ua-platform': '"Android"',
            'user-agent': 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36'
        };
    }

    async getUserInfo(authorization) {
        const url = `${this.baseURL}/user`;
        const headers = this.headers(authorization);
        return axios.get(url, { headers });
    }

    async getTasks(authorization) {
        const url = `${this.baseURL}/tasks/user?group=cats`;
        const headers = this.headers(authorization);
        return axios.get(url, { headers });
    }

    async completeTask(authorization, taskId) {
        const url = `${this.baseURL}/tasks/${taskId}/complete`;
        const headers = this.headers(authorization);
        return axios.post(url, {}, { headers });
    }

    log(msg, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        switch(type) {
            case 'success':
                console.log(`[${timestamp}] [*] ${msg}`.green);
                break;
            case 'custom':
                console.log(`[${timestamp}] [*] ${msg}`);
                break;        
            case 'error':
                console.log(`[${timestamp}] [!] ${msg}`.red);
                break;
            case 'warning':
                console.log(`[${timestamp}] [*] ${msg}`.yellow);
                break;
            default:
                console.log(`[${timestamp}] [*] ${msg}`.blue);
        }
    }

    async waitWithCountdown(seconds) {
        for (let i = seconds; i >= 0; i--) {
            readline.cursorTo(process.stdout, 0);
            process.stdout.write(`===== All accounts completed, waiting ${i} seconds to continue the loop =====`);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        console.log('');
    }

    async completeTasks(authorization) {
        try {
            const tasksResponse = await this.getTasks(authorization);
            const incompleteTasks = tasksResponse.data.tasks.filter(task => !task.completed);
            
            for (const task of incompleteTasks) {
                try {
                    const timeoutPromise = new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('Task completion timed out')), 15000)
                    );
                    const completePromise = this.completeTask(authorization, task.id);
                    
                    const completeResponse = await Promise.race([completePromise, timeoutPromise]);
                    
                    if (completeResponse.data.success) {
                        this.log(`Successfully completed the task "${task.title}"`, 'success');
                    }
                } catch (error) {
                    if (error.message === 'Task completion timed out') {
                        this.log(`The task "${task.title}" timed out after 15 seconds`, 'warning');
                    } else {
                        this.log(`Error completing the task "${task.title}": ${error.message}`, 'error');
                    }
                }
            }
            this.log(`All tasks completed, some tasks may not have been successful!`, 'success');
        } catch (error) {
            this.log(`Error retrieving task list: ${error.message}`, 'error');
        }
    }

    async main() {
        const dataFile = 'data.txt';
        const data = fs.readFileSync(dataFile, 'utf8')
            .replace(/\r/g, '')
            .split('\n')
            .filter(Boolean);

        while (true) {
            for (let no = 0; no < data.length; no++) {
                const authorization = data[no];

                const userInfoResponse = await this.getUserInfo(authorization);
                const userInfo = userInfoResponse.data;
                console.log(`========== Account ${no + 1} | ${userInfo.firstName} ==========`.green);
                this.log(`Balance: ${userInfo.totalRewards}`);
                this.log(`Ref code: ${userInfo.referrerCode}`);

                await this.completeTasks(authorization);
            }

            await this.waitWithCountdown(15 * 60);
        }
    }
}

if (require.main === module) {
    const catsAPI = new CatsAPI();
    catsAPI.main().catch(err => {
        catsAPI.log(err.message, 'error');
        process.exit(1);
    });
}
