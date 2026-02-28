# 📦 Amazon Buddy — Tài Liệu Tiếng Việt

> **Phiên bản:** 2.2.41  
> **Tác giả gốc:** drawrowfly  
> **Giấy phép:** MIT  
> **Repository gốc:** https://github.com/drawrowfly/amazon-scraper

---

## 📑 Mục Lục

1. [Tổng quan dự án](#1-tổng-quan-dự-án)
2. [Cấu trúc thư mục](#2-cấu-trúc-thư-mục)
3. [Kiến trúc & Luồng hoạt động](#3-kiến-trúc--luồng-hoạt-động)
4. [Cài đặt & Cấu hình](#4-cài-đặt--cấu-hình)
5. [Sử dụng qua CLI](#5-sử-dụng-qua-cli)
6. [Sử dụng như thư viện Node.js](#6-sử-dụng-như-thư-viện-nodejs)
7. [API Reference chi tiết](#7-api-reference-chi-tiết)
8. [Cấu trúc dữ liệu đầu ra](#8-cấu-trúc-dữ-liệu-đầu-ra)
9. [Hỗ trợ đa quốc gia](#9-hỗ-trợ-đa-quốc-gia)
10. [Các hằng số & Cấu hình nội bộ](#10-các-hằng-số--cấu-hình-nội-bộ)
11. [Lưu ý kỹ thuật & Điểm đặc biệt](#11-lưu-ý-kỹ-thuật--điểm-đặc-biệt)
12. [Các thay đổi trong bản kaizen](#12-các-thay-đổi-trong-bản-kaizen)

---

## 1. Tổng quan dự án

**Amazon Buddy** là một thư viện/công cụ CLI Node.js dùng để **scrape (thu thập)** dữ liệu từ trang Amazon mà không cần API key chính thức. Dự án này là phiên bản **kaizen** (cải tiến) được tùy chỉnh từ package gốc `amazon-buddy`.

### Chức năng chính

| Chức năng | Mô tả |
|-----------|-------|
| **Tìm kiếm sản phẩm** | Thu thập danh sách sản phẩm theo từ khóa |
| **Lấy đánh giá** | Thu thập review từ một sản phẩm cụ thể theo ASIN |
| **Chi tiết ASIN** | Lấy toàn bộ thông tin chi tiết của một sản phẩm |
| **Danh mục** | Lấy danh sách các danh mục của Amazon |
| **Quốc gia** | Liệt kê các quốc gia Amazon được hỗ trợ |

### Công nghệ sử dụng

| Thư viện | Mục đích |
|----------|---------|
| `request-promise` | Gửi HTTP request đến Amazon |
| `cheerio` | Parse HTML (tương tự jQuery cho server) |
| `async` | Xử lý bất đồng bộ song song (forEachLimit) |
| `bluebird` | Promise utils (fromCallback) |
| `json2csv` | Chuyển JSON sang định dạng CSV |
| `moment` | Xử lý và tính toán ngày tháng |
| `socks-proxy-agent` | Hỗ trợ proxy SOCKS4/SOCKS5 |
| `ora` | Hiển thị spinner loading trong terminal |
| `yargs` | Xây dựng giao diện CLI |

---

## 2. Cấu trúc thư mục

```
amazon-buddy-kaizen/
│
├── bin/
│   └── cli.js              ← Điểm vào CLI (command-line interface)
│
├── lib/
│   ├── index.js            ← API xuất ra cho người dùng thư viện
│   ├── Amazon.js           ← Lõi scraper – class AmazonScraper (1651 dòng)
│   ├── Amazonx.js          ← Bản dự phòng/thay thế của Amazon.js
│   └── constant.js         ← Hằng số: geo, giới hạn, bộ lọc review (1112 dòng)
│
├── package.json            ← Cấu hình package npm
├── package-lock.json       ← Lock file phiên bản dependency
└── README.md               ← Tài liệu gốc tiếng Anh
```

### Mô tả từng file

#### `bin/cli.js`
- File thực thi được gọi khi dùng lệnh `amazon-buddy` từ terminal.
- Sử dụng thư viện `yargs` để định nghĩa các lệnh con và tham số.
- Gọi hàm `startScraper(argv)` để khởi động việc thu thập dữ liệu.
- **Validate đầu vào** trước khi gọi scraper: kiểm tra keyword, ASIN, rating range, v.v.

#### `lib/index.js`
- File **entry point** khi dùng như thư viện Node.js (`require('amazon-buddy')`).
- Export 5 hàm: `products`, `reviews`, `asin`, `categories`, `countries`.
- Mỗi hàm merge option người dùng với `INIT_OPTIONS` mặc định rồi tạo instance `AmazonScraper`.

#### `lib/Amazon.js`
- **Trái tim** của toàn bộ dự án.
- Chứa class `AmazonScraper` với toàn bộ logic scraping.
- Xử lý HTTP request, parse HTML, extract dữ liệu, sắp xếp & lọc kết quả.

#### `lib/constant.js`
- Cấu hình địa lý (`geo`) cho từng quốc gia Amazon hỗ trợ.
- Định nghĩa giới hạn số lượng item có thể scrape.
- Các bộ lọc review (sắp xếp, lọc theo sao, format).

---

## 3. Kiến trúc & Luồng hoạt động

```
Người dùng (CLI hoặc require())
         │
         ▼
  lib/index.js  ──── merge với INIT_OPTIONS
         │
         ▼
  new AmazonScraper(options)
         │
         ▼
  startScraper()
    ├── Kiểm tra đầu vào (số lượng, ASIN, rating)
    ├── Hiển thị spinner (nếu CLI)
    ├── mainLoop()  ────────────────────────────┐
    │   └── forEachLimit (asyncTasks song song)  │
    │       └── buildRequest(page)               │
    │           └── httpRequest()                │
    │               └── GET Amazon              │
    │           └── grabProduct/grabReviews/    │
    │               grabAsinDetails             │
    │        ◄──────────────────────────────────┘
    ├── sortAndFilterResult()
    └── return { result, totalProducts, v.v. }
```

### Xử lý song song
- Dùng `forEachLimit` từ thư viện `async` để kiểm soát số lượng request song song.
- Mặc định: **5 tác vụ song song** (`asyncTasks = 5`).
- Mỗi trang Amazon chứa khoảng 15 sản phẩm hoặc 10 review.

---

## 4. Cài đặt & Cấu hình

### Cài đặt

```bash
# Cài đặt toàn cục (dùng CLI)
npm install -g amazon-buddy

# Hoặc cài đặt trong dự án (dùng như thư viện)
npm install amazon-buddy
```

### Dependencies

```json
{
  "async": "^3.2.0",
  "bluebird": "^3.7.2",
  "cheerio": "^1.0.0-rc.3",
  "json2csv": "^4.5.3",
  "moment": "^2.27.0",
  "ora": "^4.0.2",
  "request": "^2.88.0",
  "request-promise": "^0.0.1",
  "socks-proxy-agent": "^5.0.0",
  "tough-cookie": "^5.0.0",
  "yargs": "^14.2.0"
}
```

---

## 5. Sử dụng qua CLI

### Cú pháp chung

```bash
amazon-buddy <lệnh> [tùy chọn]
```

### Các lệnh

#### Tìm kiếm sản phẩm (`products`)
```bash
# Tìm theo từ khóa
amazon-buddy products -k "Xbox one"

# Tìm ở UK, lấy 50 sản phẩm, lưu CSV
amazon-buddy products -k "Xbox one" --country GB -n 50

# Chỉ lấy sản phẩm có giảm giá, sắp xếp theo điểm
amazon-buddy products -k "laptop" -d --sort

# Chỉ lấy sản phẩm được tài trợ
amazon-buddy products -k "headphones" --sponsored

# Lọc theo rating
amazon-buddy products -k "mouse" --min-rating 4 --max-rating 5
```

#### Lấy đánh giá (`reviews`)
```bash
# Lấy review của sản phẩm theo ASIN
amazon-buddy reviews B01GW3H3U8

# Lấy 100 review, sắp xếp theo rating
amazon-buddy reviews B01GW3H3U8 -n 100 --sort

# Lưu ra file JSON
amazon-buddy reviews B01GW3H3U8 --filetype json
```

#### Chi tiết sản phẩm (`asin`)
```bash
# Lấy toàn bộ thông tin chi tiết
amazon-buddy asin B01GW3H3U8

# Lấy từ Amazon Nhật Bản
amazon-buddy asin B01GW3H3U8 --country JP
```

#### Danh mục (`categories`)
```bash
amazon-buddy categories
```

#### Quốc gia (`countries`)
```bash
amazon-buddy countries
```

### Bảng tùy chọn đầy đủ

| Tùy chọn | Viết tắt | Mặc định | Mô tả |
|----------|----------|---------|-------|
| `--keyword` | `-k` | `''` | Từ khóa tìm kiếm |
| `--number` | `-n` | `20` | Số lượng item cần lấy (tối đa 1000 sản phẩm / 2000 review) |
| `--filetype` | | `csv` | Định dạng lưu file: `csv`, `json`, `all`, hoặc `''` (không lưu) |
| `--sort` | | `false` | Sắp xếp theo điểm (sản phẩm) hoặc rating (review) |
| `--discount` | `-d` | `false` | Chỉ lấy sản phẩm đang được giảm giá |
| `--sponsored` | | `false` | Chỉ lấy sản phẩm được tài trợ |
| `--min-rating` | | `1` | Rating tối thiểu |
| `--max-rating` | | `5` | Rating tối đa |
| `--country` | | `US` | Mã quốc gia theo ISO 3166 (ví dụ: `JP`, `GB`, `DE`) |
| `--category` | | `aps` | Danh mục tìm kiếm (lấy danh sách bằng lệnh `categories`) |
| `--random-ua` | | `false` | Ngẫu nhiên hóa User-Agent để tránh bị chặn |
| `--user-agent` | | `''` | Đặt User-Agent tùy chỉnh |
| `--timeout` | `-t` | `0` | Độ trễ giữa các request (milliseconds) |
| `--async` | `-a` | `5` | Số tác vụ song song |

---

## 6. Sử dụng như thư viện Node.js

### Import

```javascript
const AmazonScraper = require('./lib'); 
// hoặc từ npm:
// const AmazonScraper = require('amazon-buddy');
```

### options mặc định (INIT_OPTIONS)

```javascript
const INIT_OPTIONS = {
    bulk: true,           // Bật chế độ lấy nhiều trang song song
    number: 15,           // Số lượng item mặc định
    filetype: '',         // Không lưu file theo mặc định
    rating: [1, 5],       // Khoảng rating
    page: 1,              // Trang bắt đầu
    category: 'aps',      // Tất cả danh mục
    cookie: '',           // Cookie tùy chỉnh
    asyncTasks: 5,        // Số tác vụ song song
    sponsored: false,     // Không lọc sponsored
    cli: false,           // Không hiển thị spinner
    sort: false,          // Không sắp xếp
    discount: false,      // Không lọc giảm giá
    reviewFilter: {
        sortBy: 'recent',           // Sắp xếp review theo recent/helpful
        verifiedPurchaseOnly: false, // Không giới hạn verified
        filterByStar: '',           // Không lọc theo sao
        formatType: 'all_formats',  // Tất cả định dạng
    },
};
```

### Ví dụ sử dụng

```javascript
const AmazonScraper = require('./lib');

// 1. Tìm kiếm sản phẩm
async function timSanPham() {
    const result = await AmazonScraper.products({
        keyword: 'iPhone 15',
        number: 50,
        country: 'US',
        sort: true,
        discount: false,
        rating: [4, 5],
    });
    console.log(`Tổng: ${result.totalProducts} sản phẩm`);
    console.log(result.result);
}

// 2. Lấy review
async function layReview() {
    const result = await AmazonScraper.reviews({
        asin: 'B0CHX1W1XY',
        number: 100,
        country: 'US',
        reviewFilter: {
            sortBy: 'helpful',            // Sắp xếp theo hữu ích nhất
            verifiedPurchaseOnly: true,   // Chỉ lấy mua thật
            filterByStar: '5',            // Chỉ lấy 5 sao
            formatType: 'all_formats',
        },
    });
    console.log(`Tổng số review: ${result.total_reviews}`);
    console.log(`Thống kê sao:`, result.stars_stat);
    console.log(result.result);
}

// 3. Lấy chi tiết sản phẩm theo ASIN
async function chiTietSanPham() {
    const result = await AmazonScraper.asin({
        asin: 'B0CHX1W1XY',
        country: 'JP',  // amazon.co.jp
    });
    const sp = result.result[0];
    console.log('Tên:', sp.title);
    console.log('Giá:', sp.price.current_price, sp.price.currency);
    console.log('Rating:', sp.reviews.rating, '/', sp.reviews.total_reviews, 'đánh giá');
}

// 4. Lấy danh mục
async function danhMuc() {
    const categories = await AmazonScraper.categories({ country: 'US' });
    console.table(categories);
}

// 5. Lấy danh sách quốc gia
async function quocGia() {
    const countries = await AmazonScraper.countries();
    console.table(countries);
}
```

---

## 7. API Reference chi tiết

### Class `AmazonScraper` (lib/Amazon.js)

#### Constructor

```javascript
new AmazonScraper({
    keyword,       // Từ khóa tìm kiếm (string)
    number,        // Số lượng cần lấy (number)
    sponsored,     // Chỉ lấy sponsored (boolean)
    proxy,         // Proxy hoặc mảng proxy (string | string[])
    cli,           // Chế độ CLI (boolean)
    filetype,      // Định dạng file output ('csv'|'json'|'all'|'')
    scrapeType,    // Loại scrape ('products'|'reviews'|'asin')
    asin,          // ASIN sản phẩm (string)
    sort,          // Sắp xếp kết quả (boolean)
    discount,      // Chỉ lấy đang giảm giá (boolean)
    rating,        // [min, max] rating (number[])
    ua,            // User-Agent tùy chỉnh (string)
    timeout,       // Độ trễ giữa request ms (number)
    randomUa,      // Ngẫu nhiên UA (boolean)
    page,          // Trang bắt đầu (number)
    bulk,          // Lấy nhiều trang (boolean)
    category,      // Danh mục ('aps'|...) (string)
    cookie,        // Cookie (string)
    geo,           // Cấu hình địa lý (object từ constant.js)
    asyncTasks,    // Số tác vụ song song (number)
    reviewFilter,  // Bộ lọc review (object)
    referer,       // Referer header (string | string[])
})
```

#### Các method chính

| Method | Mô tả |
|--------|-------|
| `startScraper()` | Khởi động toàn bộ quá trình scraping |
| `mainLoop()` | Vòng lặp chính xử lý song song nhiều trang |
| `buildRequest(page)` | Tạo URL request phù hợp cho từng loại scrape |
| `httpRequest({uri, method, qs, json, body, form})` | Gửi HTTP GET đến Amazon |
| `grabProduct(body, page)` | Parse HTML và trích xuất danh sách sản phẩm |
| `grabReviews(body)` | Parse HTML và trích xuất danh sách review |
| `grabAsinDetails(body)` | Parse HTML và trích xuất chi tiết sản phẩm |
| `sortAndFilterResult()` | Sắp xếp và lọc kết quả cuối cùng |
| `validateRating(item)` | Kiểm tra rating của item có nằm trong khoảng cho phép |
| `saveResultToFile()` | Lưu kết quả ra file CSV/JSON |
| `extractCategories()` | Lấy danh sách danh mục từ dropdown Amazon |

#### Các method phụ trợ (helper extractors)

| Method | Mô tả |
|--------|-------|
| `extractProductFeatures($)` | Trích xuất danh sách tính năng sản phẩm (`feature-bullets`) |
| `extractProductInfromation($)` | Trích xuất thông tin kỹ thuật và xếp hạng bestseller |
| `extractProductVariants($, body)` | Trích xuất các biến thể (màu sắc, kích thước) |
| `extractAlsoBought($)` | Trích xuất sản phẩm "Khách hàng cũng mua" |
| `extractSponsoredProducts($)` | Trích xuất sản phẩm được tài trợ trên trang chi tiết |
| `extractProductCategories($)` | Trích xuất breadcrumb danh mục |
| `extractAuthors($)` | Trích xuất tác giả (dành cho sách) |
| `extractOtherSellers($)` | Trích xuất các người bán khác trên Amazon |
| `extractImages($, body)` | Trích xuất tất cả hình ảnh sản phẩm |
| `extractBookInSeries($)` | Trích xuất thông tin bộ sách (nếu là sách trong series) |

#### Các getter

| Getter | Mô tả |
|--------|-------|
| `userAgent` | Trả về User-Agent (ngẫu nhiên nếu `randomUa = true`) |
| `getReferer` | Trả về referer ngẫu nhiên từ danh sách |
| `getProxy` | Trả về proxy (hỗ trợ SOCKS4/5) |
| `fileName` | Tạo tên file output dựa trên loại scrape + timestamp |
| `setRequestEndpoint` | Trả về đường dẫn URL phù hợp cho từng loại scrape |

---

## 8. Cấu trúc dữ liệu đầu ra

### 8.1. Kết quả tìm kiếm sản phẩm (`products`)

```javascript
{
    totalProducts: 1234,        // Tổng số sản phẩm Amazon tìm thấy
    category: "aps",            // Danh mục đã tìm kiếm
    result: [
        {
            position: {
                page: 1,                    // Trang kết quả
                position: 3,               // Vị trí trên trang
                global_position: 3,        // Vị trí toàn cục (sau sắp xếp)
            },
            asin: "B0CLJ65BJW",            // Mã sản phẩm Amazon
            title: "iPhone 15 Pro Max",    // Tên sản phẩm
            thumbnail: "https://...",       // URL ảnh thumbnail
            url: "https://amazon.com/dp/B0CLJ65BJW",  // Link sản phẩm
            price: {
                discounted: true,          // Đang giảm giá
                current_price: 999.99,     // Giá hiện tại
                currency: "USD",           // Đơn vị tiền tệ
                before_price: 1099.99,     // Giá gốc
                savings_amount: 100.00,    // Số tiền tiết kiệm
                savings_percent: 9.09,     // Phần trăm giảm
            },
            reviews: {
                total_reviews: 15234,      // Tổng số đánh giá
                rating: 4.5,               // Điểm trung bình
            },
            score: 68553.00,               // Điểm = rating × total_reviews
            sponsored: false,              // Có phải quảng cáo
            amazonChoice: false,           // Nhãn "Amazon's Choice"
            bestSeller: false,             // Nhãn "Best Seller"
            amazonPrime: true,             // Có Prime
        },
        // ... các sản phẩm khác
    ]
}
```

### 8.2. Kết quả lấy đánh giá (`reviews`)

```javascript
{
    total_reviews: 15234,       // Tổng số review
    stars_stat: {               // Thống kê phân bố sao
        5: "72%",
        4: "15%",
        3: "7%",
        2: "3%",
        1: "3%",
    },
    result: [
        {
            id: "R2EXAMPLE123",         // ID review
            asin: {
                original: "B0CLJ65BJW", // ASIN gốc
                variant: "",            // ASIN biến thể (nếu có)
            },
            review_data: "Reviewed in the United States on January 1, 2024",
            date: {
                date: "January 1, 2024",  // Ngày đánh giá
                unix: 1704067200,          // Timestamp unix
            },
            name: "Nguyễn Văn A",         // Tên người đánh giá
            rating: 5,                    // Số sao (1-5)
            title: "Sản phẩm tuyệt vời!",// Tiêu đề review
            review: "Nội dung đánh giá chi tiết...", // Nội dung đầy đủ
            verified_purchase: true,      // Đã mua thực
            media: [                      // Hình ảnh đính kèm
                "https://images-eu.ssl-images-amazon.com/images/I/..._SL1600_.jpg",
            ],
        },
    ]
}
```

### 8.3. Kết quả chi tiết sản phẩm (`asin`)

```javascript
{
    result: [
        {
            // --- Thông tin cơ bản ---
            asin: "B0CLJ65BJW",
            title: "Apple iPhone 15 Pro Max",
            url: "https://www.amazon.com/dp/B0CLJ65BJW",
            description: "Mô tả sản phẩm đầy đủ...",
            feature_bullets: [      // Danh sách tính năng dạng bullet
                "Chip A17 Pro thế hệ mới nhất",
                "Camera 48MP chuyên nghiệp",
                // ...
            ],
            item_available: true,   // Còn hàng hay không

            // --- Giá cả ---
            price: {
                symbol: "$",
                currency: "USD",
                current_price: 1199.00,
                discounted: true,
                before_price: 1299.00,
                savings_amount: 100.00,
                savings_percent: 7.70,
            },

            // --- Đánh giá ---
            reviews: {
                total_reviews: 15234,
                rating: 4.6,
                answered_questions: 342,
            },

            // --- Hình ảnh ---
            main_image: "https://images-na.ssl-images-amazon.com/...",
            images: ["url1", "url2", "url3"],
            total_images: 8,

            // --- Video ---
            videos: [],
            total_videos: 0,

            // --- Danh mục ---
            categories: [
                { category: "Electronics", url: "https://..." },
                { category: "Cell Phones & Accessories", url: "https://..." },
            ],

            // --- Xếp hạng bestseller ---
            bestsellers_rank: [
                { rank: 1, category: "Unlocked Cell Phones", link: "https://..." },
            ],

            // --- Thông tin sản phẩm ---
            product_information: {
                dimensions: "6.29 x 3.02 x 0.33 inches",
                weight: "7.81 ounces",
                available_from: "September 22, 2023",
                available_from_utc: "2023-09-22T02:00:00.000Z",
                available_for_months: 17,   // Số tháng có mặt trên Amazon
                available_for_days: 524,    // Số ngày có mặt trên Amazon
                manufacturer: "Apple",
                model_number: "MQDY3LL/A",
                department: "Wireless",
                store_id: "wireless",
                brand: "Apple",
                sold_by: "Amazon.com",
                fulfilled_by: "Amazon.com",
                qty_per_order: 1,
            },

            // --- Huy hiệu ---
            badges: {
                amazon_choice: false,   // Nhãn "Amazon's Choice"
                amazon_prime: true,     // Có Prime
                best_seller: false,     // Nhãn "Best Seller"
            },

            // --- Giao hàng ---
            delivery_message: "FREE delivery Monday, February 26",

            // --- Biến thể ---
            variants: [
                {
                    asin: "B0CLJ65BWA",
                    images: ["https://..."],
                    title: "Black Titanium",
                    link: "https://www.amazon.com/dp/B0CLJ65BWA/?th=1&psc=1",
                    is_current_product: false,
                    price: "1199.00",
                },
            ],

            // --- Sản phẩm liên quan ---
            sponsored_products: [],     // Sản phẩm được tài trợ
            also_bought: [],            // Khách hàng cũng mua

            // --- Người bán khác ---
            other_sellers: [
                {
                    position: 1,
                    seller: "TechStore USA",
                    url: "https://...",
                    price: {
                        symbol: "$",
                        currency: "USD",
                        current_price: 1150.00,
                    },
                },
            ],

            // --- Đặc biệt cho sách ---
            authors: [                  // (chỉ có nếu là sách)
                { author: "Tên Tác Giả", role: "Author", url: "https://..." }
            ],
            book_in_series: [],         // (chỉ có nếu là sách trong bộ)
        }
    ]
}
```

---

## 9. Hỗ trợ đa quốc gia

Dự án hỗ trợ **15 quốc gia** Amazon. Mỗi quốc gia có cấu hình riêng trong `constant.js`:

| Mã | Quốc gia | Tiền tệ | Host |
|----|---------|---------|------|
| `US` | Mỹ | USD ($) | www.amazon.com |
| `AU` | Australia | AUD ($) | www.amazon.com.au |
| `BR` | Brazil | BRL (R$) | www.amazon.com.br |
| `CA` | Canada | CAD ($) | www.amazon.ca |
| `CN` | Trung Quốc | CNY (¥) | www.amazon.cn |
| `FR` | Pháp | EUR (€) | www.amazon.fr |
| `DE` | Đức | EUR (€) | www.amazon.de |
| `IN` | Ấn Độ | INR (₹) | www.amazon.in |
| `IT` | Ý | EUR (€) | www.amazon.it |
| `JP` | Nhật Bản | JPY (¥) | www.amazon.co.jp |
| `MX` | Mexico | MXN (M$) | www.amazon.com.mx |
| `NL` | Hà Lan | EUR (€) | www.amazon.nl |
| `SG` | Singapore | SGD ($) | www.amazon.sg |
| `ES` | Tây Ban Nha | EUR (€) | www.amazon.es |
| `TR` | Thổ Nhĩ Kỳ | TRY (₺) | www.amazon.com.tr |
| `GB` / `UK` | Vương quốc Anh | GBP (£) | www.amazon.co.uk |

Mỗi cấu hình quốc gia chứa:
- `country`: Tên quốc gia đầy đủ
- `currency`: Mã tiền tệ ISO
- `symbol`: Ký hiệu tiền tệ
- `host`: Domain Amazon của quốc gia đó
- `best_seller(text)`: Hàm parse xếp hạng bestseller
- `review_date(date)`: Hàm parse và chuyển đổi ngày tháng review
- `price_format(price)`: Hàm format giá cả (xử lý dấu phân cách khác nhau)
- `product_information`: Cấu hình CSS selector và tên trường theo từng ngôn ngữ

---

## 10. Các hằng số & Cấu hình nội bộ

### Giới hạn scraping

```javascript
// constant.js
limit: {
    product: 1000,   // Tối đa 1000 sản phẩm
    reviews: 2000,   // Tối đa 2000 review
}
defaultItemLimit: 15  // Số lượng mặc định
```

### Bộ lọc review (`reviewFilter`)

```javascript
reviewFilter: {
    sortBy: {
        recent: 'recent',      // Mới nhất
        helpful: 'helpful',    // Hữu ích nhất
    },
    filterByStar: {
        positive: 'positive',  // Tích cực (> 3 sao)
        critical: 'critical',  // Tiêu cực (< 3 sao)
        1: 'one_star',         // Chỉ 1 sao
        2: 'two_star',         // Chỉ 2 sao
        3: 'three_star',       // Chỉ 3 sao
        4: 'four_star',        // Chỉ 4 sao
        5: 'five_star',        // Chỉ 5 sao
    },
    formatType: {
        all_formats: 'all_formats',          // Tất cả format
        current_format: 'current_format',   // Format hiện tại
    },
}
```

### User-Agent ngẫu nhiên

Khi bật `--random-ua`, scraper sẽ ngẫu nhiên kết hợp:
- **OS:** Một trong 16 chuỗi OS (Macintosh, Windows NT 10.0, ...)
- **Chrome version:** 100–103
- **Build number:** 4100–4290 . (140–190)

### Headers giả mạo trình duyệt

Mỗi request gửi kèm một số header ngẫu nhiên để mô phỏng trình duyệt thật:
- `downlink` (ngẫu nhiên 10-40)
- `rtt` (ngẫu nhiên 50-150ms)
- `pragma: no-cache` (50% xác suất)
- `ect: 4g` (50% xác suất)
- `DNT: 1` (50% xác suất)
- `device-memory` (ngẫu nhiên 8-24 GB)
- `viewport-width` (ngẫu nhiên 1200-3300)
- `Referer` với nav_logo ngẫu nhiên

---

## 11. Lưu ý kỹ thuật & Điểm đặc biệt

### ⚠️ Các vấn đề cần biết

1. **Amazon có thể chặn:** Scraping Amazon không được khuyến nghị chính thức. Amazon có thể chặn IP nếu gửi quá nhiều request. Sử dụng `--timeout`, `--random-ua`, và proxy để giảm nguy cơ bị chặn.

2. **Cấu trúc HTML thay đổi:** Amazon thường xuyên thay đổi cấu trúc HTML trang web, có thể làm scraper ngừng hoạt động đúng. Cần cập nhật CSS selector trong mã nguồn khi gặp sự cố.

3. **Proxy hỗ trợ:**
   - HTTP proxy: `http://host:port` hoặc `host:port`
   - SOCKS4 proxy: `socks4://host:port`
   - SOCKS5 proxy: `socks5://host:port`
   - Có thể truyền một mảng proxy để xoay vòng ngẫu nhiên.

4. **Sản phẩm tối đa 15/trang:** Amazon hiển thị khoảng 15 sản phẩm mỗi trang tìm kiếm và 10 review mỗi trang. Scraper tự tính số trang cần crawl.

5. **Score (điểm):** Được tính bằng công thức `rating × total_reviews`. Dùng để sắp xếp sản phẩm theo mức độ phổ biến.

### 🔧 Điều chỉnh hiệu năng

```javascript
// Giảm tốc độ để tránh bị chặn
await AmazonScraper.products({
    keyword: 'laptop gaming',
    number: 100,
    timeout: 1000,     // Đợi 1 giây giữa các request
    asyncTasks: 2,     // Chỉ 2 tác vụ song song (thay vì 5)
    randomUa: true,    // Ngẫu nhiên UA
    proxy: [           // Xoay vòng proxy
        'socks5://proxy1:1080',
        'socks5://proxy2:1080',
    ],
});
```

### 📁 Tên file output

File được đặt tên theo pattern:
- Sản phẩm: `products(Xbox+one)_1612345678901.csv`
- Review: `reviews(B01GW3H3U8)_1612345678901.json`
- ASIN: `asin(B01GW3H3U8)_1612345678901.csv`

Trong đó `1612345678901` là timestamp Unix khi khởi tạo scraper.

---

## 12. Các thay đổi trong bản kaizen

Bản `amazon-buddy-kaizen` này có một số thay đổi so với bản gốc npm:

### Thay đổi đã quan sát trong mã nguồn

| File | Thay đổi | Dòng |
|------|---------|------|
| `Amazon.js` | **Tắt lưu file tự động** — dòng `saveResultToFile()` đã bị comment out | ~242 |
| `Amazon.js` | **Thêm log debug** — `console.log('xxxxxxxxxxxxxxx')` và `console.log('Product Name: ${...}')` | ~241, 1336 |
| `Amazon.js` | **Thêm log debug** — `console.log('Step create file')` trong saveResultToFile | ~318 |
| `lib/index.js` | Sử dụng `./Amazon` thay vì `./Amazonx` (file dự phòng) | 1 |

### Lý do có file `Amazonx.js`
File `Amazonx.js` (~63KB) là bản gần tương đương `Amazon.js` (~64KB) và có thể là:
- Bản backup trước khi chỉnh sửa
- Bản thử nghiệm thay thế
- Dự phòng khi cần rollback

### Tác động của thay đổi
Vì `saveResultToFile()` bị comment out, dữ liệu sẽ **chỉ được trả về qua API** chứ **không được tự động lưu ra file CSV/JSON** nữa — người dùng phải tự xử lý việc lưu trong code của họ.

---

## 📝 Ghi chú cuối

Dự án này được thiết kế để thu thập dữ liệu nghiên cứu thị trường từ Amazon. Người dùng có trách nhiệm đảm bảo việc sử dụng tuân thủ **Terms of Service** của Amazon và các quy định pháp lý tại địa phương.

---

*Tài liệu được tạo tự động từ việc phân tích mã nguồn bởi Antigravity AI — 2026-02-28*
