# 贝Ki-Map

一个中文个人旅行相册。首页的互动地球可旋转和缩放，点按地点标记可打开相册。可以搜索城市、街道和地址，在地球或街道地图上选点，也可以直接输入经纬度。照片、地点、旅行日期和备注保存在浏览器的 IndexedDB 中。

## 同步记录

| 日期（北京时间） | 来源版本 | 同步范围 |
| --- | --- | --- |
| 2026-11-07 | `f91542bb059889751bd1ba8fc3f37923f2b9b1ff` | 中文网页、互动地球、地点和照片存储、城市目录、飞天小女警插画及示例素材 |
| 2026-11-10 | `a9d3d321a02dcc7218d7bced3a12d46c6b390953` | 粉彩界面与加大的地球、可跳过的飞天小女警开场、全球地址搜索、街道地图和精确坐标选点 |
| 2026-11-10 | `2d7df3923da44d954e21c6ce38e47818490bb979` | 5400×2700 NASA 真彩色卫星地球、WebGL 高清渲染、国界及中文大洲／国家／城市标注 |
| 2026-11-10 | `53ed049e026d8be1964f1dba984a1001964ef9ea` | 贝Ki-Map 品牌与角色动画、国家到拍摄点的多级地图、滚轮进入街道、旅程往返定位、GPS 与旧版相册兼容 |
| 2026-11-10 | `1f3950dea8b595d1cf0555e8710a54c504aa206a` | 粉蓝星空、三城实景示例、独立影集与可恢复的照片编辑 |

源版本已通过浏览器验收，覆盖两地上传、同一地点补传、刷新后从标记打开相册，以及手机触控模拟下的手动选点和上传。部署版的访问权限由 Sites 管理。用户照片和浏览器中的相册记录保存在各自的设备上。

2026-11-10 版本通过浏览器验收，覆盖开场播放与跳过、减少动态效果偏好、全球街道地址查询、街道地图加载与精确选点、两地上传和补传、刷新后从地球标记查看相册，以及手机触控选点。地址查询通过 Photon 服务完成，街道地图从 OpenStreetMap 请求瓦片。

2026-11-10 高清地球版本已用 Chrome 验证东亚与欧洲的地理图层、高清 WebGL 渲染、无 WebGL 的卫星底图回退、相册上传与刷新保留，以及手机触控选点。

卫星底图来自 [NASA Earth Observatory 的 Blue Marble Next Generation](https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-topography/#July)。国界及地名来自 [Natural Earth](https://www.naturalearthdata.com/downloads/110m-cultural-vectors/)。

贝Ki-Map 的国家和城市镜头、城市媒体面板及旅程视图参考了 [StarMap](https://github.com/Aisland-SJL/StarMap/blob/main/README.zh.md)。国家点选使用 [Natural Earth 1:50m Admin 0 数据](https://www.naturalearthdata.com/downloads/50m-cultural-vectors/50m-admin-0-countries-2/)，地图中的街道瓦片来自 OpenStreetMap。角色和动画为站内矢量绘制。

Chrome 验收覆盖点击中国陆地进入国家面板、打开上海相册、点外滩拍摄点并在地图与旅程之间往返、滚轮进入街道、实际门牌搜索、EXIF GPS 微调、开场跳过和减少动态效果、手机触控和底部相册、旧版 IndexedDB v1 记录和照片读取。

## 粉蓝星空与独立影集

地图使用粉蓝星空、漂浮星尘和错峰流星。手机端减少流星和星点，系统减少动态效果时保留静态背景。示例按雷克雅未克、伦敦、大庆排列。

影集从地图或旅程打开，有独立地址，支持滑动看图、旋转、裁剪和编辑备注。IndexedDB v2 将编辑记录放入单独的存储区，保留原始照片字节与备注。返回地图恢复城市与缩放，返回旅程恢复日期分组。

Chrome 桌面和手机尺寸触控模拟通过验收，覆盖三城镜头定位、示例照片解码、手机点按与滑动、动效偏好、影集刷新、旋转和裁剪后的 JPEG 尺寸与备注、恢复原图及原备注、旧版 IndexedDB v1 相册迁移与原图校验、地图和旅程返回。

示例实景照片已缩小至 960 像素宽。影集内显示作者、来源、许可证及近似拍摄点说明。

- 雷克雅未克 · Ypsilon from Finland · CC0 1.0。[照片来源](https://commons.wikimedia.org/wiki/File:Reykjavik_view_with_Hallagrimskirkja.jpg)
- 伦敦 · Donnchadh H · CC BY 2.0。[照片来源](https://commons.wikimedia.org/wiki/File:Tower_Bridge_dusk.jpg)
- 大庆 · Jason Zhang · CC BY-SA 3.0。[照片来源](https://commons.wikimedia.org/wiki/File:Longfeng_Wetland_Park_observation_bridge_(2).jpg)

现有 Sites 站点已设置为链接可访问。上传照片、原图及编辑保存在访问者当前浏览器的 IndexedDB 中。[贝Ki-Map](https://luji-earth-travel-album.honeypuppy20.chatgpt.site)

## 本地预览

用静态 HTTP 服务器提供 `dist/` 目录，从服务器地址打开 `index.html`。例如，在已安装 Python 3 的环境中运行 `python -m http.server 8000 --directory dist`，然后访问 [本地预览](http://localhost:8000/)。

海岸线数据来自 [Natural Earth](https://www.naturalearthdata.com/downloads/110m-physical-vectors/110m-land/)。
