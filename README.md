# Glux · 金跨独立站

一套面向跨境电商的全栈独立站系统（前台品牌 **Plynook**）：多语言品牌商城 + 管理后台 + 客户订单跟踪 + 采购报价单，询盘成交通过 WhatsApp 完成，无在线支付流程。

- **前台商城**：Next.js 15（App Router）+ React 19 + TypeScript
- **后端 API**：FastAPI + SQLAlchemy 2，单模块实现（`backend/app/main.py`）
- **数据库**：PostgreSQL 16（Docker 部署）/ SQLite（本地开发零配置回退）
- **一体化部署**：docker-compose 一键拉起 db + backend + frontend

## 核心功能

### 前台商城（`/en` `/ja` `/ko` `/zh` 四语言）

- 首页：Banner 轮播、精选分类、新品、热卖（按 WhatsApp 点击热度排序）、精选商品
- 商品：列表 / 搜索 / 分类与标签筛选 / 排序（推荐、最新、热门），详情页含图库、视频、颜色变体、规格参数、相关推荐
- **询价清单（Inquiry List）**：代替购物车，加入清单后一键通过 WhatsApp 发送给客服报价
- **订单跟踪页** `/{locale}/order/{订单号}`：凭访问密码查看订单、补充收货信息并确认收货
- **采购报价单页** `/{locale}/procurement/{报价单号}`：凭密码查看报价、逐项确认商品、自行添加商品（含图片上传）、填写预期到货时间（自动换算为北京时间）
- 内置埋点：页面浏览 / 商品浏览 / WhatsApp 点击 / 询盘提交（自动去重，支持 UTM 参数）
- 明暗双主题，针对 iOS / Android / 桌面做设备级样式适配

### 管理后台（`/admin`）

| 模块 | 说明 |
| --- | --- |
| 商品管理 | 多语言字段（中/英/日/韩），中文文案可自动翻译为英/日/韩；图片视频上传、价格与库存、颜色变体、精选/新品/热卖标记、草稿与发布状态、1688 等货源信息、单品数据分析 |
| 分类 / 标签 / Banner | 多语言 + 自动翻译，统一 CRUD |
| 客户订单 | 录入商品明细、商品成本、头程/尾程运费；生成订单号（`POyyyymmdd-XXXXX`）与访问密码；维护国内外两段物流公司与单号 |
| 采购报价单 | 生成报价单（`PQyyyymmdd-XXXXX`）与访问密码；成本价/报价、头程尾程运费、额外支出、利润核算（仅内部可见）；发布时锁定当日汇率（人民币兑多币种）；可导出带图片的 Excel 报表 |
| 数据分析 | 当日 UV/PV/商品浏览/WhatsApp 点击/询盘提交；1–90 天趋势图；语言、来源、搜索词、热门商品与分类分布；询盘记录明细 |
| 站点设置 | 站点名称、WhatsApp 号码、联系邮箱、Instagram/TikTok/X/Pinterest 链接、是否展示价格、默认语言 |
| 账号管理 | super_admin 可创建/停用/删除 admin 账号；个人资料与密码修改 |

### 其他特性

- **自动翻译**：分类、标签、商品、报价单条目的中文文案通过 MyMemory API 自动翻译为英/日/韩（`AUTO_TRANSLATE=false` 可关闭，服务不可用时优雅回退）
- **每日汇率**：报价单发布时从 open.er-api.com 获取人民币汇率并锁定到单据
- **文件存储**：本地 `backend/storage`（默认）或七牛云对象存储（`STORAGE_BACKEND=qiniu`）；图片 ≤5MB（jpg/png/webp），视频 ≤200MB（mp4/webm/mov）
- **免迁移启动**：启动时自动建表并补齐缺失列，旧库可无损升级

## 项目结构

