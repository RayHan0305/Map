// A compact offline catalog of approximate city centers. Other places can be
// recorded directly on the globe.
const catalog = `
beijing|北京|中国|39.90|116.41|Beijing,Peking
shanghai|上海|中国|31.23|121.47|Shanghai
guangzhou|广州|中国|23.13|113.26|Guangzhou,Canton
shenzhen|深圳|中国|22.54|114.06|Shenzhen
chengdu|成都|中国|30.57|104.07|Chengdu
chongqing|重庆|中国|29.56|106.55|Chongqing
hangzhou|杭州|中国|30.27|120.16|Hangzhou
suzhou|苏州|中国|31.30|120.59|Suzhou
nanjing|南京|中国|32.06|118.80|Nanjing,Nanking
xian|西安|中国|34.34|108.94|Xi'an,Xian
kunming|昆明|中国|25.04|102.71|Kunming
dali|大理|中国|25.61|100.27|Dali
lijiang|丽江|中国|26.86|100.23|Lijiang
shangri-la|香格里拉|中国|27.83|99.70|Shangri-La,Shangrila
changsha|长沙|中国|28.23|112.94|Changsha
wuhan|武汉|中国|30.59|114.31|Wuhan
zhengzhou|郑州|中国|34.75|113.63|Zhengzhou
tianjin|天津|中国|39.08|117.20|Tianjin
shijiazhuang|石家庄|中国|38.04|114.51|Shijiazhuang
taiyuan|太原|中国|37.87|112.55|Taiyuan
datong|大同|中国|40.08|113.30|Datong
qingdao|青岛|中国|36.07|120.38|Qingdao
jinan|济南|中国|36.67|117.00|Jinan
yantai|烟台|中国|37.46|121.45|Yantai
weihai|威海|中国|37.51|122.12|Weihai
xiamen|厦门|中国|24.48|118.09|Xiamen,Amoy
fuzhou|福州|中国|26.08|119.30|Fuzhou
quanzhou|泉州|中国|24.87|118.68|Quanzhou
guilin|桂林|中国|25.27|110.29|Guilin
yangshuo|阳朔|中国|24.78|110.50|Yangshuo
nanning|南宁|中国|22.82|108.37|Nanning
haikou|海口|中国|20.04|110.20|Haikou
sanya|三亚|中国|18.25|109.51|Sanya
ningbo|宁波|中国|29.87|121.55|Ningbo
wenzhou|温州|中国|27.99|120.70|Wenzhou
wuxi|无锡|中国|31.49|120.31|Wuxi
yangzhou|扬州|中国|32.39|119.41|Yangzhou
hefei|合肥|中国|31.82|117.23|Hefei
nanchang|南昌|中国|28.68|115.86|Nanchang
jingdezhen|景德镇|中国|29.27|117.18|Jingdezhen
guiyang|贵阳|中国|26.65|106.63|Guiyang
zhangjiajie|张家界|中国|29.12|110.48|Zhangjiajie
lhasa|拉萨|中国|29.65|91.17|Lhasa
lanzhou|兰州|中国|36.06|103.83|Lanzhou
dunhuang|敦煌|中国|40.14|94.66|Dunhuang
xining|西宁|中国|36.62|101.78|Xining
yinchuan|银川|中国|38.49|106.23|Yinchuan
urumqi|乌鲁木齐|中国|43.83|87.62|Ürümqi,Urumchi
kashgar|喀什|中国|39.47|75.99|Kashgar,Kashi
hohhot|呼和浩特|中国|40.84|111.75|Hohhot
harbin|哈尔滨|中国|45.80|126.53|Harbin
daqing|大庆|中国|46.60|125.02|Daqing,大庆市,黑龙江大庆
changchun|长春|中国|43.82|125.32|Changchun
shenyang|沈阳|中国|41.80|123.43|Shenyang
dalian|大连|中国|38.91|121.61|Dalian
hong-kong|香港|中国香港|22.28|114.17|Hong Kong,HK
macao|澳门|中国澳门|22.20|113.54|Macao,Macau
taipei|台北|中国台湾|25.04|121.56|Taipei,臺北
kaohsiung|高雄|中国台湾|22.63|120.30|Kaohsiung
tokyo|东京|日本|35.68|139.69|Tokyo,Tōkyō,東京
kyoto|京都|日本|35.01|135.77|Kyoto,Kyōto
osaka|大阪|日本|34.69|135.50|Osaka,Ōsaka
nara|奈良|日本|34.69|135.80|Nara
kanazawa|金泽|日本|36.56|136.66|Kanazawa,金沢
sapporo|札幌|日本|43.06|141.35|Sapporo
hakodate|函馆|日本|41.77|140.73|Hakodate,函館
fukuoka|福冈|日本|33.59|130.40|Fukuoka,福岡
hiroshima|广岛|日本|34.39|132.46|Hiroshima,広島
nagoya|名古屋|日本|35.18|136.91|Nagoya
nagano|长野|日本|36.65|138.18|Nagano,長野
yokohama|横滨|日本|35.44|139.64|Yokohama,横浜
naha|那霸|日本|26.21|127.68|Naha,冲绳,沖縄,Okinawa
seoul|首尔|韩国|37.57|126.98|Seoul,서울,首爾
busan|釜山|韩国|35.18|129.08|Busan,부산
jeju|济州|韩国|33.50|126.53|Jeju,제주
ulaanbaatar|乌兰巴托|蒙古|47.92|106.92|Ulaanbaatar,Ulan Bator
singapore|新加坡|新加坡|1.29|103.85|Singapore,SG
bangkok|曼谷|泰国|13.76|100.50|Bangkok
chiang-mai|清迈|泰国|18.79|98.99|Chiang Mai
phuket|普吉|泰国|7.88|98.39|Phuket,普吉岛
hanoi|河内|越南|21.03|105.85|Hanoi,Hà Nội
ho-chi-minh-city|胡志明市|越南|10.78|106.70|Ho Chi Minh City,Saigon,西贡
da-nang|岘港|越南|16.06|108.22|Da Nang,Đà Nẵng
hoi-an|会安|越南|15.88|108.33|Hoi An,Hội An
phnom-penh|金边|柬埔寨|11.56|104.93|Phnom Penh
siem-reap|暹粒|柬埔寨|13.36|103.86|Siem Reap,吴哥,Angkor
luang-prabang|琅勃拉邦|老挝|19.89|102.14|Luang Prabang
vientiane|万象|老挝|17.97|102.60|Vientiane
yangon|仰光|缅甸|16.87|96.20|Yangon,Rangoon
manila|马尼拉|菲律宾|14.60|120.98|Manila
cebu|宿务|菲律宾|10.32|123.89|Cebu,Cebu City
kuala-lumpur|吉隆坡|马来西亚|3.14|101.69|Kuala Lumpur,KL
george-town|乔治市|马来西亚|5.41|100.34|George Town,Penang,槟城
kota-kinabalu|亚庇|马来西亚|5.98|116.07|Kota Kinabalu
jakarta|雅加达|印度尼西亚|-6.21|106.85|Jakarta,印尼
denpasar|登巴萨|印度尼西亚|-8.65|115.22|Denpasar,Bali,巴厘岛,印尼
yogyakarta|日惹|印度尼西亚|-7.80|110.37|Yogyakarta,印尼
delhi|新德里|印度|28.61|77.21|New Delhi,Delhi,德里
mumbai|孟买|印度|19.08|72.88|Mumbai,Bombay
agra|阿格拉|印度|27.18|78.01|Agra,泰姬陵,Taj Mahal
jaipur|斋浦尔|印度|26.91|75.79|Jaipur
bengaluru|班加罗尔|印度|12.97|77.59|Bengaluru,Bangalore
kolkata|加尔各答|印度|22.57|88.36|Kolkata,Calcutta
kathmandu|加德满都|尼泊尔|27.72|85.32|Kathmandu
pokhara|博卡拉|尼泊尔|28.21|83.99|Pokhara
colombo|科伦坡|斯里兰卡|6.93|79.86|Colombo
male|马累|马尔代夫|4.18|73.51|Malé,Male
dhaka|达卡|孟加拉国|23.81|90.41|Dhaka
islamabad|伊斯兰堡|巴基斯坦|33.69|73.06|Islamabad
almaty|阿拉木图|哈萨克斯坦|43.24|76.89|Almaty
tashkent|塔什干|乌兹别克斯坦|41.30|69.24|Tashkent
samarkand|撒马尔罕|乌兹别克斯坦|39.65|66.96|Samarkand,Samarqand
dubai|迪拜|阿联酋|25.20|55.27|Dubai
abu-dhabi|阿布扎比|阿联酋|24.45|54.38|Abu Dhabi
doha|多哈|卡塔尔|25.29|51.53|Doha
muscat|马斯喀特|阿曼|23.59|58.38|Muscat
riyadh|利雅得|沙特阿拉伯|24.71|46.67|Riyadh
amman|安曼|约旦|31.95|35.93|Amman
istanbul|伊斯坦布尔|土耳其|41.01|28.98|Istanbul,İstanbul
ankara|安卡拉|土耳其|39.93|32.86|Ankara
goreme|格雷梅|土耳其|38.64|34.83|Göreme,Cappadocia,卡帕多奇亚
tbilisi|第比利斯|格鲁吉亚|41.72|44.79|Tbilisi
baku|巴库|阿塞拜疆|40.41|49.87|Baku
yerevan|埃里温|亚美尼亚|40.18|44.51|Yerevan
london|伦敦|英国|51.51|-0.13|London,UK,英格兰,England
edinburgh|爱丁堡|英国|55.95|-3.19|Edinburgh,Scotland,苏格兰
manchester|曼彻斯特|英国|53.48|-2.24|Manchester
oxford|牛津|英国|51.75|-1.26|Oxford
cambridge-uk|剑桥|英国|52.21|0.12|Cambridge
dublin|都柏林|爱尔兰|53.35|-6.26|Dublin
paris|巴黎|法国|48.86|2.35|Paris
lyon|里昂|法国|45.76|4.84|Lyon
nice|尼斯|法国|43.71|7.26|Nice
marseille|马赛|法国|43.30|5.37|Marseille
bordeaux|波尔多|法国|44.84|-0.58|Bordeaux
strasbourg|斯特拉斯堡|法国|48.57|7.75|Strasbourg
berlin|柏林|德国|52.52|13.41|Berlin
munich|慕尼黑|德国|48.14|11.58|Munich,München
frankfurt|法兰克福|德国|50.11|8.68|Frankfurt
hamburg|汉堡|德国|53.55|9.99|Hamburg
cologne|科隆|德国|50.94|6.96|Cologne,Köln
amsterdam|阿姆斯特丹|荷兰|52.37|4.89|Amsterdam
rotterdam|鹿特丹|荷兰|51.92|4.48|Rotterdam
brussels|布鲁塞尔|比利时|50.85|4.35|Brussels,Bruxelles
bruges|布鲁日|比利时|51.21|3.22|Bruges,Brugge
luxembourg|卢森堡|卢森堡|49.61|6.13|Luxembourg
zurich|苏黎世|瑞士|47.38|8.54|Zürich,Zurich
geneva|日内瓦|瑞士|46.20|6.14|Geneva,Genève
lucerne|卢塞恩|瑞士|47.05|8.31|Lucerne,Luzern
interlaken|因特拉肯|瑞士|46.69|7.86|Interlaken
vienna|维也纳|奥地利|48.21|16.37|Vienna,Wien
salzburg|萨尔茨堡|奥地利|47.81|13.04|Salzburg
rome|罗马|意大利|41.90|12.50|Rome,Roma
florence|佛罗伦萨|意大利|43.77|11.26|Florence,Firenze
venice|威尼斯|意大利|45.44|12.32|Venice,Venezia
milan|米兰|意大利|45.46|9.19|Milan,Milano
naples|那不勒斯|意大利|40.85|14.27|Naples,Napoli
palermo|巴勒莫|意大利|38.12|13.36|Palermo,Sicily,西西里
barcelona|巴塞罗那|西班牙|41.39|2.17|Barcelona
madrid|马德里|西班牙|40.42|-3.70|Madrid
seville|塞维利亚|西班牙|37.39|-5.98|Seville,Sevilla
granada|格拉纳达|西班牙|37.18|-3.60|Granada
valencia|瓦伦西亚|西班牙|39.47|-0.38|Valencia,València
lisbon|里斯本|葡萄牙|38.72|-9.14|Lisbon,Lisboa
porto|波尔图|葡萄牙|41.15|-8.61|Porto,Oporto
athens|雅典|希腊|37.98|23.73|Athens,Athína
fira|费拉|希腊|36.42|25.43|Fira,Santorini,圣托里尼
prague|布拉格|捷克|50.08|14.44|Prague,Praha
budapest|布达佩斯|匈牙利|47.50|19.04|Budapest
warsaw|华沙|波兰|52.23|21.01|Warsaw,Warszawa
krakow|克拉科夫|波兰|50.06|19.94|Kraków,Krakow,Cracow
ljubljana|卢布尔雅那|斯洛文尼亚|46.06|14.51|Ljubljana
dubrovnik|杜布罗夫尼克|克罗地亚|42.65|18.09|Dubrovnik
zagreb|萨格勒布|克罗地亚|45.81|15.98|Zagreb
belgrade|贝尔格莱德|塞尔维亚|44.82|20.46|Belgrade,Beograd
bucharest|布加勒斯特|罗马尼亚|44.43|26.10|Bucharest,București
sofia|索菲亚|保加利亚|42.70|23.32|Sofia
kyiv|基辅|乌克兰|50.45|30.52|Kyiv,Kiev
moscow|莫斯科|俄罗斯|55.76|37.62|Moscow,Moskva
saint-petersburg|圣彼得堡|俄罗斯|59.94|30.31|Saint Petersburg,St Petersburg
copenhagen|哥本哈根|丹麦|55.68|12.57|Copenhagen,København
oslo|奥斯陆|挪威|59.91|10.75|Oslo
bergen|卑尔根|挪威|60.39|5.32|Bergen
tromso|特罗姆瑟|挪威|69.65|18.96|Tromsø,Tromso
stockholm|斯德哥尔摩|瑞典|59.33|18.07|Stockholm
helsinki|赫尔辛基|芬兰|60.17|24.94|Helsinki
rovaniemi|罗瓦涅米|芬兰|66.50|25.73|Rovaniemi
tallinn|塔林|爱沙尼亚|59.44|24.75|Tallinn
riga|里加|拉脱维亚|56.95|24.11|Riga,Rīga
vilnius|维尔纽斯|立陶宛|54.69|25.28|Vilnius
reykjavik|雷克雅未克|冰岛|64.15|-21.94|Reykjavík,Reykjavik
new-york|纽约|美国|40.71|-74.01|New York,New York City,NYC
san-francisco|旧金山|美国|37.77|-122.42|San Francisco,SF,三藩市
los-angeles|洛杉矶|美国|34.05|-118.24|Los Angeles,LA
san-diego|圣迭戈|美国|32.72|-117.16|San Diego,圣地亚哥
seattle|西雅图|美国|47.61|-122.33|Seattle
portland|波特兰|美国·俄勒冈州|45.52|-122.68|Portland,Oregon
portland-maine|波特兰|美国·缅因州|43.66|-70.25|Portland,Maine
las-vegas|拉斯维加斯|美国|36.17|-115.14|Las Vegas
honolulu|檀香山|美国|21.31|-157.86|Honolulu,Hawaii,夏威夷
chicago|芝加哥|美国|41.88|-87.63|Chicago
boston|波士顿|美国|42.36|-71.06|Boston
washington-dc|华盛顿|美国|38.91|-77.04|Washington,Washington DC,华盛顿特区
miami|迈阿密|美国|25.76|-80.19|Miami
orlando|奥兰多|美国|28.54|-81.38|Orlando
houston|休斯敦|美国|29.76|-95.37|Houston,休斯顿
denver|丹佛|美国|39.74|-104.99|Denver
toronto|多伦多|加拿大|43.65|-79.38|Toronto
vancouver|温哥华|加拿大|49.28|-123.12|Vancouver
montreal|蒙特利尔|加拿大|45.50|-73.57|Montréal,Montreal,蒙特娄
quebec-city|魁北克城|加拿大|46.81|-71.21|Québec,Quebec City,魁北克
ottawa|渥太华|加拿大|45.42|-75.70|Ottawa
calgary|卡尔加里|加拿大|51.04|-114.07|Calgary
banff|班夫|加拿大|51.18|-115.57|Banff
mexico-city|墨西哥城|墨西哥|19.43|-99.13|Mexico City,Ciudad de México,CDMX
cancun|坎昆|墨西哥|21.16|-86.85|Cancún,Cancun
havana|哈瓦那|古巴|23.11|-82.37|Havana,La Habana
antigua-guatemala|安提瓜|危地马拉|14.56|-90.73|Antigua,Antigua Guatemala
san-jose-cr|圣何塞|哥斯达黎加|9.93|-84.08|San José,San Jose
san-jose-us|圣何塞|美国·加利福尼亚州|37.34|-121.89|San Jose,San José
panama-city|巴拿马城|巴拿马|8.98|-79.52|Panama City,Panamá
bogota|波哥大|哥伦比亚|4.71|-74.07|Bogotá,Bogota
cartagena|卡塔赫纳|哥伦比亚|10.39|-75.48|Cartagena
quito|基多|厄瓜多尔|-0.22|-78.51|Quito
lima|利马|秘鲁|-12.05|-77.04|Lima
cusco|库斯科|秘鲁|-13.52|-71.97|Cusco,Cuzco
machu-picchu|马丘比丘|秘鲁|-13.16|-72.55|Machu Picchu
la-paz|拉巴斯|玻利维亚|-16.50|-68.12|La Paz
uyuni|乌尤尼|玻利维亚|-20.46|-66.82|Uyuni,乌尤尼盐湖
rio-de-janeiro|里约热内卢|巴西|-22.91|-43.17|Rio de Janeiro,Rio,里约
sao-paulo|圣保罗|巴西|-23.55|-46.63|São Paulo,Sao Paulo
buenos-aires|布宜诺斯艾利斯|阿根廷|-34.60|-58.38|Buenos Aires
ushuaia|乌斯怀亚|阿根廷|-54.80|-68.30|Ushuaia
santiago|圣地亚哥|智利|-33.45|-70.67|Santiago
valparaiso|瓦尔帕莱索|智利|-33.05|-71.62|Valparaíso,Valparaiso
montevideo|蒙得维的亚|乌拉圭|-34.90|-56.16|Montevideo
cairo|开罗|埃及|30.04|31.24|Cairo,القاهرة
luxor|卢克索|埃及|25.69|32.64|Luxor
aswan|阿斯旺|埃及|24.09|32.90|Aswan
casablanca|卡萨布兰卡|摩洛哥|33.57|-7.59|Casablanca
marrakesh|马拉喀什|摩洛哥|31.63|-7.99|Marrakesh,Marrakech
chefchaouen|舍夫沙万|摩洛哥|35.17|-5.27|Chefchaouen
tunis|突尼斯市|突尼斯|36.80|10.18|Tunis
addis-ababa|亚的斯亚贝巴|埃塞俄比亚|8.98|38.76|Addis Ababa
nairobi|内罗毕|肯尼亚|-1.29|36.82|Nairobi
arusha|阿鲁沙|坦桑尼亚|-3.39|36.68|Arusha
zanzibar-city|桑给巴尔市|坦桑尼亚|-6.16|39.19|Zanzibar,Zanzibar City
cape-town|开普敦|南非|-33.92|18.42|Cape Town
johannesburg|约翰内斯堡|南非|-26.20|28.04|Johannesburg
windhoek|温得和克|纳米比亚|-22.56|17.08|Windhoek
accra|阿克拉|加纳|5.60|-0.19|Accra
lagos|拉各斯|尼日利亚|6.52|3.38|Lagos
dakar|达喀尔|塞内加尔|14.72|-17.47|Dakar
sydney|悉尼|澳大利亚|-33.87|151.21|Sydney
melbourne|墨尔本|澳大利亚|-37.81|144.96|Melbourne
brisbane|布里斯班|澳大利亚|-27.47|153.03|Brisbane
gold-coast|黄金海岸|澳大利亚|-28.02|153.43|Gold Coast
cairns|凯恩斯|澳大利亚|-16.92|145.77|Cairns
perth|珀斯|澳大利亚|-31.95|115.86|Perth
adelaide|阿德莱德|澳大利亚|-34.93|138.60|Adelaide
hobart|霍巴特|澳大利亚|-42.88|147.33|Hobart,Tasmania,塔斯马尼亚
auckland|奥克兰|新西兰|-36.85|174.76|Auckland
wellington|惠灵顿|新西兰|-41.29|174.78|Wellington
christchurch|基督城|新西兰|-43.53|172.64|Christchurch
queenstown|皇后镇|新西兰|-45.03|168.66|Queenstown
nadi|楠迪|斐济|-17.78|177.43|Nadi
papeete|帕皮提|法属波利尼西亚|-17.54|-149.57|Papeete,Tahiti,大溪地
`;

