// run.js — Chạy Amazon scraper, nhận keyword từ env var hoặc JOBS array
// 
// Local (tất cả keyword): node run.js
// GitHub Actions (1 keyword): KEYWORD=アディダス node run.js

const path = require('path');
const fs = require('fs');
const AmazonScraper = require('./lib/Amazon');
const CONST = require('./lib/constant');

// ═══════════════════════════════════════════════════════
//  ✏️ CẤU HÌNH: Danh sách keyword mặc định (local run)
// ═══════════════════════════════════════════════════════
const JOBS = [
    { keyword: 'アディダス', country: 'JP', number: 40, filetype: 'json', category: 'aps' },
    { keyword: 'ナイキ', country: 'JP', number: 40, filetype: 'json', category: 'aps' },
    { keyword: 'プーマ', country: 'JP', number: 40, filetype: 'json', category: 'aps' },
    { keyword: 'ニューバランス', country: 'JP', number: 40, filetype: 'json', category: 'aps' },
    { keyword: 'アシックス', country: 'JP', number: 40, filetype: 'json', category: 'aps' },
    { keyword: 'レイバン', country: 'JP', number: 40, filetype: 'json', category: 'aps' },
];
// ─────────────────────────────────────────────────────

// ── Tuỳ chỉnh chung ──────────────────────────────────
const COMMON = {
    timeout: 2000,  // ms delay giữa mỗi HTTP request
    asyncTasks: 3,     // giảm xuống 3 để ít request đồng thời hơn (chống block)
    randomUa: true,
};
// ─────────────────────────────────────────────────────

// Khi chạy trên GitHub Actions, KEYWORD env var sẽ được set
// → chỉ chạy 1 job tương ứng
const envKeyword = process.env.KEYWORD;
const activeJobs = envKeyword
    ? JOBS.filter(j => j.keyword === envKeyword)
    : JOBS;

if (activeJobs.length === 0) {
    console.error(`❌ Không tìm thấy job cho keyword: "${envKeyword}"`);
    console.error(`   Kiểm tra lại JOBS array trong run.js`);
    process.exit(1);
}

// Đảm bảo thư mục content-output tồn tại
const OUTPUT_DIR = path.join(__dirname, 'content-output');
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// Tạo prefix timestamp: YYYYMMDD_HHMMSS (UTC)
function makeTimestamp() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}_${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`;
}

// Delay helper
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Chạy một job
async function runJob(job, index, total) {
    const { keyword, country, number, filetype, category } = job;
    const geo = CONST.geo[country] || CONST.geo['US'];

    console.log(`\n[${index + 1}/${total}] 🚀 Scraping: "${keyword}" | ${country} | Lấy tối đa ${number} sản phẩm`);

    const scraper = new AmazonScraper({
        keyword,
        number,
        sponsored: false,
        proxy: [],
        cli: true,
        filetype: filetype,
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

    // Override saveResultToFile → lưu vào content-output/
    scraper.saveResultToFile = async function () {
        if (!this.collector.length) {
            console.log(`    ⚠️  Không có sản phẩm nào sau filter — file không được tạo`);
            return;
        }
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
            console.log(`    ✅ CSV → ${dest}`);
        }
        if (filetype === 'json' || filetype === 'all') {
            const dest = path.join(OUTPUT_DIR, `${baseName}.json`);
            await fromCallback((cb) => writeFile(dest, JSON.stringify(this.collector, null, 2), cb));
            console.log(`    ✅ JSON → ${dest}`);
        }
    };

    const result = await scraper.startScraper();
    console.log(`    📦 Sau filter: ${result.result.length} sản phẩm`);
    return result;
}

// ── Main ─────────────────────────────────────────────
(async () => {
    console.log(`\n📋 Keyword cần scrape: ${activeJobs.length}`);
    console.log(`📁 Output: ${OUTPUT_DIR}\n`);

    let success = 0, failed = 0;

    for (let i = 0; i < activeJobs.length; i++) {
        try {
            await runJob(activeJobs[i], i, activeJobs.length);
            success++;
        } catch (err) {
            console.error(`\n❌ Lỗi "${activeJobs[i].keyword}": ${err.message || err}`);
            failed++;
        }

        // Delay 60s giữa các keyword khi chạy local (nhiều keyword)
        // Trên GitHub Actions không cần vì mỗi keyword = job riêng, IP khác nhau
        if (!envKeyword && i < activeJobs.length - 1) {
            console.log(`\n⏳ Chờ 60 giây trước keyword tiếp theo...`);
            await sleep(60_000);
        }
    }

    console.log(`\n${'═'.repeat(45)}`);
    console.log(`✅ Thành công: ${success} | ❌ Lỗi: ${failed}`);
    console.log(`📁 File lưu tại: ${OUTPUT_DIR}`);
    console.log(`${'═'.repeat(45)}\n`);

    if (failed > 0) process.exit(1);
})();
