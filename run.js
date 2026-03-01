// run.js — Chạy Amazon scraper cho nhiều keyword, không qua cli.js
// Usage: node run.js
// Output: content-output/<YYYYMMDD_HHMMSS>_<keyword>_<country>.csv

const path = require('path');
const fs = require('fs');
const AmazonScraper = require('./lib/Amazon');
const CONST = require('./lib/constant');

// ═══════════════════════════════════════════════════════
//  ✏️ CẤU HÌNH: Thêm hoặc bỏ keyword tại đây (tối đa 5)
// ═══════════════════════════════════════════════════════
const JOBS = [
    { keyword: 'アディダス', country: 'JP', number: 40, filetype: 'csv', category: 'aps' },
    { keyword: 'ナイキ', country: 'JP', number: 40, filetype: 'csv', category: 'aps' },
    // { keyword: 'プーマ',   country: 'JP', number: 40, filetype: 'csv', category: 'aps' },
    // { keyword: 'Nike',    country: 'US', number: 40, filetype: 'csv', category: 'aps' },
    // { keyword: 'Adidas',  country: 'US', number: 40, filetype: 'csv', category: 'aps' },
];

// ── Tuỳ chỉnh chung ──────────────────────────────────
const COMMON = {
    timeout: 1000,   // ms delay giữa các request
    asyncTasks: 5,     // số request song song
    randomUa: true,
};
// ─────────────────────────────────────────────────────

// Đảm bảo thư mục content-output tồn tại
const OUTPUT_DIR = path.join(__dirname, 'content-output');
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// Tạo prefix timestamp: YYYYMMDD_HHMMSS
function makeTimestamp() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}_${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`;
}

// Chạy một job (một keyword)
async function runJob(job, index, total) {
    const { keyword, country, number, filetype, category } = job;
    const geo = CONST.geo[country] || CONST.geo['US'];

    console.log(`\n[${index + 1}/${total}] 🚀 Scraping: "${keyword}" | Country: ${country}`);
    console.log(`    📂 Project: ${__dirname}`);

    // Tạo instance riêng cho mỗi keyword
    const scraper = new AmazonScraper({
        keyword,
        number,
        sponsored: false,
        proxy: [],
        cli: true,
        filetype: 'json',     // lưu tạm vào JSON để ta kiểm soát đường dẫn output
        scrapeType: 'products',
        asin: '',
        sort: false,
        discount: false,
        rating: [1, 5],
        ua: '',
        timeout: COMMON.timeout,
        randomUa: COMMON.randomUa,
        page: 1,
        bulk: true,
        category: category || 'aps',
        cookie: '',
        geo,
        asyncTasks: COMMON.asyncTasks,
        reviewFilter: {
            formatType: 'all_formats',
            sortBy: 'recent',
            verifiedPurchaseOnly: false,
            filterByStar: '',
        },
        referer: [],
    });

    // Override saveResultToFile để lưu vào content-output/
    scraper.saveResultToFile = async function () {
        if (!this.collector.length) return;

        const ts = makeTimestamp();
        const slug = keyword.replace(/[^\w\u3040-\u9FFF]/g, '_');
        const baseName = `${ts}_${slug}_${country}`;

        const { Parser } = require('json2csv');
        const { writeFile } = require('fs');
        const { fromCallback } = require('bluebird');
        const jsonToCsv = new Parser({ flatten: true });

        if (filetype === 'csv' || filetype === 'all') {
            const dest = path.join(OUTPUT_DIR, `${baseName}.csv`);
            await fromCallback((cb) => writeFile(dest, jsonToCsv.parse(this.collector), cb));
            console.log(`    ✅ CSV saved: ${dest}`);
        }
        if (filetype === 'json' || filetype === 'all') {
            const dest = path.join(OUTPUT_DIR, `${baseName}.json`);
            await fromCallback((cb) => writeFile(dest, JSON.stringify(this.collector, null, 2), cb));
            console.log(`    ✅ JSON saved: ${dest}`);
        }
    };

    const result = await scraper.startScraper();
    console.log(`    📦 Kết quả sau filter: ${result.result.length} sản phẩm`);
    return result;
}

// ── Chạy tuần tự từng keyword ────────────────────────
(async () => {
    if (JOBS.length === 0) {
        console.error('❌ Không có job nào được cấu hình trong JOBS!');
        process.exit(1);
    }
    if (JOBS.length > 5) {
        console.warn('⚠️  Khuyến nghị tối đa 5 keyword để tránh bị Amazon chặn.');
    }

    console.log(`\n📋 Tổng số keyword: ${JOBS.length}`);
    console.log(`📁 Output folder : ${OUTPUT_DIR}\n`);

    let success = 0, failed = 0;

    for (let i = 0; i < JOBS.length; i++) {
        try {
            await runJob(JOBS[i], i, JOBS.length);
            success++;
        } catch (err) {
            console.error(`\n❌ Lỗi job "${JOBS[i].keyword}": ${err.message || err}`);
            failed++;
        }
    }

    console.log(`\n══════════════════════════════════════`);
    console.log(`✅ Thành công: ${success} | ❌ Lỗi: ${failed}`);
    console.log(`📁 File lưu tại: ${OUTPUT_DIR}`);
    console.log(`══════════════════════════════════════\n`);

    if (failed > 0) process.exit(1);
})();
