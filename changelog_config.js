module.exports = {
    PRODUCTS: [
        {
            name: 'Antigravity',
            url: 'https://antigravity.google/changelog',
            method: 'js_bundle',
            extract: (html, bundleText) => {
                const versionMatch = bundleText.match(/version:"(.*?)"/);
                const dateMatch = bundleText.match(/date:"(.*?)"/);
                const titleMatch = bundleText.match(/title:"(.*?)"/);
                return {
                    title: titleMatch ? titleMatch[1] : 'New Update',
                    version: versionMatch ? versionMatch[1] : '',
                    date: dateMatch ? dateMatch[1].substring(0, 10) : '',
                    link: 'https://antigravity.google/changelog'
                };
            }
        },
        {
            name: 'GitHub Copilot',
            url: 'https://github.blog/changelog/label/copilot/',
            method: 'cheerio',
            extract: ($) => {
                const first = $('article').first();
                return {
                    title: first.find('.ChangelogItem-title').text().trim(),
                    date: first.find('time').text().trim(),
                    link: first.find('.ChangelogItem-title a').attr('href') || 'https://github.blog/changelog/label/copilot/'
                };
            }
        },
        {
            name: 'Cursor',
            url: 'https://cursor.com/changelog',
            method: 'cheerio',
            extract: ($) => {
                const first = $('a[href^="/changelog/"]').first();
                const titleText = (first.find('span').text().trim() || first.text().trim()).split('\n')[0];
                return {
                    title: titleText,
                    date: first.find('time').first().text().trim(),
                    link: 'https://cursor.com' + (first.attr('href') || '')
                };
            }
        },
        {
            name: 'Windsurf',
            url: 'https://windsurf.com/changelog',
            method: 'rsc',
            extract: (data) => {
                const versionMatch = data.match(/v(\d+\.\d+\.\d+)/);
                const titleMatch = data.match(/"title":"(.*?)"/);
                return {
                    title: titleMatch ? titleMatch[1] : 'New Version',
                    version: versionMatch ? versionMatch[1] : '',
                    date: '',
                    link: 'https://windsurf.com/changelog'
                };
            }
        },
        {
            name: 'Devin',
            url: 'https://docs.devin.ai/release-notes/overview',
            method: 'cheerio',
            extract: ($) => {
                const html = $.html();
                const dateMatch = html.match(/[A-Z][a-z]+ \d{1,2}, 202\d/);
                return {
                    title: 'New Release',
                    date: dateMatch ? dateMatch[0] : '',
                    link: 'https://docs.devin.ai/release-notes/overview'
                };
            }
        },
        {
            name: 'Trae',
            url: 'https://www.trae.ai/api/changelog',
            method: 'json',
            extract: (data) => {
                const jsonStr = JSON.stringify(data);
                const versionMatch = jsonStr.match(/v\d+\.\d+\.\d+/);
                const dateMatch = jsonStr.match(/202\d-\d\d-\d\d/);
                return {
                    title: versionMatch ? versionMatch[0] : 'New Update',
                    version: versionMatch ? versionMatch[0] : '',
                    date: dateMatch ? dateMatch[0] : '',
                    link: 'https://www.trae.ai/changelog'
                };
            }
        },
        {
            name: 'Gemini API',
            url: 'https://ai.google.dev/gemini-api/docs/changelog',
            method: 'cheerio',
            extract: ($) => {
                const firstDate = $('h2').first();
                const firstEntry = firstDate.nextAll('ul').first().find('li').first().text().trim();
                return {
                    title: firstEntry.substring(0, 100) + (firstEntry.length > 100 ? '...' : ''),
                    date: firstDate.text().trim(),
                    link: 'https://ai.google.dev/gemini-api/docs/changelog'
                };
            }
        }
    ]
};
