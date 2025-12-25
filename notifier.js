const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { REPOS } = require('./config');

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const DATA_FILE = path.join(__dirname, 'last_releases.json');

async function getLatestRelease(repo) {
    try {
        const headers = {
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'GitHub-Release-Notifier'
        };

        if (GITHUB_TOKEN) {
            headers['Authorization'] = `token ${GITHUB_TOKEN}`;
        }

        const response = await axios.get(`https://api.github.com/repos/${repo}/releases/latest`, { headers });
        return response.data;
    } catch (error) {
        console.error(`Error fetching release for ${repo}:`, error.message);
        return null;
    }
}

async function sendTelegramMessage(text, photoUrl = null) {
    // Basic detection for image extensions
    const isPhoto = photoUrl && (photoUrl.match(/\.(jpe?g|png|gif|webp|heic)(\?|$)/i));
    const method = isPhoto ? 'sendPhoto' : 'sendMessage';
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${method}`;

    const payload = {
        chat_id: TELEGRAM_CHAT_ID,
        parse_mode: 'Markdown',
    };

    if (isPhoto) {
        payload.photo = photoUrl;
        // Telegram caption limit for photos is 1024 characters
        // If longer, we truncate and ensure the link is still visible
        if (text.length > 1024) {
            payload.caption = text.substring(0, 1000) + '...\n\n(Full notes in link below)';
        } else {
            payload.caption = text;
        }
    } else {
        payload.text = text;
        payload.disable_web_page_preview = false;
    }

    try {
        await axios.post(url, payload);
    } catch (error) {
        console.error(`Error sending Telegram ${method}:`, error.response?.data || error.message);
        // Fallback to plain text if photo fails or URL is inaccessible
        if (isPhoto) {
            await sendTelegramMessage(text);
        }
    }
}

function extractFirstImage(body) {
    if (!body) return null;

    // Check for Markdown images: ![Alt](https://...)
    // GitHub sometimes uses relative-ish or proxied URLs
    const mdMatch = body.match(/!\[.*?\]\((https?:\/\/.*?)\)/);
    if (mdMatch) return mdMatch[1];

    // Check for HTML images: <img src="https://..." ...>
    const htmlMatch = body.match(/<img\s+[^>]*?src=["'](https?:\/\/.*?)["']/i);
    if (htmlMatch) return htmlMatch[1];

    return null;
}

function formatReleaseBody(repo, body) {
    if (!body) return '';

    // Remove HTML comments
    let cleaned = body.replace(/<!--[\s\S]*?-->/g, '');

    // Conversion of Markdown headers to Telegram-friendly Bold
    cleaned = cleaned.replace(/^#+\s*(.*)$/gm, '*$1*');

    // Remove video and image syntax from text body to avoid raw links/clutter
    cleaned = cleaned.replace(/!\[.*?\]\(.*?\)/g, '');
    cleaned = cleaned.replace(/<img\s+[^>]*?>/gi, '');

    // Repo specific parsing
    if (repo === 'microsoft/playwright') {
        const highlights = cleaned.match(/\*Highlights\*(?:[\s\S]*?)(?=\n\*|$)/i);
        if (highlights) cleaned = highlights[0];
    }

    // Limit length for readability
    const lines = cleaned.split('\n');
    if (lines.length > 15) {
        cleaned = lines.slice(0, 15).join('\n').trim() + '\n\n... (more in full release notes)';
    } else if (cleaned.length > 800) {
        cleaned = cleaned.substring(0, 800).trim() + '\n\n... (more in full release notes)';
    }

    return cleaned.trim();
}

async function run() {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
        console.error('TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID must be set');
        process.exit(1);
    }

    let lastReleases = {};
    if (fs.existsSync(DATA_FILE)) {
        try {
            lastReleases = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        } catch (e) {
            console.error('Error parsing last_releases.json');
        }
    }

    let updated = false;

    for (const repo of REPOS) {
        console.log(`Checking ${repo}...`);
        const latest = await getLatestRelease(repo);

        if (latest && latest.tag_name !== lastReleases[repo]) {
            console.log(`New release found for ${repo}: ${latest.tag_name}`);

            const photoUrl = extractFirstImage(latest.body);
            const releaseBody = formatReleaseBody(repo, latest.body);

            const message = `🚀 *New Release: ${repo}*\n` +
                `Tag: \`${latest.tag_name}\`\n` +
                `${latest.name ? `Name: *${latest.name}*\n` : ''}\n` +
                (releaseBody ? `${releaseBody}\n\n` : '') +
                `🔗 [View Release](${latest.html_url})`;

            await sendTelegramMessage(message, photoUrl);
            lastReleases[repo] = latest.tag_name;
            updated = true;
        } else {
            console.log(`No new release for ${repo}.`);
        }
    }

    if (updated) {
        fs.writeFileSync(DATA_FILE, JSON.stringify(lastReleases, null, 2));
        console.log('last_releases.json updated.');
    }
}

run();