```
Glux/
├── docker-compose.yml        # db + backend + frontend 编排
├── .env.example              # 环境变量示例
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── storage/              # 本地上传文件目录（卷挂载）
│   └── app/
│       └── main.py           # 全部后端逻辑：模型 / 路由 / 鉴权 / Excel 导出 / 建表迁移
└── frontend/
    ├── Dockerfile            # 多阶段构建（deps → build → runtime）
    ├── next.config.ts        # 将 /api、/storage 反向代理到后端
    ├── package.json
    ├── public/brand/         # Plynook 品牌素材
    ├── lib/                  # API 请求封装 / i18n 文案 / 类型定义 / 价格工具
    ├── components/           # 站点骨架、商品浏览、询价清单、后台通用组件
    └── app/
        ├── page.tsx          # 根路径重定向到 /en
        ├── layout.tsx        # 主题与设备检测脚本
        ├── *.css             # 主题样式（明暗、移动端、后台）
        ├── [locale]/         # 四语言前台页面
        │   ├── page.tsx              # 首页
        │   ├── products/  search/    # 列表与搜索
        │   ├── product/[slug]/       # 商品详情
        │   ├── categories/[slug]/    # 分类页
        │   ├── wishlist/             # 询价清单
        │   ├── about/  contact/      # 品牌与联系页
        │   ├── order/[code]/         # 订单跟踪（密码访问）
        │   └── procurement/[code]/   # 采购报价单（密码访问）
        └── admin/            # 管理后台 13 个页面
            login/ dashboard/ products/ categories/ tags/ banners/
            orders/ procurements/ inquiries/ analytics/ settings/ admins/ profile/
```

## 快速开始（Docker Compose，推荐）

前置要求：Docker 与 Docker Compose。

```bash
cp .env.example .env        # 按需修改 ADMIN_USERNAME / ADMIN_PASSWORD / SECRET_KEY
docker compose up -d --build
```

启动完成后：

| 服务 | 地址 |
| --- | --- |
| 前台商城 | http://localhost:3000 |
| 管理后台 | http://localhost:3000/admin |
| 后端 API | http://localhost:8000（仅绑定 127.0.0.1，需反代对外） |

> 注意：`ADMIN_USERNAME` / `ADMIN_PASSWORD` **只在数据库没有任何账号时**用于创建初始管理员；若首次启动未设置，需清空数据卷后重新设置再启动。

## 本地开发

### 后端（默认使用 SQLite，无需装数据库）

```bash
cd backend
pip install -r requirements.txt

# 首次运行前设置初始管理员（同样是仅空库时生效）
export ADMIN_USERNAME=admin ADMIN_PASSWORD=12345678

uvicorn app.main:app --reload        # http://localhost:8000，交互式文档见 /docs
```

未设置 `DATABASE_URL` 时自动使用 `backend/plynook.db`；连接 PostgreSQL：

```bash
export DATABASE_URL=postgresql+psycopg://user:pass@localhost:5432/plynook
```

### 前端

```bash
cd frontend
npm install
API_URL=http://localhost:8000 npm run dev    # http://localhost:3000
```

Next.js 通过 rewrites 将 `/api/*`、`/storage/*` 代理到 `API_URL` 指向的后端，浏览器端直连同源路径，无跨域问题。

## 环境变量

| 变量 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | Docker 部署必填 | — | 初始管理员，仅空库时创建；密码至少 8 位 |
| `SECRET_KEY` | 生产必改 | `please-change-this-secret` | JWT 签名密钥 |
| `DATABASE_URL` | 否 | `sqlite:///backend/plynook.db` | 数据库连接串（PostgreSQL 用 `postgresql+psycopg://` 前缀） |
| `CORS_ORIGINS` | 否 | `http://localhost:3000` | 允许的跨域来源，逗号分隔 |
| `STORAGE_BACKEND` | 否 | `local` | `local` 本地存储 / `qiniu` 七牛云 |
| `QINIU_ACCESS_KEY` 等 | qiniu 时必填 | — | `QINIU_ACCESS_KEY` `QINIU_SECRET_KEY` `QINIU_BUCKET` `QINIU_DOMAIN` `QINIU_PREFIX` |
| `AUTO_TRANSLATE` | 否 | `true` | 中文文案自动翻译开关 |
| `ENABLE_DEMO_SEED` | 否 | 关闭 | 设为 `1` 时空库写入演示分类/标签/商品/Banner |
| `SITE_URL` | 否 | `https://cooolmake.com` | 正式域名，用于 sitemap、canonical 与客户访问链接 |
| `GOOGLE_SITE_VERIFICATION` | 否 | — | Google Search Console HTML 标记验证码（网域+DNS 验证则无需填写） |

## API 概览

后端为单模块 FastAPI 应用，完整交互式文档见运行后的 `http://localhost:8000/docs`。

