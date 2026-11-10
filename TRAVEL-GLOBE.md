# 旅迹地球

一个中文个人旅行相册。首页的互动地球可旋转和缩放，点按地点标记可打开相册。可以搜索城市、街道和地址，在地球或街道地图上选点，也可以直接输入经纬度。照片、地点、旅行日期和备注保存在浏览器的 IndexedDB 中。

## 同步记录

| 日期（北京时间） | 来源版本 | 同步范围 |
| --- | --- | --- |
| 2026-11-07 | `f91542bb059889751bd1ba8fc3f37923f2b9b1ff` | 中文网页、互动地球、地点和照片存储、城市目录、飞天小女警插画及示例素材 |
| 2026-11-10 | `a9d3d321a02dcc7218d7bced3a12d46c6b390953` | 粉彩界面与加大的地球、可跳过的飞天小女警开场、全球地址搜索、街道地图和精确坐标选点 |
| 2026-11-10 | `2d7df3923da44d954e21c6ce38e47818490bb979` | 5400×2700 NASA 真彩色卫星地球、WebGL 高清渲染、国界及中文大洲／国家／城市标注 |

源版本已通过浏览器验收，覆盖两地上传、同一地点补传、刷新后从标记打开相册，以及手机触控模拟下的手动选点和上传。部署版的访问权限由 Sites 管理。用户照片和浏览器中的相册记录保存在各自的设备上。

2026-11-10 版本通过浏览器验收，覆盖开场播放与跳过、减少动态效果偏好、全球街道地址查询、街道地图加载与精确选点、两地上传和补传、刷新后从地球标记查看相册，以及手机触控选点。地址查询通过 Photon 服务完成，街道地图从 OpenStreetMap 请求瓦片。

2026-11-10 高清地球版本已用 Chrome 验证东亚与欧洲的地理图层、高清 WebGL 渲染、无 WebGL 的卫星底图回退、相册上传与刷新保留，以及手机触控选点。

卫星底图来自 [NASA Earth Observatory 的 Blue Marble Next Generation](https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-topography/#July)。国界及地名来自 [Natural Earth](https://www.naturalearthdata.com/downloads/110m-cultural-vectors/)。

## 本地预览

用静态 HTTP 服务器提供 `dist/` 目录，从服务器地址打开 `index.html`。例如，在已安装 Python 3 的环境中运行 `python -m http.server 8000 --directory dist`，然后访问 [本地预览](http://localhost:8000/)。

海岸线数据来自 [Natural Earth](https://www.naturalearthdata.com/downloads/110m-physical-vectors/110m-land/)。
