import type { LightSource, LightType } from '../../../../types';

export interface LightingPreset {
  id: string;
  nameKo: string;
  nameEn: string;
  descriptionKo?: string;
  names?: Partial<Record<string, string>>;
  descriptions?: Partial<Record<string, string>>;
  category: 'portrait' | 'cinematic' | 'nature' | 'creative' | 'product';
  lights: Omit<LightSource, 'id'>[];
  promptHint: string;
}

type PresetLight = Omit<LightSource, 'id'>;

const d = (
  type: LightType,
  px: number, py: number,
  intensity: number,
  color: string,
  opts: Partial<Omit<LightSource, 'id' | 'type' | 'position' | 'intensity' | 'color'>> = {}
): PresetLight => ({
  type, color, intensity,
  position: { x: px, y: py },
  direction: 0,
  colorTemperature: 0,
  radius: 50,
  specularIntensity: 30,
  shadowSoftness: 50,
  affectedArea: 'full',
  atmosphericEffect: 'none',
  ...opts,
});

export const LIGHTING_PRESETS: LightingPreset[] = [
  // ── Portrait ──────────────────────────────────────────────
  {
    id: 'rembrandt',
    nameKo: '렘브란트',
    nameEn: 'Rembrandt',
    names: { ko: '렘브란트', en: 'Rembrandt', ja: 'レンブラント', 'zh-CN': '伦勃朗', 'zh-TW': '林布蘭', es: 'Rembrandt', fr: 'Rembrandt', id: 'Rembrandt' },
    descriptions: {
      ko: '뺨에 삼각형 하이라이트, 반대쪽 깊은 그림자의 드라마틱한 인물 조명',
      en: 'Rembrandt portrait lighting with triangular cheek highlight and deep shadows',
      ja: '頬の三角ハイライトと深い影のドラマチックな人物照明',
      'zh-CN': '面颊三角高光与深阴影的戏剧人像布光',
      'zh-TW': '面頰三角高光與深陰影的戲劇人像布光',
      es: 'Iluminación dramática con triángulo en mejilla y sombras profundas',
      fr: 'Éclairage portrait dramatique avec triangle sur joue et ombres profondes',
      id: 'Pencahayaan dramatis dengan segitiga pipi dan bayangan dalam',
    },
    category: 'portrait',
    lights: [
      d('direct', 0.25, 0.2, 85, '#fff5e0', { direction: 135, colorTemperature: 40, shadowSoftness: 40, specularIntensity: 50 }),
      d('omni',   0.75, 0.5, 25, '#e8f0ff', { colorTemperature: -10 }),
    ],
    promptHint: 'Rembrandt portrait lighting with triangular cheek highlight and deep shadows',
  },
  {
    id: 'butterfly',
    nameKo: '버터플라이',
    nameEn: 'Butterfly',
    names: { ko: '버터플라이', en: 'Butterfly', ja: 'バタフライ', 'zh-CN': '蝴蝶光', 'zh-TW': '蝴蝶光', es: 'Mariposa', fr: 'Papillon', id: 'Kupu-kupu' },
    descriptions: {
      ko: '정면 위에서 코 아래 나비 모양 그림자를 만드는 클래식 뷰티 조명',
      en: 'Classic butterfly lighting from directly above, creating butterfly-shaped shadow under nose',
      ja: '正面上方からの蝶形鼻下影のクラシックな美容照明',
      'zh-CN': '正面上方投射蝴蝶鼻影的经典美容布光',
      'zh-TW': '正面上方投射蝴蝶鼻影的經典美容布光',
      es: 'Iluminación clásica de belleza con sombra nasal en forma de mariposa',
      fr: 'Éclairage beauté classique avec ombre nasale en forme de papillon',
      id: 'Pencahayaan kecantikan klasik dengan bayangan hidung kupu-kupu',
    },
    category: 'portrait',
    lights: [
      d('direct', 0.5,  0.15, 90, '#ffffff', { direction: 180, shadowSoftness: 60, specularIntensity: 40 }),
      d('omni',   0.5,  0.85, 20, '#dddddd', { radius: 80 }),
    ],
    promptHint: 'Butterfly/Paramount portrait lighting with butterfly-shaped nose shadow',
  },
  {
    id: 'loop',
    nameKo: '루프',
    nameEn: 'Loop',
    names: { ko: '루프', en: 'Loop', ja: 'ループ', 'zh-CN': '环形光', 'zh-TW': '環形光', es: 'Lazo', fr: 'Boucle', id: 'Loop' },
    descriptions: {
      ko: '코 옆에 작은 루프 그림자를 만드는 자연스러운 인물 조명',
      en: 'Loop lighting with small nose loop shadow, natural everyday portrait look',
      ja: '鼻横に小さなループ影を作る自然な人物照明',
      'zh-CN': '鼻侧小环形阴影的自然人像布光',
      'zh-TW': '鼻側小環形陰影的自然人像布光',
      es: 'Iluminación natural con pequeña sombra nasal en bucle',
      fr: 'Éclairage naturel avec petite ombre nasale en boucle',
      id: 'Pencahayaan alami dengan bayangan hidung kecil berbentuk loop',
    },
    category: 'portrait',
    lights: [
      d('direct', 0.25, 0.2, 75, '#ffffff', { direction: 150, shadowSoftness: 55 }),
      d('omni',   0.75, 0.5, 30, '#cccccc', { radius: 70 }),
    ],
    promptHint: 'Loop lighting with small nose loop shadow, natural everyday portrait look',
  },
  {
    id: 'split',
    nameKo: '스플릿',
    nameEn: 'Split',
    names: { ko: '스플릿', en: 'Split', ja: 'スプリット', 'zh-CN': '分割光', 'zh-TW': '分割光', es: 'División', fr: 'Division', id: 'Split' },
    descriptions: {
      ko: '얼굴을 반으로 나누는 강렬한 측면 조명',
      en: 'Split lighting dividing the face in half, dramatic and intense character portrait',
      ja: '顔を半分に分ける強烈なサイド照明',
      'zh-CN': '将面部一分为二的强烈侧光',
      'zh-TW': '將臉部一分為二的強烈側光',
      es: 'Iluminación lateral intensa que divide el rostro a la mitad',
      fr: 'Éclairage latéral intense divisant le visage en deux',
      id: 'Pencahayaan samping intens yang membagi wajah menjadi dua',
    },
    category: 'portrait',
    lights: [
      d('direct', 0.05, 0.5, 90, '#ffffff', { direction: 90, shadowSoftness: 30, specularIntensity: 45 }),
    ],
    promptHint: 'Split lighting dividing the face in half, dramatic and intense character portrait',
  },
  {
    id: '3point_studio',
    nameKo: '3포인트 스튜디오',
    nameEn: '3-Point Studio',
    names: { ko: '3포인트 스튜디오', en: '3-Point Studio', ja: '3ポイントスタジオ', 'zh-CN': '三点布光', 'zh-TW': '三點布光', es: 'Estudio 3 Puntos', fr: 'Studio 3 Points', id: 'Studio 3 Titik' },
    descriptions: {
      ko: '주광·보조광·역광을 갖춘 전문 스튜디오 3점 조명',
      en: 'Classic 3-point studio lighting: key, fill, and back rim light for professional portrait',
      ja: 'キー・フィル・バックリムの3点スタジオ照明',
      'zh-CN': '主光、补光、逆光的专业三点布光',
      'zh-TW': '主光、補光、逆光的專業三點布光',
      es: 'Iluminación de 3 puntos: clave, relleno y contraluz profesional',
      fr: 'Éclairage studio 3 points: principal, remplissage et contre-jour',
      id: 'Pencahayaan studio 3 titik: utama, isi, dan belakang',
    },
    category: 'portrait',
    lights: [
      d('direct', 0.25, 0.2, 80, '#ffffff', { direction: 135, shadowSoftness: 50 }),
      d('omni',   0.75, 0.4, 35, '#cccccc', { radius: 75 }),
      d('rim',    0.5,  0.9, 60, '#ffffff', { radius: 40, specularIntensity: 70 }),
    ],
    promptHint: 'Classic 3-point studio lighting: key, fill, and back rim light for professional portrait',
  },

  // ── Cinematic ─────────────────────────────────────────────
  {
    id: 'cinematic_moody',
    nameKo: '무디 시네마틱',
    nameEn: 'Cinematic Moody',
    names: { ko: '무디 시네마틱', en: 'Cinematic Moody', ja: 'シネマティックムーディ', 'zh-CN': '电影暗调', 'zh-TW': '電影暗調', es: 'Cinematográfico Sombrío', fr: 'Cinématique Sombre', id: 'Sinematik Gelap' },
    descriptions: {
      ko: '강한 측면 조명과 깊은 그림자의 무거운 영화적 분위기',
      en: 'Moody cinematic single key light with deep dramatic shadows, film noir atmosphere',
      ja: '強いサイドライトと深い影の重厚な映画的雰囲気',
      'zh-CN': '强侧光与深阴影营造的电影氛围',
      'zh-TW': '強側光與深陰影營造的電影氛圍',
      es: 'Ambiente cinemático oscuro con luz lateral fuerte y sombras profundas',
      fr: 'Ambiance cinématique sombre avec lumière latérale forte et ombres profondes',
      id: 'Suasana sinematik gelap dengan cahaya samping kuat dan bayangan dalam',
    },
    category: 'cinematic',
    lights: [
      d('direct',  0.1,  0.35, 70, '#ffffff', { direction: 100, shadowSoftness: 20, specularIntensity: 55 }),
      d('ambient', 0.5,  0.5,  8,  '#111111'),
    ],
    promptHint: 'Moody cinematic single key light with deep dramatic shadows, film noir atmosphere',
  },
  {
    id: 'neon_night',
    nameKo: '네온 나이트',
    nameEn: 'Neon Night',
    names: { ko: '네온 나이트', en: 'Neon Night', ja: 'ネオンナイト', 'zh-CN': '霓虹夜景', 'zh-TW': '霓虹夜景', es: 'Noche Neón', fr: 'Nuit Néon', id: 'Malam Neon' },
    descriptions: {
      ko: '마젠타와 시안의 이중 색상 네온 야경 조명',
      en: 'Cyberpunk neon night with contrasting magenta and cyan dual-color lighting',
      ja: 'マゼンタとシアンのデュアルカラーネオン夜景照明',
      'zh-CN': '品红与青色双色霓虹夜景照明',
      'zh-TW': '品紅與青色雙色霓虹夜景照明',
      es: 'Iluminación neón nocturna con magenta y cian contrastantes',
      fr: 'Éclairage néon nocturne avec magenta et cyan contrastants',
      id: 'Pencahayaan neon malam dengan magenta dan sian kontras',
    },
    category: 'cinematic',
    lights: [
      d('omni', 0.1,  0.5, 70, '#ff00ff', { colorTemperature: -60, radius: 40 }),
      d('omni', 0.9,  0.5, 70, '#00ffff', { colorTemperature: -80, radius: 40 }),
    ],
    promptHint: 'Cyberpunk neon night with contrasting magenta and cyan dual-color lighting',
  },
  {
    id: 'golden_hour',
    nameKo: '골든아워',
    nameEn: 'Golden Hour',
    names: { ko: '골든아워', en: 'Golden Hour', ja: 'ゴールデンアワー', 'zh-CN': '黄金时段', 'zh-TW': '黃金時段', es: 'Hora Dorada', fr: 'Heure Dorée', id: 'Jam Emas' },
    descriptions: {
      ko: '따뜻한 주황빛의 황금 시간대 일몰 조명',
      en: 'Golden hour warm sunset side light with rich orange tones and long soft shadows',
      ja: '温かいオレンジ色のゴールデンアワー夕日照明',
      'zh-CN': '暖橙色黄金时段落日照明',
      'zh-TW': '暖橙色黃金時段落日照明',
      es: 'Iluminación de atardecer cálido con tonos naranja y sombras suaves',
      fr: 'Éclairage coucher de soleil chaud avec tons orangés et longues ombres douces',
      id: 'Pencahayaan matahari terbenam hangat dengan nada oranye dan bayangan panjang',
    },
    category: 'cinematic',
    lights: [
      d('sun',    0.05, 0.75, 80, '#ff9a3c', { direction: 90, colorTemperature: 80, shadowSoftness: 45 }),
      d('ambient', 0.5,  0.5, 20, '#1a0a00', { colorTemperature: 40 }),
    ],
    promptHint: 'Golden hour warm sunset side light with rich orange tones and long soft shadows',
  },
  {
    id: 'blue_hour',
    nameKo: '블루아워',
    nameEn: 'Blue Hour',
    names: { ko: '블루아워', en: 'Blue Hour', ja: 'ブルーアワー', 'zh-CN': '蓝调时分', 'zh-TW': '藍調時分', es: 'Hora Azul', fr: 'Heure Bleue', id: 'Jam Biru' },
    descriptions: {
      ko: '청량한 블루 아워 분위기에 작은 웜 포인트 조명',
      en: 'Blue hour twilight with deep blue ambient and warm artificial light accent',
      ja: '爽やかなブルーアワー雰囲気に小さなウォームポイント照明',
      'zh-CN': '清爽蓝调氛围加小暖光点缀',
      'zh-TW': '清爽藍調氛圍加小暖光點綴',
      es: 'Ambiente azul fresco con pequeño punto de luz cálida',
      fr: 'Ambiance bleue fraîche du crépuscule avec petit point de lumière chaude',
      id: 'Suasana biru segar senja dengan titik cahaya hangat kecil',
    },
    category: 'cinematic',
    lights: [
      d('ambient', 0.5,  0.5,  40, '#1a2a4a', { colorTemperature: -60 }),
      d('omni',    0.8,  0.25, 30, '#ffd080', { colorTemperature: 30, radius: 35 }),
    ],
    promptHint: 'Blue hour twilight with deep blue ambient and warm artificial light accent',
  },

  // ── Nature ────────────────────────────────────────────────
  {
    id: 'overcast',
    nameKo: '흐린 날',
    nameEn: 'Overcast',
    names: { ko: '흐린 날', en: 'Overcast', ja: '曇り空', 'zh-CN': '阴天', 'zh-TW': '陰天', es: 'Nublado', fr: 'Couvert', id: 'Mendung' },
    descriptions: {
      ko: '구름 낀 하늘의 부드럽고 균일한 자연광 조명',
      en: 'Overcast cloudy day with soft even diffused light and minimal shadows',
      ja: '曇り空の柔らかく均一な自然光照明',
      'zh-CN': '阴天柔和均匀的自然光',
      'zh-TW': '陰天柔和均勻的自然光',
      es: 'Luz natural suave y uniforme de día nublado con sombras mínimas',
      fr: 'Lumière naturelle douce et uniforme par temps couvert avec ombres minimales',
      id: 'Cahaya alami lembut merata saat mendung dengan bayangan minimal',
    },
    category: 'nature',
    lights: [
      d('ambient', 0.5,  0.5,  60, '#c8d4e0', { colorTemperature: -20 }),
      d('direct',  0.5,  0.05, 30, '#e0e8f0', { direction: 180, shadowSoftness: 90, radius: 85 }),
    ],
    promptHint: 'Overcast cloudy day with soft even diffused light and minimal shadows',
  },
  {
    id: 'harsh_sunlight',
    nameKo: '강한 직사광',
    nameEn: 'Harsh Sunlight',
    names: { ko: '강한 직사광', en: 'Harsh Sunlight', ja: '強烈な直射光', 'zh-CN': '强烈直射光', 'zh-TW': '強烈直射光', es: 'Luz Solar Intensa', fr: 'Soleil Intense', id: 'Terik Matahari' },
    descriptions: {
      ko: '강렬한 직사광선의 강한 명암 대비 조명',
      en: 'Harsh midday direct sunlight with sharp hard shadows and strong highlights',
      ja: '強烈な直射日光による強いコントラスト照明',
      'zh-CN': '强烈直射阳光的高对比度照明',
      'zh-TW': '強烈直射陽光的高對比度照明',
      es: 'Luz solar directa intensa de mediodía con sombras duras y fuertes luces',
      fr: 'Lumière solaire directe intense de midi avec ombres dures et forts reflets',
      id: 'Sinar matahari langsung terik siang hari dengan bayangan keras dan sorotan kuat',
    },
    category: 'nature',
    lights: [
      d('sun', 0.5, 0.0, 100, '#fffae0', { direction: 180, colorTemperature: 30, shadowSoftness: 10, specularIntensity: 70 }),
    ],
    promptHint: 'Harsh midday direct sunlight with sharp hard shadows and strong highlights',
  },
  {
    id: 'window_soft',
    nameKo: '창문 소프트라이트',
    nameEn: 'Window Soft Light',
    names: { ko: '창문 소프트라이트', en: 'Window Soft Light', ja: '窓の柔らかい光', 'zh-CN': '窗户柔光', 'zh-TW': '窗戶柔光', es: 'Luz Suave de Ventana', fr: 'Lumière Douce de Fenêtre', id: 'Cahaya Lembut Jendela' },
    descriptions: {
      ko: '창문으로 들어오는 부드러운 면광원 조명',
      en: 'Soft natural window light from the side with gentle wrap-around fill',
      ja: '窓から差し込む柔らかい面光源照明',
      'zh-CN': '从窗户透入的柔和面光源',
      'zh-TW': '從窗戶透入的柔和面光源',
      es: 'Luz suave de ventana lateral con relleno envolvente suave',
      fr: 'Lumière douce de fenêtre latérale avec remplissage enveloppant doux',
      id: 'Cahaya jendela alami lembut dari samping dengan isi melingkar',
    },
    category: 'nature',
    lights: [
      d('area', 0.0, 0.4, 70, '#f0f4ff', { radius: 80, colorTemperature: -10, shadowSoftness: 75 }),
      d('omni', 0.9, 0.5, 15, '#fffff0', { radius: 85 }),
    ],
    promptHint: 'Soft natural window light from the side with gentle wrap-around fill',
  },

  // ── Creative ──────────────────────────────────────────────
  {
    id: 'rim_dramatic',
    nameKo: '드라마틱 림',
    nameEn: 'Dramatic Rim',
    names: { ko: '드라마틱 림', en: 'Dramatic Rim', ja: 'ドラマチックリム', 'zh-CN': '戏剧轮廓光', 'zh-TW': '戲劇輪廓光', es: 'Contraluz Dramático', fr: 'Contour Dramatique', id: 'Rim Dramatis' },
    descriptions: {
      ko: '피사체 윤곽을 강조하는 강렬한 역광 테두리 조명',
      en: 'Dramatic rim backlight with strong edge glow separating subject from dark background',
      ja: '被写体の輪郭を強調するドラマチックなリムライト',
      'zh-CN': '强调轮廓的戏剧性逆光边缘光',
      'zh-TW': '強調輪廓的戲劇性逆光邊緣光',
      es: 'Luz de contorno dramática que resalta silueta separándola del fondo oscuro',
      fr: 'Lumière de contour dramatique avec fort halo de bord séparant le sujet du fond',
      id: 'Cahaya tepi dramatis yang menonjolkan siluet dari latar belakang gelap',
    },
    category: 'creative',
    lights: [
      d('rim',    0.5,  1.0, 90, '#ffffff', { radius: 40, specularIntensity: 75 }),
      d('ambient', 0.5, 0.5,  8, '#000000'),
    ],
    promptHint: 'Dramatic rim backlight with strong edge glow separating subject from dark background',
  },
  {
    id: 'god_rays',
    nameKo: '갓레이',
    nameEn: 'God Rays',
    names: { ko: '갓레이', en: 'God Rays', ja: 'ゴッドレイ', 'zh-CN': '神光', 'zh-TW': '神光', es: 'Rayos Divinos', fr: 'Rayons Divins', id: 'Sinar Tuhan' },
    descriptions: {
      ko: '하늘에서 쏟아지는 신성한 빛줄기 대기 효과 조명',
      en: 'Divine god rays volumetric light beams penetrating from above with atmospheric haze',
      ja: '空から降り注ぐ神聖な光線と大気効果照明',
      'zh-CN': '从天而降的神圣光束与大气效果',
      'zh-TW': '從天而降的神聖光束與大氣效果',
      es: 'Rayos divinos con haces de luz volumétrica y neblina atmosférica',
      fr: 'Rayons divins volumétriques pénétrant d\'en haut avec brume atmosphérique',
      id: 'Sinar tuhan volumetrik dari langit dengan kabut atmosfer',
    },
    category: 'creative',
    lights: [
      d('sun', 0.5, 0.0, 85, '#ffe0a0', { direction: 180, colorTemperature: 50, atmosphericEffect: 'god_rays', shadowSoftness: 55 }),
    ],
    promptHint: 'Divine god rays volumetric light beams penetrating from above with atmospheric haze',
  },
  {
    id: 'horror_under',
    nameKo: '호러 언더라이트',
    nameEn: 'Horror Under Light',
    names: { ko: '호러 언더라이트', en: 'Horror Under Light', ja: 'ホラーアンダーライト', 'zh-CN': '恐怖底光', 'zh-TW': '恐怖底光', es: 'Luz Inferior Terror', fr: 'Éclairage Horreur', id: 'Lampu Horor Bawah' },
    descriptions: {
      ko: '아래에서 비추는 공포스러운 초록빛 업라이트 조명',
      en: 'Horror under-lighting from below casting unnatural shadows upward for eerie effect',
      ja: '下から照らす不気味な緑色アップライト照明',
      'zh-CN': '从下方照射的恐怖绿光上照灯',
      'zh-TW': '從下方照射的恐怖綠光上照燈',
      es: 'Iluminación inferior aterradora en verde que proyecta sombras antinaturales hacia arriba',
      fr: 'Éclairage vert effrayant par le bas projetant des ombres vers le haut',
      id: 'Lampu bawah hijau menyeramkan yang memproyeksikan bayangan ke atas',
    },
    category: 'creative',
    lights: [
      d('omni', 0.5, 0.95, 80, '#00ff40', { colorTemperature: -80, shadowSoftness: 15, specularIntensity: 60 }),
    ],
    promptHint: 'Horror under-lighting from below casting unnatural shadows upward for eerie effect',
  },

  // ── Product ───────────────────────────────────────────────
  {
    id: 'studio_white',
    nameKo: '스튜디오 화이트',
    nameEn: 'Studio White',
    names: { ko: '스튜디오 화이트', en: 'Studio White', ja: 'スタジオホワイト', 'zh-CN': '白色棚拍', 'zh-TW': '白色棚拍', es: 'Estudio Blanco', fr: 'Studio Blanc', id: 'Studio Putih' },
    descriptions: {
      ko: '하이키 스튜디오의 밝고 균일한 상품 촬영 조명',
      en: 'Professional white studio product photography with even soft 3-point lighting and minimal shadows',
      ja: 'ハイキースタジオの明るく均一な商品撮影照明',
      'zh-CN': '高调棚拍的明亮均匀商品照明',
      'zh-TW': '高調棚拍的明亮均勻商品照明',
      es: 'Iluminación de estudio alta clave para fotografía de producto con mínimas sombras',
      fr: 'Éclairage studio high-key uniforme pour photographie de produit avec ombres minimales',
      id: 'Pencahayaan studio high-key terang merata untuk fotografi produk',
    },
    category: 'product',
    lights: [
      d('area',  0.15, 0.2, 80, '#ffffff', { radius: 90, shadowSoftness: 80 }),
      d('area',  0.85, 0.4, 50, '#ffffff', { radius: 90, shadowSoftness: 85 }),
      d('omni',  0.5,  0.0, 40, '#ffffff', { radius: 70 }),
    ],
    promptHint: 'Professional white studio product photography with even soft 3-point lighting and minimal shadows',
  },
  {
    id: 'product_dramatic',
    nameKo: '프로덕트 드라마틱',
    nameEn: 'Product Dramatic',
    names: { ko: '프로덕트 드라마틱', en: 'Product Dramatic', ja: 'プロダクトドラマチック', 'zh-CN': '产品戏剧光', 'zh-TW': '產品戲劇光', es: 'Producto Dramático', fr: 'Produit Dramatique', id: 'Produk Dramatis' },
    descriptions: {
      ko: '강한 측면 조명과 림라이트의 드라마틱한 상품 조명',
      en: 'Dramatic premium product lighting with strong side key, rim highlight, and dark atmosphere',
      ja: '強いサイドライトとリムライトのドラマチックな商品照明',
      'zh-CN': '强侧光与轮廓光的戏剧性商品照明',
      'zh-TW': '強側光與輪廓光的戲劇性商品照明',
      es: 'Iluminación dramática de producto con lateral fuerte y contraluz',
      fr: 'Éclairage produit dramatique avec lumière latérale forte et contre-jour',
      id: 'Pencahayaan produk dramatis dengan samping kuat dan rim',
    },
    category: 'product',
    lights: [
      d('direct',  0.05, 0.3,  90, '#ffffff', { direction: 100, shadowSoftness: 20, specularIntensity: 70 }),
      d('rim',     0.95, 0.7,  75, '#ffffff', { radius: 35, specularIntensity: 80 }),
      d('ambient', 0.5,  0.5,  10, '#0a0a0a'),
    ],
    promptHint: 'Dramatic premium product lighting with strong side key, rim highlight, and dark atmosphere',
  },
];

export const PRESET_CATEGORIES = ['portrait', 'cinematic', 'nature', 'creative', 'product'] as const;
export type PresetCategory = typeof PRESET_CATEGORIES[number];