### 公开接口（前台）

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/public/home` | 首页聚合数据（Banner、分类、新品、热卖、精选） |
| GET | `/api/public/products` | 商品列表：`category` `tag` `keyword` `collection=new` `sort` `page` `page_size` |
| GET | `/api/public/products/{slug}` | 商品详情（含相关推荐） |
| GET | `/api/public/categories` `/api/public/tags` | 分类 / 标签 |
| GET | `/api/public/settings` | 站点设置 |
| POST | `/api/public/analytics/event` | 埋点上报（自动去重、解析 UTM） |
| GET/POST/PUT | `/api/public/orders/{code}...` | 订单密码校验、查看、补充收货信息、确认收货 |
| GET/POST/PUT/DELETE | `/api/public/procurement-quotes/{code}...` | 报价单密码登录、查看、条目确认/增删改、图片上传、预期到货时间 |

### 管理接口（`/api/admin/*`，Bearer JWT 鉴权）

| 分组 | 路径前缀 | 说明 |
| --- | --- | --- |
| 认证 | `auth/login` `auth/me` `auth/profile` | 登录换 JWT（12 小时有效）、资料与密码维护 |
| 商品 | `products` | CRUD、关键字搜索、单品分析；含草稿/发布流 |
| 分类 / 标签 / Banner | `categories` `tags` `banners` | 通用 CRUD（多语言自动翻译） |
| 订单 | `orders` | CRUD、重置访问密码、取消 |
| 报价单 | `procurement-quotes` | CRUD、Excel 导出、重置密码、刷新汇率、取消；`procurement-rates/today` 当日汇率 |
| 上传 | `upload/image` `upload/video` | 图片 ≤5MB、视频 ≤200MB，本地或七牛云 |
| 设置 | `settings` | 站点设置键值读写 |
| 分析 | `analytics/summary` `trend` `breakdown` `inquiries` | 汇总 / 趋势 / 维度分布 / 询盘明细 |
| 账号 | `users` | 仅 super_admin：创建、停用、删除管理员 |

## 业务流程简述

**询盘成交（前台）**：顾客浏览商品 → 加入询价清单 → 通过 WhatsApp 发送给客服 → 客服在后台创建客户订单（含成本与两段运费）→ 顾客凭订单号 + 密码在订单页补充收货信息并确认 → 后台维护物流单号，顾客持续跟踪。

**采购报价（代购场景）**：顾客提交想采购的商品 → 客服在后台创建报价单（中文录入，自动翻译英文展示；锁定当日汇率）→ 发布后顾客凭密码访问报价页，逐项确认、添加商品、设定预期到货时间 → 双方确认后可导出 Excel 留档（含成本与利润核算，仅供内部）。

## Google 收录（SEO）

前台已内置：各页面四语言 metadata 与 canonical/hreflang、`/robots.txt`、`/sitemap.xml`（自动含全部商品/分类）、商品页 Product/Breadcrumb 结构化数据、默认分享图 `frontend/public/brand/og-default.png`。

上线后启用收录：

1. 确认 `https://cooolmake.com/robots.txt` 与 `/sitemap.xml` 可访问；
2. 在 [Google Search Console](https://search.google.com/search-console) 添加「网域」资源 `cooolmake.com`，按提示在域名解析商处加一条 TXT 记录完成验证（或用「网址前缀」+ HTML 标记方式，将验证码填入 `GOOGLE_SITE_VERIFICATION` 后重建前端）；
3. Search Console「站点地图」中提交 `sitemap.xml`；
4. 搜索页/询价单/订单页/后台已配置 `noindex`，属预期行为。

## 注意事项

- 生产部署请务必修改 `SECRET_KEY`，并通过反向代理（如 Nginx/Caddy）为 3000/8000 端口配置 HTTPS。
- 后端将用户名 `17605901054@163.com` 与 `1263898899@qq.com` 固定为 `super_admin` 角色（见 `backend/app/main.py` 中的 `SUPER_ADMIN_USERNAMES` 常量），其余账号均为普通 `admin`；super_admin 不可被停用或删除。
- 报价单对顾客隐藏成本价、利润、内部备注等字段；订单确认后对公众隐藏顾客收货信息。
- 依赖两个外部免费服务：MyMemory（翻译）与 open.er-api.com（汇率），不可用时分别回退为原文 / 历史锁定汇率，不影响主流程。