function normalize(value) {
  return value.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]/gu, '');
}

const cities = catalog.trim().split('\n').map((row) => {
  const [slug, name, region, lat, lon, aliases] = row.split('|');
  return {
    place: { id: `city-${slug}`, name, region, lat: Number(lat), lon: Number(lon) },
    names: [name, ...aliases.split(',')].map(normalize),
    region: normalize(region),
  };
});

function matchScore(city, query) {
  if (city.names.includes(query)) return 0;
  if (city.names.some((name) => name.startsWith(query))) return 1;
  if (city.names.some((name) => name.includes(query))) return 2;
  if (city.region.includes(query)) return 3;
  if (city.names.some((name) => (name + city.region).includes(query) || (city.region + name).includes(query))) return 4;
  return Infinity;
}

export function searchCities(value) {
  const query = normalize(value ?? '');
  if (!query) return [];

  return cities
    .map((city) => ({ place: city.place, score: matchScore(city, query) }))
    .filter(({ score }) => Number.isFinite(score))
    .sort((first, second) => first.score - second.score)
    .slice(0, 8)
    .map(({ place }) => ({ ...place }));
}

export function nearestCity({ lat, lon }, maximumKm = 30, query) {
  const candidates = query ? searchCities(query) : cities.map(({ place }) => place);
  const longitudeScale = Math.cos(lat * Math.PI / 180);
  let nearest = null;
  let shortest = maximumKm;
  for (const place of candidates) {
    const delta = ((place.lon - lon + 540) % 360) - 180;
    const distance = 111 * Math.hypot(place.lat - lat, delta * longitudeScale);
    if (distance < shortest) {
      nearest = place;
      shortest = distance;
    }
  }
  return nearest;
}
