const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const { PRODUCTS } = require('./changelog_config');

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const DATA_FILE = path.join(__dirname, 'last_changelogs.json');

async function sendTelegramMessage(text) {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const payload = {
        chat_id: TELEGRAM_CHAT_ID,
        text: text,
        parse_mode: 'Markdown',
        disable_web_page_preview: false
    };

    try {
        await axios.post(url, payload);
    } catch (error) {
        console.error('Error sending Telegram message:', error.response?.data || error.message);
    }
}

async function run() {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
        console.error('TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID must be set');
        process.exit(1);
    }

    let lastChangelogs = {};
    if (fs.existsSync(DATA_FILE)) {
        try {
            lastChangelogs = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        } catch (e) {
            console.error('Error parsing last_changelogs.json');
        }
    }

    let updated = false;

    for (const product of PRODUCTS) {
        console.log(`Checking ${product.name}...`);
        try {
            let latest = null;

            if (product.method === 'json') {
                const response = await axios.get(product.url);
                latest = product.extract(response.data);
            } else if (product.method === 'rsc') {
                const response = await axios.get(product.url, {
                    headers: { 'RSC': '1' }
                });
                latest = product.extract(response.data);
            } else if (product.method === 'js_bundle') {
                const htmlResponse = await axios.get(product.url);
                const $ = cheerio.load(htmlResponse.data);
                // Find the main JS bundle (usually starts with /main- or contains main)
                const scriptTags = $('script[src*="main-"]').map((i, el) => $(el).attr('src')).get();
                if (scriptTags.length > 0) {
                    const bundleUrl = scriptTags[0].startsWith('http') ? scriptTags[0] : new URL(scriptTags[0], product.url).href;
                    const bundleResponse = await axios.get(bundleUrl);
                    latest = product.extract(htmlResponse.data, bundleResponse.data);
                }
            } else {
                // Default: cheerio
                const response = await axios.get(product.url, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                    }
                });
                const $ = cheerio.load(response.data);
                latest = product.extract($);
            }

            if (!latest || (!latest.title && !latest.version && !latest.date)) {
                console.warn(`Could not extract data for ${product.name}`);
                continue;
            }

            const currentKey = `${latest.title}|${latest.version || ''}|${latest.date || ''}`;

            if (currentKey !== lastChangelogs[product.name]) {
                console.log(`New update found for ${product.name}: ${latest.title}`);

                const message = `🔔 *New Changelog: ${product.name}*\n\n` +
                    `${latest.title ? `*${latest.title}*\n` : ''}` +
                    `${latest.version ? `Version: \`${latest.version}\`\n` : ''}` +
                    `${latest.date ? `Date: _${latest.date}_\n` : ''}\n` +
                    `🔗 [Read more](${latest.link})`;

                await sendTelegramMessage(message);
                lastChangelogs[product.name] = currentKey;
                updated = true;
            } else {
                console.log(`No new update for ${product.name}.`);
            }
        } catch (error) {
            console.error(`Error checking ${product.name}:`, error.message);
        }
    }

    if (updated) {
        fs.writeFileSync(DATA_FILE, JSON.stringify(lastChangelogs, null, 2));
        console.log('last_changelogs.json updated.');
    }
}

run();
