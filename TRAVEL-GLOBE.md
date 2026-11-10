# 贝Ki-Map 项目与发布记录

贝Ki-Map 是以 3D 卫星地球和日期旅程为入口的中文旅行相册。公开页面可直接打开。示例影集有独立地址，个人相册数据由当前浏览器保存。[公开首页](https://rayhan0305.github.io/Map/) · [雷克雅未克](https://rayhan0305.github.io/Map/album.html?id=city-reykjavik) · [伦敦](https://rayhan0305.github.io/Map/album.html?id=city-london) · [大庆](https://rayhan0305.github.io/Map/album.html?id=city-daqing)

## 当前功能

- **地图与地球**。使用 5400 × 2700 的卫星影像。支持拖动、滚轮及双指缩放，可按全球、国家、城市、拍摄点逐步浏览。放大到街道尺度时可以使用街道地图精确选点。国界和中文地名独立绘制。首页有粉蓝星空、漂浮星尘和错峰流星，手机端减少动效，系统设置减少动态效果时使用静态星空。
- **地点和上传**。支持搜索城市、街道和门牌，输入经纬度，在地球或街道地图手动选点，以及批量添加照片。可读取兼容照片的 EXIF GPS，并让用户确认或调整。向同一地点补传照片会归入原相册。
- **独立影集与旅程**。城市侧栏或手机抽屉可打开独立影集，旅程按日期串联地点、照片和备注。影集支持大图、上一张、下一张、手机滑动、旋转、裁剪、编辑备注和恢复原图。返回地图时恢复原城市和缩放，返回旅程时恢复日期分组。
- **示例内容**。雷克雅未克、伦敦、大庆按固定顺序出现，均有标注为「示例」的实景照片。影集内附照片作者、授权和拍摄点说明。
- **三位旅行伙伴**。花花随机打开一个已有相册并移动镜头。泡泡打开旅程并定位到最新日期。毛毛打开添加照片，有选中城市时预填地点。三位角色有中文对白，可用鼠标、键盘或手机点按。对白约停留 2.6 秒。
- **生日开场**。约 2.8 秒，包含三位角色、粉蓝和浅金烟花以及「生日快乐」。「跳过本次」只结束当次开场。「关闭生日版」会在当前浏览器保存偏好，随后使用约 1.8 秒的普通开场。首页底部可重新开启。减少动态效果模式下，生日版使用静态祝福与烟花图案，角色回复使用静态气泡。

## 相册备份与找回

### 数据存放

| 内容 | 存放位置 |
| --- | --- |
| 个人地点和坐标 | IndexedDB 数据库 `travel-globe` 的 `places` |
| 原图、拍摄坐标、旅行日期和原始备注 | `photos`，照片以浏览器 Blob 或 File 保存 |
| 旋转、裁剪和编辑后的备注或图像 | `photo-edits`，和原图分开保存，恢复原图时移除该编辑记录 |
| 生日版开场开关 | 当前站点的 `localStorage`，键名 `beiki-map-birthday-intro` |
| 雷克雅未克、伦敦、大庆的示例照片 | 仓库 `dist/` 的静态素材，随网站发布 |

相册数据库当前是 v2，可直接读取并迁移 v1。网站本身没有为相册设置过期时间。浏览器以协议、主机名和端口区分站点存储。新站、旧站、本机预览是不同来源。`localhost` 与 `127.0.0.1` 分开保存，改变本机端口也会切换存储。首页和影集在同一来源下共享数据。换设备、浏览器或浏览器用户档案后也需要导入备份。清理站点数据、结束无痕浏览，或浏览器在存储压力下回收数据，都可能让原记录不可用。[存储实现](dist/storage.mjs) · [浏览器存储与回收说明](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)

### 导出、迁移和恢复

1. 用当初上传照片的设备、浏览器及同一用户档案，打开当时的网址。如果以前通过本机预览上传，使用原来相同的地址和端口。[旧站](https://luji-earth-travel-album.honeypuppy20.chatgpt.site/) · [公开新站](https://rayhan0305.github.io/Map/)
2. 在首页底部打开「相册备份与迁移」，点「下载备份」，导出 `beiki-map-相册备份-YYYY-MM-DD.json`。备份以明文 JSON 保存，格式为 `beiki-map-photo-backup` v1，包含相册原图、日期、坐标、备注及编辑记录。请保存在自己的设备或私人备份空间。
3. 在目标网址打开同一菜单，点击「选择贝Ki-Map 备份文件」，选中 JSON 后点「导入备份」。看到导入数量后，点「刷新查看相册」。再从地图或旅程打开一座城市，确认照片和编辑结果。
4. 同一份备份可以重复导入。遇到相同记录 ID，保留目标浏览器已有版本。无法识别的备份会被拒绝，浏览器存储不足时整个导入会回滚。示例原图随网站发布，生日开场偏好由目标浏览器单独设置。[备份格式和实现](dist/backup-data.mjs)

### 照片突然不见时

| 现象 | 先检查什么 |
| --- | --- |
| 三个示例仍在，个人相册显示为空 | 在浏览器历史里找到上传时使用的原网址，用原设备和用户档案打开。先查旧站和原本机预览，再查新站。若照片仍在，立即导出备份。 |
| 浏览器提示相册升级或读取失败 | 关闭同一站点的其他旧标签页，再打开原网址。排查期间保留该站点的浏览器数据。 |
| 示例影集或图片也加载失败 | 先从系统浏览器打开公开首页和伦敦示例，检查网络和页面加载情况。 |
| 原站点存储已清除 | 用此前导出的 JSON 恢复。手头只有原照片时，可以重新上传原图并重新填写地点、日期或备注。 |

## 本地预览与部署

用静态 HTTP 服务器提供 `dist/`，从浏览器打开首页或独立影集。以下命令在仓库根目录执行。

```sh
python -m http.server 8000 --bind 127.0.0.1 --directory dist
```

本地预览和公开站分别保存数据。[本机首页](http://127.0.0.1:8000/) · [本机伦敦影集](http://127.0.0.1:8000/album.html?id=city-london)

独立站使用 GitHub Pages。`main` 的 `dist/` 保存完整网页代码和素材，`gh-pages` 根目录放置同一批文件及 `.nojekyll`。应用使用相对路径，以支持 `/Map/` 子路径。发布新版时将 `dist/` 同步到发布分支根目录，保留 `.nojekyll`。仓库的 Pages 来源设置为 `Deploy from a branch`，分支 `gh-pages`，目录 `/ (root)`。[Pages 设置](https://github.com/RayHan0305/Map/settings/pages) · [当前发布提交](https://github.com/RayHan0305/Map/commit/ae2abe3c5b62db248bb12fdcae747a71bd6b3ea5)

地址搜索使用 Photon，街道图层从 OpenStreetMap 获取瓦片。打开地图、示例影集、已有相册及导入备份使用站点静态文件与浏览器本地数据。[Photon](https://github.com/komoot/photon) · [OpenStreetMap 版权与署名](https://www.openstreetmap.org/copyright)

## 源码结构

| 文件 | 职责 |
| --- | --- |
| `index.html`、`app.mjs`、`styles.css`、`sky.css` | 地图、旅程、上传界面、角色入口和星空样式 |
| `globe.mjs`、`globe-map.mjs`、`geography.mjs` 及地理数据模块 | 卫星球体、镜头、国家边界和地名层 |
| `geocoder.mjs`、`street-map.mjs`、`photo-gps.mjs` | 地址查找、街道图层和 EXIF GPS |
| `albums.mjs`、`journey.mjs`、`album-page.mjs`、`album-navigation.mjs` | 相册分组、日期旅程、独立影集及返回视角 |
| `storage.mjs`、`backup-data.mjs`、`backup-ui.mjs`、`photo-editor.mjs` | 本地数据、备份迁移和非破坏性编辑 |
| `intro.mjs`、`intro.css`、`powerpuff.svg`、`samples.mjs` | 开场、角色插画、示例地点及照片授权 |

## 验收记录

| 阶段 | 实测范围 |
| --- | --- |
| 上传与地图 | 两处上传、同一地点补传、刷新后从地球标记读取，手机触控模拟下手动选点和上传，地址和门牌查询、街道地图精确选点、EXIF GPS 确认与调整。 |
| 高清地球和旅程 | 东亚与欧洲地理图层、WebGL 卫星渲染、无 WebGL 回退，中国国家面板、上海和外滩拍摄点、地图与旅程跳转。上海为历史验收用示例。 |
| 独立影集和编辑 | 三城定位、照片解码、地图缩放与旅程日期恢复、手机滑动、旋转和裁剪后的尺寸、备注、刷新保留、恢复原图并核对原始文件、IndexedDB v1 迁移。 |
| 跨域迁移 | 两个浏览器来源之间导出和导入，核对地点、拍摄坐标、原图字节、日期、备注和编辑。验证损坏文件拒绝、重复导入，以及模拟浏览器存储不足时回滚。 |
| 角色和开场 | Chrome 桌面鼠标与键盘、手机尺寸触控模拟，覆盖对白、相册镜头、最近日期、上传默认地点、生日烟花、约 2.8 秒与约 1.8 秒开场，以及跳过、关闭、刷新持久化、重新开启、减少动态效果。 |
| 公开发布 | 未登录 Chrome 能打开 GitHub Pages，检查生日开场和角色对白，能从地图打开影集。此前也验证过三个示例影集的直达、刷新和图片加载，以及旧站迁移入口。 |
| 文件同步核对 | 本机网页文件、`main/dist` 与 `gh-pages` 发布根目录中的 35 个代码和素材文件逐项核对 Git blob 哈希一致。 |

## 同步记录

| 日期（北京时间） | 来源版本 | 同步范围 |
| --- | --- | --- |
| 2026-11-07 | `f91542bb059889751bd1ba8fc3f37923f2b9b1ff` | 中文网页、互动地球、地点和照片存储、城市目录、飞天小女警插画及示例素材 |
| 2026-11-10 | `a9d3d321a02dcc7218d7bced3a12d46c6b390953` | 粉彩界面与加大的地球、可跳过的飞天小女警开场、全球地址搜索、街道地图和精确坐标选点 |
| 2026-11-10 | `2d7df3923da44d954e21c6ce38e47818490bb979` | 5400×2700 NASA 真彩色卫星地球、WebGL 高清渲染、国界及中文大洲／国家／城市标注 |
| 2026-11-10 | `53ed049e026d8be1964f1dba984a1001964ef9ea` | 贝Ki-Map 品牌与角色动画、国家到拍摄点的多级地图、滚轮进入街道、旅程往返定位、GPS 与旧版相册兼容 |
| 2026-11-10 | `1f3950dea8b595d1cf0555e8710a54c504aa206a` | 粉蓝星空、三城实景示例、独立影集与可恢复的照片编辑 |
| 2026-11-10 | `7c911c098034dfe2a539a23a4117d764e8dd4b9d` | 独立静态托管与跨域相册备份迁移 |
| 2026-11-10 | `ae2abe3c5b62db248bb12fdcae747a71bd6b3ea5` | GitHub Pages 生日开场、浏览器偏好与旅行伙伴互动 |

## 参考与素材

- 卫星影像使用 NASA Earth Observatory 的 Blue Marble Next Generation。国界、地名和海岸线使用 Natural Earth 数据。[卫星影像](https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-topography/#July) · [国界和地名](https://www.naturalearthdata.com/downloads/110m-cultural-vectors/) · [国家点选数据](https://www.naturalearthdata.com/downloads/50m-cultural-vectors/50m-admin-0-countries-2/) · [海岸线](https://www.naturalearthdata.com/downloads/110m-physical-vectors/110m-land/)
- 国家到城市的镜头、城市媒体面板和旅程视图参考 StarMap。角色和开场使用站内矢量绘制。[StarMap](https://github.com/Aisland-SJL/StarMap/blob/main/README.zh.md)
- 雷克雅未克示例由 Ypsilon from Finland 摄影，CC0 1.0，示例位置标为近似。[照片来源](https://commons.wikimedia.org/wiki/File:Reykjavik_view_with_Hallagrimskirkja.jpg)
- 伦敦示例由 Donnchadh H 摄影，CC BY 2.0，在伦敦桥上拍摄。[照片来源](https://commons.wikimedia.org/wiki/File:Tower_Bridge_dusk.jpg)
- 大庆示例由 Jason Zhang 摄影，CC BY-SA 3.0，示例位置标为龙凤湿地公园附近。[照片来源](https://commons.wikimedia.org/wiki/File:Longfeng_Wetland_Park_observation_bridge_(2).jpg)

三张示例照片均缩小至 960 像素宽。对应影集附原始来源、授权链接与修改说明。
