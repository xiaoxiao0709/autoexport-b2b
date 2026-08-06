# China Auto Export — B2B Site

汽车出口 B2B 官网。纯静态站点(GitHub Pages 托管),主页文案与车辆数据**外置为 JSON**,由 `script.js` 在浏览器端动态渲染。配套一个**无后端的管理后台**,通过 GitHub API 直接写回仓库,保存即触发 Pages 自动重新部署。

## 目录结构

```
.
├── index.html          # 主页(数据驱动,车辆区由 #invGrid 动态渲染)
├── script.js           # 前端逻辑:I18N 四语 / 车辆渲染 / 类型+搜索+品牌联合筛选 / 交互
├── chat.js             # 前端"在线咨询"临时聊天 widget(GitHub Issue 中转)
├── data/
│   ├── site.json       # 主页全部文案(EN / ZH / AR / RU,四语字典)
│   ├── vehicles.json   # 车辆数据(含 published 上架开关)
│   └── config.json     # 站点配置(businessName / whatsapp / email / chatToken)
└── admin/
    └── index.html      # 管理后台(车辆 CRUD + 主页文案编辑 + 客服 Inbox + 配置,写回 GitHub)
```

## 本地预览

必须用本地服务器打开(fetch JSON 在 `file://` 协议下会被浏览器拦截):

```bash
cd <项目目录>
python3 -m http.server 4173
# 前台:  http://127.0.0.1:4173/
# 后台:  http://127.0.0.1:4173/admin/
```

## 管理后台(admin/)

打开 `admin/index.html`,填入:

- **Owner / Repository**: 默认 `xiaoxiao0709` / `autoexport-b2b`
- **Branch**: 留空则自动探测(本仓库为 `main`)
- **Token (PAT)**: 需要 `public_repo`(公开仓库)或 `repo`(私有)权限的 GitHub Personal Access Token

Token **仅保存在你当前浏览器的 localStorage**,直接发送给 `api.github.com`,不会经过任何第三方。

功能:
- **Vehicles**:车辆增 / 删 / 改;可填图片 URL,也可直接上传图片到仓库 `assets/`。
- **Homepage Content**:按分组编辑四语文案,支持搜索过滤。
- **Deploy & Status**:显示仓库/分支/实时地址,保存即提交文件并触发 Pages 重建(约 1 分钟生效)。

> 每次"Save"都会向仓库提交一个新文件版本,GitHub Pages 会自动重新构建并发布。

## 数据格式

`data/vehicles.json`(数组):

```json
{
  "id": "byd-song-plus",
  "brand": "BYD",
  "name": "Song Plus DM-i",
  "type": "phev",                       // ev | phev | petrol
  "bodyType": "SUV",                     // 已知值会被翻译:SUV/Hatchback/7-Seat SUV/Shooting Brake
  "year": 2025,
  "stock": 50,
  "status": "Export Ready",
  "image": "assets/car-byd-song-plus.png",
  "description": ""
}
```

`data/site.json`(四语字典):

```json
{ "en": { "nav.home": "Home", ... }, "zh": { ... }, "ar": { ... }, "ru": { ... } }
```

新增文案键时,记得为四种语言都补上,否则该语言下会回退到英文。

## 在线聊天 / 客服（Live Chat）

前端右下角有"💬 在线咨询"浮窗，访客可发起临时聊天；客服在后台 **Inbox · 客服** 页直接回复，回复会实时显示给访客。

实现方式（纯静态站无后端的安全折中）：访客消息以 **GitHub Issue**（标签 `chat`）形式存入仓库，客服回复即 Issue 评论。前端每隔约 10 秒轮询一次评论来显示客服回复。

- **前端** `chat.js`：读取 `data/config.json` 中的 `chatToken` 创建 Issue / 发评论 / 轮询。
- **后台 Inbox 页**：用管理员 PAT 读取 `chat` 标签的 Issue 会话、回复（发评论）、标记已解决（关闭 Issue）。
- **安全**：`chatToken` 必须是**细粒度 Token**，且**仅授权该仓库的 Issues 读写**（不要给 contents / repo 全权限）。即使泄露，攻击者也只能在该仓库建 Issue/评论，无法改动网站文件。请在后台 **Settings** 页填写。
- **兜底**：若未配置 `chatToken`，浮窗会自动展示后台 Settings 中填写的 WhatsApp / Email 快捷联系入口。

`data/config.json`：

```json
{ "businessName": "Auto Export", "whatsapp": "", "email": "", "chatToken": "" }
```

## 车辆上架 / 下架

每辆车的 `published` 字段控制是否在前台展示（`true` 上架 / `false` 下架）。在后台 Vehicles 页的编辑弹窗中通过开关设置；前台只渲染 `published !== false` 的车辆。

## 部署

### A. GitHub Pages（默认）

任意一种方式均可:

1. **通过后台**:在 `admin/` 中保存即部署(需上述 PAT)。
2. **直接 git push**:将本目录推送到 `main` 分支,GitHub Pages 自动发布。

线上地址:`https://xiaoxiao0709.github.io/autoexport-b2b/`
后台地址:`https://xiaoxiao0709.github.io/autoexport-b2b/admin/`

### B. 腾讯云 COS + CDN（双轨同步，推荐国内访问）

站点为纯静态,可托管到腾讯云 COS(+CDN)。后台编辑逻辑**不变**——仍写回 GitHub,由 GitHub Actions 在每次 push 后自动把静态文件同步到 COS。

前置(均需你自备):

1. 一个**专用**的腾讯云 COS 存储桶(建议开启静态网站托管 / 挂 CDN),记下 `bucket 名称` 与 `地域`(如 `ap-guangzhou`)。
2. 一对腾讯云访问密钥 `SecretId` / `SecretKey`(在访问管理 → API 密钥中心获取)。
3. 在本仓库 **Settings → Secrets and variables → Actions** 中添加 4 个仓库 Secret:
   - `TENCENT_SECRET_ID`
   - `TENCENT_SECRET_KEY`
   - `COS_BUCKET`(桶名,形如 `my-bucket-1234567890`)
   - `COS_REGION`(地域,如 `ap-guangzhou`)

推送 `main` 后,工作流 `.github/workflows/deploy-to-cos.yml` 会:

- 仅挑选站点文件(`index.html` / `script.js` / `chat.js` / `assets/` / `data/` / `admin/`)放入 `dist/`;
- 用 `TencentCloud/cos-action@v1` 上传到 COS,并 `clean: true` 做镜像同步(请确保该桶仅用于本站点)。

> 若在 COS 前挂了腾讯云 CDN,请在 CDN 控制台把 `/data/*` 的缓存 TTL 设为较短值(如 60s),或在上传后手动刷新 CDN 缓存,这样后台编辑后数据更新能在 TTL 内生效。
> 绑定自定义域名到腾讯云(国内)通常需要 ICP 备案;使用 COS/EdgeOne 默认域名则无需备案。

## 车辆上架 / 下架

每辆车的 `published` 字段控制是否在前台展示（`true` 上架 / `false` 下架）。在后台 Vehicles 页的编辑弹窗中通过开关设置；前台只渲染 `published !== false` 的车辆。
