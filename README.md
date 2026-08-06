# China Auto Export — B2B Site

汽车出口 B2B 官网。纯静态站点(GitHub Pages 托管),主页文案与车辆数据**外置为 JSON**,由 `script.js` 在浏览器端动态渲染。配套一个**无后端的管理后台**,通过 GitHub API 直接写回仓库,保存即触发 Pages 自动重新部署。

## 目录结构

```
.
├── index.html          # 主页(数据驱动,车辆区由 #invGrid 动态渲染)
├── script.js           # 前端逻辑:I18N 四语 / 车辆渲染 / 类型+搜索+品牌联合筛选 / 交互
├── data/
│   ├── site.json       # 主页全部文案(EN / ZH / AR / RU,四语字典)
│   └── vehicles.json   # 车辆数据(品牌/车型/类型/车身/年份/库存/图片等)
└── admin/
    └── index.html      # 管理后台(车辆 CRUD + 主页文案编辑,写回 GitHub)
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

## 部署

任意一种方式均可:

1. **通过后台**:在 `admin/` 中保存即部署(需上述 PAT)。
2. **直接 git push**:将本目录推送到 `main` 分支,GitHub Pages 自动发布。

线上地址:`https://xiaoxiao0709.github.io/autoexport-b2b/`
后台地址:`https://xiaoxiao0709.github.io/autoexport-b2b/admin/`
