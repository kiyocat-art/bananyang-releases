/* ─────────────────────────────────────────────────────────────────────────────
   BanaNyang — Internationalisation
   Supported locales: Korean (ko) · English (en) · Japanese (ja)
   ───────────────────────────────────────────────────────────────────────────── */

export type Locale = 'ko' | 'en' | 'ja' | 'id' | 'es' | 'fr';

export interface Translations {
  nav: {
    download: string;
    features: string;
    backHome: string;
    pricing: string;
    changelog: string;
  };
  hero: {
    title: string;
    subtitle: string;
    tagline: string;
    downloadWindows: string;
    downloadMac: string;
    price: string;
    priceBadgeDesc: string;
    buyNow: string;
    pricingTagline: string;
    pricingDesc: string;
    pricingFeatures: string;
  };
  intro: {
    label: string;
    headline: string;
    byok: { title: string; desc: string };
    canvas: { title: string; desc: string };
    desktop: { title: string; desc: string };
  };
  features: {
    title: string;
    subtitle: string;
    canvas: { title: string; desc: string };
    aiGen: { title: string; desc: string };
    reference: { title: string; desc: string };
    smartTools: { title: string; desc: string };
    noCostAi: { title: string; desc: string };
    lightingControl: { title: string; tagline: string; desc: string };
    partsCompositing: { title: string; tagline: string; desc: string };
  };
  tools: {
    title: string;
    subtitle: string;
    autoColoring: { title: string; name: string; tagline: string; desc: string };
    variation: { title: string; name: string; tagline: string; desc: string };
    pose: { title: string; name: string; tagline: string; desc: string };
    outfit: { title: string; name: string; tagline: string; desc: string };
  };
  download: {
    title: string;
    subtitle: string;
    version: string;
    released: string;
    windows: { label: string; req: string };
    mac: { label: string; req: string };
    sysReq: string;
    requirements: {
      os: string;
      ram: string;
      gpu: string;
      storage: string;
      windowsVal: string;
      macVal: string;
      ramVal: string;
      gpuVal: string;
      storageVal: string;
    };
    gate: {
      title: string;
      subtitle: string;
      buy: string;
      buyNote: string;
      alreadyBought: string;
      enterKey: string;
      keyPlaceholder: string;
      keySubmit: string;
      keyError: string;
      unlocked: string;
      unlockedNote: string;
      apiKeyNotice: string;
    };
    changelog: string;
    changelogItems: string[];
  };
  footer: {
    copyright: string;
    tos: string;
    privacy: string;
    contact: string;
  };
  auth: {
    login: string;
    signup: string;
    logout: string;
    myAccount: string;
    email: string;
    password: string;
    name: string;
    continueWithGoogle: string;
    or: string;
    forgotPassword: string;
    alreadyHaveAccount: string;
    noAccount: string;
    resetEmailSent: string;
    verificationEmailSent: string;
    errors: {
      email_in_use: string;
      wrong_password: string;
      user_not_found: string;
      weak_password: string;
      invalid_email: string;
      unauthorized_domain: string;
      popup_blocked: string;
      network_error: string;
      config_error: string;
      unknown: string;
    };
  };
  account: {
    title: string;
    greeting: string;
    purchaseHistory: string;
    noPurchases: string;
    invoice: string;
    licenseKey: string;
    copyKey: string;
    keyCopied: string;
    profile: string;
    saveChanges: string;
    saved: string;
    deviceChangeNotice: string;
    loading: string;
    loginRequired: string;
  };
  contact: {
    title: string;
    subtitle: string;
    name: string;
    email: string;
    message: string;
    messagePlaceholder: string;
    submit: string;
    success: string;
    successDetail: string;
    directEmail: string;
  };
  legal: {
    lastUpdated: string;
  };
  comingSoon: {
    badge: string;
    cardTitle: string;
    cardBody: string;
    macOptimizing: string;
    notifyMe: string;
    notifyPlaceholder: string;
    notifySuccess: string;
    notifyAlready: string;
    notifyError: string;
    notifyServerError: string;
    notifyRateLimited: string;
    availableAtLaunch: string;
    tooltip: string;
  };
  featuresPage: {
    title: string;
    subtitle: string;
  };
  changelog: {
    title: string;
    subtitle: string;
    empty: string;
    emptyDesc: string;
    viewDetail: string;
    close: string;
  };
  pricing: {
    title: string;
    lifetimeDesc: string;
    notice: { title: string; body: string };
    apiPricingTitle: string;
    apiPricingSubtitle: string;
    providers: { google: string; openai: string; flux: string };
    table: { model: string; resolution: string; quality: string; pricePerImage: string };
    footnote: { gemini: string; openai: string; flux: string };
  };
}

/* ─── Korean ─── */
const ko: Translations = {
  nav: {
    download: '다운로드',
    features: '기능',
    backHome: '홈으로',
    pricing: '가격',
    changelog: '패치노트',
  },
  hero: {
    title: '무한 캔버스, 그 위에서\n모든 영감이 연결됩니다.',
    subtitle: '수백 장의 레퍼런스를 무한한 캔버스에 펼쳐보세요. 이미지 자료를 수집 관리하고, 편집하고, AI로 진화시켜 당신만의 압도적인 세계관을 시각화하세요.',
    tagline: '우리는 2D/3D 아티스트를 위한 가장 자유로운 AI 워크스페이스 공간만을 제공합니다.',
    downloadWindows: 'Windows 다운로드',
    downloadMac: 'Mac 다운로드',
    price: '1회 구매 · $19.99 USD · 구독 없음',
    priceBadgeDesc: 'AI 생성에는 개인 Google API 키 또는 Google Vertex AI 계정이 필요합니다',
    buyNow: 'Buy Now — $19.99',
    pricingTagline: '단 한 번의 결제. 평생 소장.',
    pricingDesc: '지긋지긋한 월 구독료는 없습니다. 점심 한 끼 가격으로 매일 반복되는 레퍼런스 수집과 시트 작업 시간을 획기적으로 단축하세요.',
    pricingFeatures: '✔ 무제한 캔버스 | ✔ 로컬 기반 처리 | ✔ 추가 결제 없음',
  },
  intro: {
    label: 'Why BanaNyang',
    headline: '왜 BanaNyang인가',
    byok: {
      title: '중간 수수료 없이 사용한 만큼만',
      desc: 'Gemini, OpenAI, Flux 등 원하는 AI 모델의 API 키를 직접 연결하세요. 월 구독료나 중간 수수료 없이, 생성한 결과에 대해서만 모델의 정가를 지불합니다.',
    },
    canvas: {
      title: '전문가 편집 + 무한 캔버스',
      desc: '진정으로 무한한 캔버스 위에 아이디어를 자유롭게 펼치세요. 복잡함 없이 전문가 수준의 디테일한 이미지 생성·편집 기능을 제공합니다.',
    },
    desktop: {
      title: '데스크톱 우선, 로컬 제어',
      desc: '웹앱 로딩과 매번 로그인이 필요 없습니다. 네이티브 데스크톱 앱으로 로컬 파일을 관리하고 이미지를 빠르고 직관적으로 정리하세요.',
    },
  },
  features: {
    title: 'Why BanaNyang?',
    subtitle: '하나의 캔버스에서 아이디어를 탐색하고, AI로 확장하세요.',
    canvas: {
      title: 'Infinite Canvas',
      desc: '제한 없는 무한 캔버스 위에 수백 장의 이미지를 자유롭게 배치하고 탐색하세요. 확대, 축소, 이동이 완벽하게 매끄럽습니다.',
    },
    aiGen: {
      title: 'AI Generation',
      desc: '캔버스 위의 레퍼런스에서 영감을 받아 즉시 새로운 컨셉 아트를 생성합니다. 의상 추출, 포즈 변형, 자동 채색까지.',
    },
    reference: {
      title: 'Reference Board',
      desc: '웹 이미지, 포토샵 작업 중인 이미지를 클립보드 붙여넣기 또는 드래그 앤 드롭으로 즉시 수집. 캔버스 위에서 바로 AI 생성에 활용하세요.',
    },
    smartTools: {
      title: 'Smart Tools',
      desc: '배경 제거, 자동 채색, 의상 추출, 디자인 베리에이션 등 아티스트를 위한 AI 툴을 하나의 워크스페이스에서.',
    },
    noCostAi: {
      title: '구독 없는 AI',
      desc: '월 구독료 없이 내 Google 개인 계정으로 바로 사용. 보안이 필요한 작업에는 Vertex AI 계정 연결도 지원하여 기업 환경에서도 안심.',
    },
    lightingControl: {
      title: 'Lighting Control',
      tagline: '조명 방향, 강도, 색온도를 캔버스 위에서 직접 제어하세요.',
      desc: '조명 방향과 강도, 색온도를 독립적으로 조절하여 원하는 무드를 정밀하게 연출합니다. 그림자 각도를 바꿔 극적인 깊이감을 더하거나, 색온도를 따뜻하게·차갑게 조정해 감정적 톤을 잡을 수 있습니다. 키 라이트와 필 라이트의 강도를 각각 설정하고, 캐릭터와 배경에 독립적인 조명 레이어를 적용하세요. 스튜디오 세팅부터 게임 인게임 라이팅까지, 모든 파라미터를 캔버스 위에서 직접 제어할 수 있습니다.',
    },
    partsCompositing: {
      title: '파츠별 합성 제어',
      tagline: '인체 파츠를 독립적으로 선택하여 원하는 부위만 정밀하게 재생성하세요.',
      desc: '얼굴, 상체, 하체, 손, 발 등 인체 부위를 독립적으로 지정해 원하는 파츠만 재생성할 수 있습니다. 컨셉 탭에서 수정할 부위를 선택하면 나머지 캐릭터는 그대로 유지되며, 픽셀 단위 마스크가 생성 영역과 원본 경계를 자연스럽게 연결합니다. 갑옷 세부 디테일 수정, 표정 변경, 의상 컴포넌트 교체 등 전체 일러스트를 건드리지 않고 필요한 부분만 정밀하게 반복 수정할 수 있습니다.',
    },
  },
  tools: {
    title: 'AI Generation Tools',
    subtitle: '현업 아티스트의 워크플로우에 맞춰 설계된 4가지 AI 생성 도구.\n캔버스 위에서 바로 실행하세요.',
    autoColoring: {
      title: '자동 채색',
      name: 'Auto Coloring',
      tagline: '선화를 올리면, AI가 자동으로 채색합니다.',
      desc: '컨셉 아트 초기 단계에서 가장 시간이 많이 드는 작업 중 하나가 러프 채색입니다. 자동 채색은 선화(line art)를 업로드하면 AI가 캐릭터의 머리카락, 피부, 의상 영역을 인식하여 자연스러운 색감으로 채색합니다. 러프 스케치 위에 빠르게 컬러 무드를 잡을 때 유용하며, 강도 슬라이더로 채색 정도를 조절할 수 있어 완전 자동부터 가이드 수준까지 선택 가능합니다.',
    },
    variation: {
      title: '디자인 베리에이션',
      name: 'Design Variation',
      tagline: '하나의 디자인에서 수십 가지 변형을 탐색하세요.',
      desc: '캐릭터 디자인을 확정하기 전, 다양한 방향성을 빠르게 탐색하는 것은 필수적입니다. 기존 이미지를 기반으로 구도, 색상, 디테일을 변형한 여러 버전을 한 번에 생성합니다. 갑옷의 형태를 바꾸거나, 컬러 팔레트를 시도하거나, 소품 배치를 달리할 때 일일이 그리지 않고 AI가 제안하는 가능성을 캔버스 위에 펼쳐 비교할 수 있습니다.',
    },
    pose: {
      title: '포즈 추출',
      name: 'Pose Extraction',
      tagline: '레퍼런스에서 포즈만 분리하여 새로운 캐릭터에 적용합니다.',
      desc: '3D 없이도 원하는 포즈를 정확하게 재현할 수 있습니다. 캔버스에 올린 레퍼런스 이미지에서 인체의 관절 구조를 자동으로 인식하여 스틱맨(골격도)을 추출하고, 이를 기반으로 완전히 다른 캐릭터가 동일한 포즈를 취한 새로운 이미지를 생성합니다. 액션 씬이나 역동적인 포즈가 필요한 일러스트레이션 작업에서 참고 사진의 포즈를 그대로 활용하되, 캐릭터 디자인은 자유롭게 바꾸고 싶을 때 사용합니다.',
    },
    outfit: {
      title: '의상 추출',
      name: 'Outfit Extraction',
      tagline: '캐릭터의 의상만 분리하여 다른 캐릭터에 입혀보세요.',
      desc: '판타지, 게임 캐릭터 디자인에서 의상은 캐릭터의 정체성을 결정짓는 핵심 요소입니다. 레퍼런스 이미지에서 의상(갑옷, 드레스, 유니폼 등)의 형태와 디테일을 분리·추출하고, 이를 다른 체형이나 포즈의 캐릭터에 자연스럽게 합성합니다. "이 캐릭터에 저 의상을 입히면 어떨까?"라는 질문에 30초 안에 답을 얻을 수 있어, 의상 디자인 이터레이션 속도가 비약적으로 빨라집니다.',
    },
  },
  download: {
    title: 'BanaNyang 다운로드',
    subtitle: '한 번 구매, 구독 없이 사용',
    version: '버전',
    released: '출시일',
    windows: { label: 'Windows 다운로드 (.exe)', req: 'Windows 10 64-bit 이상' },
    mac: { label: 'Mac 다운로드 (.dmg)', req: 'macOS 12 Monterey 이상' },
    sysReq: '시스템 요구사항',
    requirements: {
      os: '운영체제',
      ram: '메모리',
      gpu: 'GPU',
      storage: '저장공간',
      windowsVal: 'Windows 10 64-bit 이상',
      macVal: 'macOS 12 Monterey 이상',
      ramVal: '8GB RAM 이상 (16GB 권장)',
      gpuVal: 'DirectX 11 / Metal 호환 GPU',
      storageVal: '1GB 이상 여유공간',
    },
    gate: {
      title: '캔버스가 잠겨있습니다',
      subtitle: '구매 후 즉시 다운로드하고 모든 기능을 잠금 해제하세요.',
      buy: 'BanaNyang 구매하기 — $19.99',
      buyNote: '1회 구매 · 구독 없음',
      alreadyBought: '이미 구매하셨나요?',
      enterKey: '라이선스 키 입력',
      keyPlaceholder: 'XXXX-XXXX-XXXX-XXXX',
      keySubmit: '확인',
      keyError: '유효하지 않은 라이선스 키입니다.',
      unlocked: '잠금 해제되었습니다',
      unlockedNote: '다운로드 링크가 활성화되었습니다.',
      apiKeyNotice: 'AI 생성 기능을 사용하려면 개인 Google API 키 또는 Google Vertex AI 계정이 필요합니다. 앱 구매만으로는 AI 생성이 제공되지 않습니다.',
    },
    changelog: '변경 사항',
    changelogItems: [
      '무한 캔버스 성능 대폭 개선 (200+ 이미지)',
      '4K 생성 안정성 향상',
      'WebGL 렌더링 최적화',
      '자동 채색 정확도 개선',
      '포즈 추출 속도 2배 향상',
    ],
  },
  footer: {
    copyright: '© 2025 BanaNyang',
    tos: 'Terms of Service',
    privacy: 'Privacy Policy',
    contact: 'Contact',
  },
  auth: {
    login: '로그인',
    signup: '회원가입',
    logout: '로그아웃',
    myAccount: '내 계정',
    email: '이메일',
    password: '비밀번호',
    name: '이름',
    continueWithGoogle: 'Google로 계속하기',
    or: '또는',
    forgotPassword: '비밀번호를 잊으셨나요?',
    alreadyHaveAccount: '이미 계정이 있으신가요?',
    noAccount: '계정이 없으신가요?',
    resetEmailSent: '비밀번호 재설정 이메일을 발송했습니다.',
    verificationEmailSent: '인증 이메일을 발송했습니다. 메일함을 확인해주세요.',
    errors: {
      email_in_use: '이미 사용 중인 이메일입니다.',
      wrong_password: '이메일 또는 비밀번호가 올바르지 않습니다.',
      user_not_found: '존재하지 않는 계정입니다.',
      weak_password: '비밀번호는 6자 이상이어야 합니다.',
      invalid_email: '올바른 이메일 형식이 아닙니다.',
      unauthorized_domain: 'Google 로그인이 이 도메인에서 허용되지 않았습니다. 관리자에게 문의해주세요.',
      popup_blocked: '브라우저가 팝업을 차단했습니다. 팝업 차단을 해제 후 다시 시도해주세요.',
      network_error: '네트워크 오류입니다. 인터넷 연결을 확인하고 다시 시도해주세요.',
      config_error: '로그인 설정에 문제가 있습니다. 관리자에게 문의해주세요.',
      unknown: '오류가 발생했습니다. 다시 시도해주세요.',
    },
  },
  account: {
    title: '내 계정',
    greeting: '안녕하세요',
    purchaseHistory: '구매 이력',
    noPurchases: '구매 이력이 없습니다.',
    invoice: '인보이스 PDF',
    licenseKey: '라이선스 키',
    copyKey: '복사',
    keyCopied: '복사됨!',
    profile: '계정 정보',
    saveChanges: '저장',
    saved: '저장됨',
    deviceChangeNotice: '기기를 변경하셨나요? 라이선스 키로 다운로드 페이지에서 재활성화할 수 있습니다.',
    loading: '불러오는 중...',
    loginRequired: '로그인이 필요한 페이지입니다.',
  },
  contact: {
    title: '문의하기',
    subtitle: '질문, 제안, 협업 문의를 보내주세요. 빠른 시일 내에 답변 드리겠습니다.',
    name: '이름',
    email: '이메일',
    message: '문의 내용',
    messagePlaceholder: '문의 내용을 입력하세요...',
    submit: '보내기',
    success: '메일 클라이언트가 열렸습니다!',
    successDetail: '이메일을 전송하시면 빠른 시일 내에 답변 드리겠습니다.',
    directEmail: '직접 이메일 보내기',
  },
  legal: {
    lastUpdated: '최종 업데이트',
  },
  comingSoon: {
    badge: '곧 출시',
    cardTitle: '바나냥 다운로드',
    cardBody: '마지막 다듬는 중입니다. 곧 출시됩니다.',
    macOptimizing: 'macOS 최적화 중',
    notifyMe: '알림 받기',
    notifyPlaceholder: 'your@email.com',
    notifySuccess: '✓ 출시되면 알려드릴게요.',
    notifyAlready: '✓ 이미 등록되어 있어요. 출시 시 알림 드릴게요.',
    notifyError: '올바른 이메일을 입력해주세요.',
    notifyServerError: '오류가 발생했습니다. 다시 시도해주세요.',
    notifyRateLimited: '잠시 후 다시 시도해주세요.',
    availableAtLaunch: '출시일에 만나요',
    tooltip: '곧 만나요',
  },
  featuresPage: {
    title: '기능 및 툴',
    subtitle: 'BanaNyang이 제공하는 AI 워크플로우',
  },
  changelog: {
    title: '패치노트',
    subtitle: 'BanaNyang 업데이트 내역',
    empty: '곧 업데이트 예정',
    emptyDesc: '첫 번째 패치노트가 곧 공개됩니다.',
    viewDetail: '자세히 보기',
    close: '닫기',
  },
  pricing: {
    title: '가격',
    lifetimeDesc: '지긋지긋한 소프트웨어 월 구독료는 없습니다. 단 한 번의 구매로 BanaNyang의 강력한 무한 캔버스 워크스페이스를 영구 소장하세요.',
    notice: {
      title: '💡 AI 생성 기능 이용 안내',
      body: 'BanaNyang은 최상의 퀄리티를 위해 다양한 글로벌 AI 모델을 직접 연동하는 방식을 채택했습니다. 이미지 생성 기능은 사용하시는 각 AI 플랫폼(OpenAI, FLUX 등)에서 발급받은 개인/기업용 API 키를 등록하여 사용하며, 모델 사용에 따른 API 호출 비용은 해당 플랫폼의 정책에 따라 별도로 청구됩니다. (Vertex AI는 소속 기업의 계정을 통해 연동 가능합니다.)',
    },
    apiPricingTitle: 'AI 모델 API 가격',
    apiPricingSubtitle: '공급자별 이미지 1장당 가격',
    providers: { google: 'Google', openai: 'OpenAI', flux: 'Flux' },
    table: { model: '모델', resolution: '해상도', quality: '품질', pricePerImage: '이미지당 가격' },
    footnote: {
      gemini: '출처: Google AI for Developers / Vertex AI Pricing',
      openai: '출처: OpenAI Pricing',
      flux: '출처: BFL Pricing — $0.07/MP',
    },
  },
};

/* ─── English ─── */
const en: Translations = {
  nav: {
    download: 'Download',
    features: 'Features',
    backHome: 'Back to Home',
    pricing: 'Pricing',
    changelog: 'Changelog',
  },
  hero: {
    title: 'Infinite Canvas,\nWhere Every Inspiration Connects.',
    subtitle: 'Lay out hundreds of references on an infinite canvas. Collect, manage, and edit your visual assets — then evolve them with AI to visualize your own overwhelming world.',
    tagline: 'We provide the most flexible AI workspace exclusively for 2D/3D artists.',
    downloadWindows: 'Download for Windows',
    downloadMac: 'Download for Mac',
    price: 'One-time purchase · $19.99 USD · No subscription',
    priceBadgeDesc: 'AI generation requires your own Google API key or Google Vertex AI account',
    buyNow: 'Buy Now — $19.99',
    pricingTagline: 'One payment. Yours forever.',
    pricingDesc: 'No more monthly subscription fees. For the price of one lunch, dramatically cut the time you spend on daily reference gathering and sheet work.',
    pricingFeatures: '✔ Unlimited Canvas | ✔ Local Processing | ✔ No Extra Charges',
  },
  intro: {
    label: 'Why BanaNyang',
    headline: 'Built for working artists',
    byok: {
      title: 'Pay only for what you use',
      desc: 'Connect your own API keys for Gemini, OpenAI, Flux, and more. No monthly subscriptions, no middleman fees — pay the model providers directly for what you generate.',
    },
    canvas: {
      title: 'Pro editing on an infinite canvas',
      desc: 'Spread ideas freely on a truly infinite canvas. Get professional-grade image generation and editing without the complexity.',
    },
    desktop: {
      title: 'Desktop-first, fully local',
      desc: 'No web app to load, no constant logins. A native desktop app that manages local files and organizes images fast and intuitively.',
    },
  },
  features: {
    title: 'Why BanaNyang?',
    subtitle: 'Explore ideas on a single canvas and expand them with AI.',
    canvas: {
      title: 'Infinite Canvas',
      desc: 'Place and explore hundreds of images on an unlimited infinite canvas. Zoom, pan, and navigate with perfect smoothness.',
    },
    aiGen: {
      title: 'AI Generation',
      desc: 'Draw inspiration from references on your canvas and instantly generate new concept art. From outfit extraction to pose transfer to auto coloring.',
    },
    reference: {
      title: 'Reference Board',
      desc: 'Instantly collect web images or Photoshop work-in-progress via clipboard paste or drag and drop. Use them directly for AI generation on the canvas.',
    },
    smartTools: {
      title: 'Smart Tools',
      desc: 'Background removal, auto coloring, outfit extraction, design variations — all AI tools for artists in one workspace.',
    },
    noCostAi: {
      title: 'No Subscription AI',
      desc: 'Use immediately with your personal Google account — no monthly fees. For sensitive work, Vertex AI account integration is also supported for enterprise environments.',
    },
    lightingControl: {
      title: 'Lighting Control',
      tagline: 'Control lighting direction, intensity, and color temperature directly on the canvas.',
      desc: 'Independently control lighting direction, intensity, and color temperature to craft precisely the mood you\'re after. Shift shadow angles to add dramatic depth, or dial color temperature warm or cool to set the emotional tone. Adjust key light and fill light intensities separately, and apply independent lighting layers to characters and backgrounds. From studio setups to stylized in-game lighting, every parameter is adjustable directly on the canvas — no re-rendering required.',
    },
    partsCompositing: {
      title: 'Part-by-Part Composite Control',
      tagline: 'Select body parts independently and regenerate only what you need — precisely.',
      desc: 'Target face, upper body, lower body, hands, and feet independently to regenerate only the parts you need. Select body regions from the concept tab — the rest of the character stays intact while a pixel-accurate mask seamlessly blends generated areas with untouched regions. Iterate on armor details, change facial expressions, or swap outfit components without redrawing the full illustration. Precision compositing for every stage of character production.',
    },
  },
  tools: {
    title: 'AI Generation Tools',
    subtitle: '4 AI generation tools designed for professional artist workflows.\nRun them directly on the canvas.',
    autoColoring: {
      title: 'Auto Coloring',
      name: 'Auto Coloring',
      tagline: 'Upload line art, and AI automatically colors it.',
      desc: 'One of the most time-consuming tasks in early concept art is rough coloring. Auto Coloring detects hair, skin, and outfit areas in your line art and colors them naturally. Great for quickly establishing a color mood on rough sketches, with an intensity slider to adjust from fully automatic to guided coloring.',
    },
    variation: {
      title: 'Design Variation',
      name: 'Design Variation',
      tagline: 'Explore dozens of variations from a single design.',
      desc: 'Before finalizing a character design, quickly exploring different directions is essential. Generate multiple versions with varied composition, color, and details from an existing image. Change armor shape, try color palettes, or rearrange accessories — compare AI-generated possibilities on your canvas without drawing each one.',
    },
    pose: {
      title: 'Pose Extraction',
      name: 'Pose Extraction',
      tagline: 'Isolate the pose from a reference and apply it to a new character.',
      desc: 'Reproduce any pose accurately without 3D. Automatically detects joint structure from reference images, extracts a skeleton, then generates a new image of a different character in the same pose. Perfect when you want to use a reference photo\'s pose for illustration but with your own character design.',
    },
    outfit: {
      title: 'Outfit Extraction',
      name: 'Outfit Extraction',
      tagline: 'Separate a character\'s outfit and try it on different characters.',
      desc: 'In fantasy and game character design, outfits define character identity. Extract the shape and details of clothing (armor, dress, uniform) from reference images and naturally composite them onto characters with different body types or poses. Get an answer to "What would this outfit look like on that character?" in 30 seconds.',
    },
  },
  download: {
    title: 'Download BanaNyang',
    subtitle: 'One purchase, no subscription',
    version: 'Version',
    released: 'Released',
    windows: { label: 'Download for Windows (.exe)', req: 'Windows 10 64-bit or later' },
    mac: { label: 'Download for Mac (.dmg)', req: 'macOS 12 Monterey or later' },
    sysReq: 'System Requirements',
    requirements: {
      os: 'OS',
      ram: 'RAM',
      gpu: 'GPU',
      storage: 'Storage',
      windowsVal: 'Windows 10 64-bit or later',
      macVal: 'macOS 12 Monterey or later',
      ramVal: '8GB RAM or more (16GB recommended)',
      gpuVal: 'DirectX 11 / Metal compatible GPU',
      storageVal: '1GB free space',
    },
    gate: {
      title: 'Canvas Locked',
      subtitle: 'Purchase to unlock downloads and all features instantly.',
      buy: 'Buy BanaNyang — $19.99',
      buyNote: 'One-time purchase · No subscription',
      alreadyBought: 'Already purchased?',
      enterKey: 'Enter license key',
      keyPlaceholder: 'XXXX-XXXX-XXXX-XXXX',
      keySubmit: 'Verify',
      keyError: 'Invalid license key.',
      unlocked: 'Unlocked',
      unlockedNote: 'Your download links are now active.',
      apiKeyNotice: 'AI generation requires your own Google API key or Google Vertex AI account. Purchasing the app alone does not include AI generation.',
    },
    changelog: 'What\'s New',
    changelogItems: [
      'Infinite canvas performance significantly improved (200+ images)',
      'Enhanced 4K generation stability',
      'WebGL rendering optimization',
      'Improved auto coloring accuracy',
      'Pose extraction 2× faster',
    ],
  },
  footer: {
    copyright: '© 2025 BanaNyang',
    tos: 'Terms of Service',
    privacy: 'Privacy Policy',
    contact: 'Contact',
  },
  auth: {
    login: 'Log in',
    signup: 'Sign up',
    logout: 'Log out',
    myAccount: 'My Account',
    email: 'Email',
    password: 'Password',
    name: 'Name',
    continueWithGoogle: 'Continue with Google',
    or: 'or',
    forgotPassword: 'Forgot password?',
    alreadyHaveAccount: 'Already have an account?',
    noAccount: "Don't have an account?",
    resetEmailSent: 'Password reset email sent. Check your inbox.',
    verificationEmailSent: 'Verification email sent. Check your inbox.',
    errors: {
      email_in_use: 'This email is already in use.',
      wrong_password: 'Incorrect email or password.',
      user_not_found: 'No account found with this email.',
      weak_password: 'Password must be at least 6 characters.',
      invalid_email: 'Please enter a valid email address.',
      unauthorized_domain: 'Google sign-in is not allowed on this domain. Please contact support.',
      popup_blocked: 'Your browser blocked the popup. Please allow popups and try again.',
      network_error: 'Network error. Please check your internet connection and try again.',
      config_error: 'Login configuration error. Please contact support.',
      unknown: 'An error occurred. Please try again.',
    },
  },
  account: {
    title: 'My Account',
    greeting: 'Hello',
    purchaseHistory: 'Purchase History',
    noPurchases: 'No purchases yet.',
    invoice: 'Invoice PDF',
    licenseKey: 'License Key',
    copyKey: 'Copy',
    keyCopied: 'Copied!',
    profile: 'Account Info',
    saveChanges: 'Save',
    saved: 'Saved',
    deviceChangeNotice: 'Changed devices? Use your license key on the download page to reactivate.',
    loading: 'Loading...',
    loginRequired: 'You need to be logged in to view this page.',
  },
  contact: {
    title: 'Contact Us',
    subtitle: "Send us your questions, suggestions, or collaboration inquiries. We'll get back to you as soon as possible.",
    name: 'Name',
    email: 'Email',
    message: 'Message',
    messagePlaceholder: 'Type your message here...',
    submit: 'Send',
    success: 'Mail client opened!',
    successDetail: "Send the email and we'll reply to you shortly.",
    directEmail: 'Email us directly',
  },
  legal: {
    lastUpdated: 'Last updated',
  },
  comingSoon: {
    badge: 'Coming Soon',
    cardTitle: 'Download BanaNyang',
    cardBody: 'Final polish in progress. Launching soon.',
    macOptimizing: 'Optimizing for macOS',
    notifyMe: 'Notify Me',
    notifyPlaceholder: 'your@email.com',
    notifySuccess: "✓ We'll let you know.",
    notifyAlready: "✓ You're already on the list.",
    notifyError: 'Please enter a valid email.',
    notifyServerError: 'Something went wrong. Please try again.',
    notifyRateLimited: 'Please wait a moment before trying again.',
    availableAtLaunch: 'Available at launch',
    tooltip: 'Available soon',
  },
  featuresPage: {
    title: 'Features & Tools',
    subtitle: 'The AI workflow that BanaNyang provides',
  },
  changelog: {
    title: 'Changelog',
    subtitle: 'BanaNyang update history',
    empty: 'Updates coming soon',
    emptyDesc: 'The first patch notes will be published soon.',
    viewDetail: 'View details',
    close: 'Close',
  },
  pricing: {
    title: 'Pricing',
    lifetimeDesc: 'No more recurring software subscription fees. One purchase gives you permanent access to BanaNyang\'s powerful infinite canvas workspace.',
    notice: {
      title: '💡 About AI Generation',
      body: 'BanaNyang directly integrates with leading global AI models for the best quality output. Image generation requires registering your own personal or enterprise API key from each AI platform (OpenAI, FLUX, etc.). API call costs are billed separately according to each platform\'s pricing policy. (Vertex AI can be connected through your organization\'s account.)',
    },
    apiPricingTitle: 'AI Model API Pricing',
    apiPricingSubtitle: 'Per-image pricing by provider',
    providers: { google: 'Google', openai: 'OpenAI', flux: 'Flux' },
    table: { model: 'Model', resolution: 'Resolution', quality: 'Quality', pricePerImage: 'Price / image' },
    footnote: {
      gemini: 'Source: Google AI for Developers / Vertex AI Pricing',
      openai: 'Source: OpenAI Pricing',
      flux: 'Source: BFL Pricing — $0.07/MP',
    },
  },
};

/* ─── Japanese ─── */
const ja: Translations = {
  nav: {
    download: 'ダウンロード',
    features: '機能',
    backHome: 'ホームへ',
    pricing: '価格',
    changelog: '更新履歴',
  },
  hero: {
    title: '無限キャンバス、\nすべてのインスピレーションが\n繋がる。',
    subtitle: '何百枚ものリファレンスを広げ、混ぜ合わせ、\n即座に新しいコンセプトを生み出しましょう。',
    tagline: '私たちは2D/3Dアーティストのための最も自由なAIワークスペースのみを提供しています。',
    downloadWindows: 'Windows版をダウンロード',
    downloadMac: 'Mac版をダウンロード',
    price: '買い切り · $19.99 USD · サブスクなし',
    priceBadgeDesc: 'AI生成には個人のGoogle APIキーまたはGoogle Vertex AIアカウントが必要です',
    buyNow: '今すぐ購入 — $19.99',
    pricingTagline: '一度の支払い。永久に所有。',
    pricingDesc: '毎月のサブスク料金はもう不要。ランチ一回分の価格で、毎日のリファレンス収集とシート作業の時間を劇的に短縮できます。',
    pricingFeatures: '✔ 無制限キャンバス | ✔ ローカル処理 | ✔ 追加費用なし',
  },
  intro: {
    label: 'Why BanaNyang',
    headline: 'プロのアーティストのために',
    byok: {
      title: '中間手数料なし、使った分だけ',
      desc: 'Gemini、OpenAI、Flux など、お好みのAIモデルのAPIキーを直接接続。月額料金や中間手数料は一切なく、生成した結果に対してモデルの正価のみをお支払いいただきます。',
    },
    canvas: {
      title: 'プロ仕様の編集と無限キャンバス',
      desc: '本当に無限のキャンバスにアイデアを自由に広げてください。複雑さなしに、プロレベルの画像生成・編集機能を提供します。',
    },
    desktop: {
      title: 'デスクトップ優先、完全ローカル制御',
      desc: 'ウェブアプリの読み込みや毎回のログインは不要。ネイティブデスクトップアプリでローカルファイルを管理し、画像を素早く直感的に整理できます。',
    },
  },
  features: {
    title: 'Why BanaNyang?',
    subtitle: '一つのキャンバスでアイデアを探索し、AIで広げましょう。',
    canvas: {
      title: 'Infinite Canvas',
      desc: '制限のない無限キャンバスに何百枚もの画像を自由に配置して探索できます。ズーム、パン、ナビゲーションが完璧にスムーズです。',
    },
    aiGen: {
      title: 'AI Generation',
      desc: 'キャンバス上のリファレンスからインスピレーションを得て、即座に新しいコンセプトアートを生成します。衣装抽出、ポーズ変換、自動塗りまで。',
    },
    reference: {
      title: 'Reference Board',
      desc: 'ウェブ画像やPhotoshop作業中の画像をクリップボード貼り付けまたはドラッグ＆ドロップで即座に収集。キャンバス上でそのままAI生成に活用できます。',
    },
    smartTools: {
      title: 'Smart Tools',
      desc: '背景削除、自動塗り、衣装抽出、デザインバリエーションなど、アーティスト向けAIツールを一つのワークスペースで。',
    },
    noCostAi: {
      title: 'サブスクなしAI',
      desc: '月額料金なしで個人のGoogleアカウントですぐに使用可能。機密性の高い作業にはVertex AIアカウント連携もサポートし、企業環境でも安心して使えます。',
    },
    lightingControl: {
      title: 'Lighting Control',
      tagline: '照明の方向・強度・色温度をキャンバス上で直接コントロール。',
      desc: '照明の方向・強度・色温度を独立して調整し、意図した雰囲気を精密に演出します。影の角度を変えて劇的な奥行きを加えたり、色温度を暖かく・冷たく設定して感情的なトーンを表現できます。キーライトとフィルライトの強度を個別に設定し、キャラクターと背景に独立した照明レイヤーを適用。スタジオ照明からゲーム内ライティングまで、すべてのパラメータをキャンバス上で直接制御できます。',
    },
    partsCompositing: {
      title: 'パーツ別合成制御',
      tagline: '身体のパーツを独立して選択し、必要な部位だけを精密に再生成。',
      desc: '顔・上半身・下半身・手・足などの身体部位を独立して指定し、必要なパーツだけを再生成できます。コンセプトタブで修正する部位を選択すると、残りのキャラクターはそのまま維持され、ピクセル単位のマスクが生成領域と原本の境界を自然につなぎます。鎧の細部修正・表情変更・衣装コンポーネントの入れ替えなど、イラスト全体に手を加えずに必要な部分だけを精密に繰り返し修正できます。',
    },
  },
  tools: {
    title: 'AI Generation Tools',
    subtitle: 'プロのアーティストワークフローに合わせた4つのAI生成ツール。\nキャンバス上で直接実行できます。',
    autoColoring: {
      title: '自動塗り',
      name: '自動塗り (Auto Coloring)',
      tagline: '線画をアップロードするだけで、AIが自動的に彩色します。',
      desc: 'コンセプトアートの初期段階で最も時間がかかる作業のひとつがラフ彩色です。自動塗りは線画をアップロードすると、AIがキャラクターの髪、肌、衣装の領域を認識して自然な色合いで塗ります。ラフスケッチに素早くカラームードを設定するのに便利で、強度スライダーで完全自動からガイド彩色まで調整できます。',
    },
    variation: {
      title: 'デザインバリエーション',
      name: 'デザインバリエーション (Design Variation)',
      tagline: '一つのデザインから何十ものバリエーションを探索しましょう。',
      desc: 'キャラクターデザインを確定する前に、様々な方向性を素早く探索することは不可欠です。既存の画像をベースに構図、色、ディテールを変えた複数のバージョンを一度に生成します。鎧の形を変えたり、カラーパレットを試したり、小道具の配置を変えたりする際、一つひとつ描かずにAIが提案する可能性をキャンバス上に広げて比較できます。',
    },
    pose: {
      title: 'ポーズ抽出',
      name: 'ポーズ抽出 (Pose Extraction)',
      tagline: 'リファレンスからポーズだけを分離して新しいキャラクターに適用します。',
      desc: '3Dなしでも好きなポーズを正確に再現できます。キャンバスに置いたリファレンス画像から人体の関節構造を自動認識してスケルトンを抽出し、それを基に全く異なるキャラクターが同じポーズを取った新しい画像を生成します。アクションシーンや動的なポーズが必要なイラスト作業で、参考写真のポーズをそのまま活用しつつキャラクターデザインは自由に変えたい時に使います。',
    },
    outfit: {
      title: '衣装抽出',
      name: '衣装抽出 (Outfit Extraction)',
      tagline: 'キャラクターの衣装だけを分離して別のキャラクターに着せてみましょう。',
      desc: 'ファンタジーやゲームキャラクターデザインでは、衣装がキャラクターのアイデンティティを決定する重要な要素です。リファレンス画像から衣装（鎧、ドレス、ユニフォームなど）の形とディテールを分離・抽出し、異なる体型やポーズのキャラクターに自然に合成します。「このキャラクターにあの衣装を着せたらどうなる？」という疑問に30秒で答えが得られ、衣装デザインのイテレーション速度が飛躍的に向上します。',
    },
  },
  download: {
    title: 'BanaNyangをダウンロード',
    subtitle: '一回購入、サブスクなし',
    version: 'バージョン',
    released: 'リリース日',
    windows: { label: 'Windows版をダウンロード (.exe)', req: 'Windows 10 64-bit以降' },
    mac: { label: 'Mac版をダウンロード (.dmg)', req: 'macOS 12 Monterey以降' },
    sysReq: 'システム要件',
    requirements: {
      os: 'OS',
      ram: 'メモリ',
      gpu: 'GPU',
      storage: 'ストレージ',
      windowsVal: 'Windows 10 64-bit以降',
      macVal: 'macOS 12 Monterey以降',
      ramVal: '8GB RAM以上（16GB推奨）',
      gpuVal: 'DirectX 11 / Metal対応GPU',
      storageVal: '1GB以上の空き容量',
    },
    gate: {
      title: 'キャンバスがロックされています',
      subtitle: '購入後すぐにダウンロードしてすべての機能をアンロックできます。',
      buy: 'BanaNyangを購入する — $19.99',
      buyNote: '買い切り · サブスクなし',
      alreadyBought: 'すでに購入済みですか？',
      enterKey: 'ライセンスキーを入力',
      keyPlaceholder: 'XXXX-XXXX-XXXX-XXXX',
      keySubmit: '確認',
      keyError: '無効なライセンスキーです。',
      unlocked: 'アンロック済み',
      unlockedNote: 'ダウンロードリンクが有効になりました。',
      apiKeyNotice: 'AI生成機能を使用するには、個人のGoogle APIキーまたはGoogle Vertex AIアカウントが必要です。アプリの購入のみではAI生成は含まれません。',
    },
    changelog: '更新履歴',
    changelogItems: [
      '無限キャンバスのパフォーマンスを大幅改善（200枚以上の画像）',
      '4K生成の安定性向上',
      'WebGLレンダリングの最適化',
      '自動塗りの精度改善',
      'ポーズ抽出が2倍速く',
    ],
  },
  footer: {
    copyright: '© 2025 BanaNyang',
    tos: 'Terms of Service',
    privacy: 'Privacy Policy',
    contact: 'Contact',
  },
  auth: {
    login: 'ログイン',
    signup: '新規登録',
    logout: 'ログアウト',
    myAccount: 'マイアカウント',
    email: 'メールアドレス',
    password: 'パスワード',
    name: '名前',
    continueWithGoogle: 'Googleで続ける',
    or: 'または',
    forgotPassword: 'パスワードをお忘れですか？',
    alreadyHaveAccount: 'すでにアカウントをお持ちですか？',
    noAccount: 'アカウントをお持ちでないですか？',
    resetEmailSent: 'パスワードリセットメールを送信しました。',
    verificationEmailSent: '認証メールを送信しました。受信トレイをご確認ください。',
    errors: {
      email_in_use: 'このメールアドレスはすでに使用されています。',
      wrong_password: 'メールアドレスまたはパスワードが正しくありません。',
      user_not_found: 'このメールアドレスのアカウントが見つかりません。',
      weak_password: 'パスワードは6文字以上で設定してください。',
      invalid_email: '有効なメールアドレスを入力してください。',
      unauthorized_domain: 'このドメインではGoogle ログインが許可されていません。管理者にお問い合わせください。',
      popup_blocked: 'ブラウザがポップアップをブロックしました。ポップアップを許可してから再度お試しください。',
      network_error: 'ネットワークエラーです。インターネット接続を確認してから再度お試しください。',
      config_error: 'ログイン設定にエラーがあります。管理者にお問い合わせください。',
      unknown: 'エラーが発生しました。もう一度お試しください。',
    },
  },
  account: {
    title: 'マイアカウント',
    greeting: 'こんにちは',
    purchaseHistory: '購入履歴',
    noPurchases: '購入履歴がありません。',
    invoice: '請求書PDF',
    licenseKey: 'ライセンスキー',
    copyKey: 'コピー',
    keyCopied: 'コピーしました！',
    profile: 'アカウント情報',
    saveChanges: '保存',
    saved: '保存しました',
    deviceChangeNotice: 'デバイスを変更しましたか？ライセンスキーでダウンロードページから再アクティブ化できます。',
    loading: '読み込み中...',
    loginRequired: 'このページを表示するにはログインが必要です。',
  },
  contact: {
    title: 'お問い合わせ',
    subtitle: 'ご質問、ご提案、コラボレーションのお問い合わせをお送りください。できる限り早くご回答いたします。',
    name: 'お名前',
    email: 'メールアドレス',
    message: 'お問い合わせ内容',
    messagePlaceholder: 'お問い合わせ内容をご入力ください...',
    submit: '送信',
    success: 'メールクライアントが開きました！',
    successDetail: 'メールを送信後、できる限り早くご回答いたします。',
    directEmail: '直接メールを送る',
  },
  legal: {
    lastUpdated: '最終更新',
  },
  comingSoon: {
    badge: 'もうすぐリリース',
    cardTitle: 'BanaNyangをダウンロード',
    cardBody: '最後の仕上げ中です。もうすぐリリースします。',
    macOptimizing: 'macOS最適化中',
    notifyMe: '通知を受け取る',
    notifyPlaceholder: 'your@email.com',
    notifySuccess: '✓ リリース時にお知らせします。',
    notifyAlready: '✓ すでに登録されています。',
    notifyError: '有効なメールアドレスを入力してください。',
    notifyServerError: 'エラーが発生しました。もう一度お試しください。',
    notifyRateLimited: '少し時間をおいてから再度お試しください。',
    availableAtLaunch: 'リリース時にお会いしましょう',
    tooltip: 'もうすぐ',
  },
  featuresPage: {
    title: '機能とツール',
    subtitle: 'BanaNyang が提供する AI ワークフロー',
  },
  changelog: {
    title: '更新履歴',
    subtitle: 'BanaNyang アップデート履歴',
    empty: 'まもなく更新予定',
    emptyDesc: '最初のパッチノートがまもなく公開されます。',
    viewDetail: '詳細を見る',
    close: '閉じる',
  },
  pricing: {
    title: '価格',
    lifetimeDesc: '面倒な月額サブスク料金はもう不要です。一度の購入で BanaNyang の強力な無限キャンバスワークスペースを永久に所有してください。',
    notice: {
      title: '💡 AI 生成機能のご利用について',
      body: 'BanaNyang は最高品質を実現するため、さまざまなグローバル AI モデルを直接連携する方式を採用しています。画像生成機能は、各 AI プラットフォーム（OpenAI、FLUX など）から発行された個人・法人用 API キーを登録してご利用いただけます。モデル利用に伴う API 呼び出し費用は、各プラットフォームのポリシーに従って別途請求されます。（Vertex AI は所属企業のアカウントを通じて連携可能です。）',
    },
    apiPricingTitle: 'AI モデル API 価格',
    apiPricingSubtitle: 'プロバイダー別 画像 1 枚あたりの価格',
    providers: { google: 'Google', openai: 'OpenAI', flux: 'Flux' },
    table: { model: 'モデル', resolution: '解像度', quality: '品質', pricePerImage: '画像あたり価格' },
    footnote: {
      gemini: '出典: Google AI for Developers / Vertex AI Pricing',
      openai: '出典: OpenAI Pricing',
      flux: '出典: BFL Pricing — $0.07/MP',
    },
  },
};

/* ─── Indonesian ─── */
const id: Translations = {
  nav: {
    download: 'Unduh',
    features: 'Fitur',
    backHome: 'Kembali ke Beranda',
    pricing: 'Harga',
    changelog: 'Changelog',
  },
  hero: {
    title: 'Kanvas Tak Terbatas,\nTempat Semua Inspirasi Terhubung.',
    subtitle: 'Sebarkan ratusan referensi, kombinasikan,\ndan ciptakan konsep baru secara instan.',
    tagline: 'Kami menyediakan ruang kerja AI paling bebas khusus untuk seniman 2D/3D.',
    downloadWindows: 'Unduh untuk Windows',
    downloadMac: 'Unduh untuk Mac',
    price: 'Pembelian sekali · $19.99 USD · Tanpa langganan',
    priceBadgeDesc: 'Generasi AI memerlukan kunci API Google pribadi atau akun Google Vertex AI',
    buyNow: 'Beli Sekarang — $19.99',
    pricingTagline: 'Satu pembayaran. Milik selamanya.',
    pricingDesc: 'Tidak ada biaya langganan bulanan. Dengan harga satu kali makan siang, kurangi waktu pengumpulan referensi dan pekerjaan sheet harian secara drastis.',
    pricingFeatures: '✔ Kanvas Tak Terbatas | ✔ Pemrosesan Lokal | ✔ Tanpa Biaya Tambahan',
  },
  intro: {
    label: 'Why BanaNyang',
    headline: 'Dibuat untuk artis profesional',
    byok: {
      title: 'Bayar hanya untuk yang Anda pakai',
      desc: 'Hubungkan API key Anda sendiri untuk Gemini, OpenAI, Flux, dan lainnya. Tanpa langganan bulanan atau biaya perantara — bayar langsung ke penyedia model sesuai pemakaian.',
    },
    canvas: {
      title: 'Editing profesional di kanvas tak terbatas',
      desc: 'Sebarkan ide secara bebas di kanvas yang benar-benar tak terbatas. Pembuatan dan pengeditan gambar tingkat profesional tanpa kerumitan.',
    },
    desktop: {
      title: 'Desktop-first, sepenuhnya lokal',
      desc: 'Tidak ada web app yang perlu dimuat, tidak perlu login berulang. Aplikasi desktop native yang mengelola file lokal dan mengatur gambar dengan cepat dan intuitif.',
    },
  },
  features: {
    title: 'Why BanaNyang?',
    subtitle: 'Jelajahi ide di satu kanvas dan perluas dengan AI.',
    canvas: {
      title: 'Infinite Canvas',
      desc: 'Tempatkan dan jelajahi ratusan gambar di kanvas tak terbatas. Zoom, geser, dan navigasi dengan sangat mulus.',
    },
    aiGen: {
      title: 'AI Generation',
      desc: 'Ambil inspirasi dari referensi di kanvas Anda dan segera buat konsep seni baru. Dari ekstraksi pakaian hingga transfer pose hingga pewarnaan otomatis.',
    },
    reference: {
      title: 'Reference Board',
      desc: 'Kumpulkan gambar web atau pekerjaan Photoshop secara instan via tempel clipboard atau seret dan lepas. Gunakan langsung untuk generasi AI di kanvas.',
    },
    smartTools: {
      title: 'Smart Tools',
      desc: 'Penghapusan latar belakang, pewarnaan otomatis, ekstraksi pakaian, variasi desain — semua alat AI untuk seniman dalam satu ruang kerja.',
    },
    noCostAi: {
      title: 'AI Tanpa Langganan',
      desc: 'Gunakan langsung dengan akun Google pribadi — tanpa biaya bulanan. Untuk pekerjaan sensitif, integrasi akun Vertex AI juga didukung untuk lingkungan perusahaan.',
    },
    lightingControl: {
      title: 'Lighting Control',
      tagline: 'Kontrol arah, intensitas, dan suhu warna pencahayaan langsung di kanvas.',
      desc: 'Kontrol arah pencahayaan, intensitas, dan suhu warna secara independen untuk menciptakan suasana yang tepat. Ubah sudut bayangan untuk menambah kedalaman dramatis, atau atur suhu warna hangat atau dingin untuk menetapkan nada emosional. Sesuaikan key light dan fill light secara terpisah dan terapkan lapisan pencahayaan independen pada karakter dan latar belakang. Semua parameter dapat disesuaikan langsung di kanvas — tanpa render ulang.',
    },
    partsCompositing: {
      title: 'Kontrol Komposit Per-Bagian',
      tagline: 'Pilih bagian tubuh secara independen dan regenerasi hanya yang dibutuhkan — dengan presisi.',
      desc: 'Targetkan wajah, tubuh atas, tubuh bawah, tangan, dan kaki secara independen untuk meregenerasi hanya bagian yang diperlukan. Pilih area tubuh dari tab konsep — sisa karakter tetap utuh sementara masker piksel-akurat menggabungkan area yang dihasilkan dengan area yang tidak tersentuh secara mulus. Iterasi detail baju besi, ubah ekspresi wajah, atau ganti komponen pakaian tanpa menggambar ulang ilustrasi penuh. Kompositing presisi untuk setiap tahap produksi karakter.',
    },
  },
  tools: {
    title: 'AI Generation Tools',
    subtitle: '4 alat generasi AI yang dirancang untuk alur kerja seniman profesional.\nJalankan langsung di kanvas.',
    autoColoring: {
      title: 'Pewarnaan Otomatis',
      name: 'Auto Coloring',
      tagline: 'Unggah line art, AI akan mewarnainya secara otomatis.',
      desc: 'Salah satu tugas yang paling memakan waktu dalam konsep awal adalah pewarnaan kasar. Pewarnaan Otomatis mendeteksi area rambut, kulit, dan pakaian dalam line art Anda dan mewarnainya secara alami. Sangat bagus untuk segera menetapkan suasana warna pada sketsa kasar, dengan slider intensitas untuk mengatur antara otomatis penuh dan pewarnaan terbimbing.',
    },
    variation: {
      title: 'Variasi Desain',
      name: 'Design Variation',
      tagline: 'Jelajahi puluhan variasi dari satu desain.',
      desc: 'Sebelum menyelesaikan desain karakter, menjelajahi berbagai arah dengan cepat adalah hal yang penting. Hasilkan beberapa versi dengan komposisi, warna, dan detail yang bervariasi dari gambar yang ada. Ubah bentuk baju besi, coba palet warna, atau susun ulang aksesori — bandingkan kemungkinan yang dihasilkan AI di kanvas Anda.',
    },
    pose: {
      title: 'Ekstraksi Pose',
      name: 'Pose Extraction',
      tagline: 'Pisahkan pose dari referensi dan terapkan ke karakter baru.',
      desc: 'Reproduksi pose apapun dengan akurat tanpa 3D. Secara otomatis mendeteksi struktur sendi dari gambar referensi, mengekstrak kerangka, lalu menghasilkan gambar baru dari karakter berbeda dalam pose yang sama. Sempurna saat Anda ingin menggunakan pose foto referensi untuk ilustrasi tetapi dengan desain karakter Anda sendiri.',
    },
    outfit: {
      title: 'Ekstraksi Pakaian',
      name: 'Outfit Extraction',
      tagline: 'Pisahkan pakaian karakter dan coba pada karakter berbeda.',
      desc: 'Dalam desain karakter fantasi dan game, pakaian mendefinisikan identitas karakter. Ekstrak bentuk dan detail pakaian (baju besi, gaun, seragam) dari gambar referensi dan kompositkan secara alami ke karakter dengan tipe tubuh atau pose berbeda. Dapatkan jawaban atas "Bagaimana pakaian ini terlihat di karakter itu?" dalam 30 detik.',
    },
  },
  download: {
    title: 'Unduh BanaNyang',
    subtitle: 'Satu pembelian, tanpa langganan',
    version: 'Versi',
    released: 'Dirilis',
    windows: { label: 'Unduh untuk Windows (.exe)', req: 'Windows 10 64-bit atau lebih baru' },
    mac: { label: 'Unduh untuk Mac (.dmg)', req: 'macOS 12 Monterey atau lebih baru' },
    sysReq: 'Persyaratan Sistem',
    requirements: {
      os: 'OS',
      ram: 'RAM',
      gpu: 'GPU',
      storage: 'Penyimpanan',
      windowsVal: 'Windows 10 64-bit atau lebih baru',
      macVal: 'macOS 12 Monterey atau lebih baru',
      ramVal: '8GB RAM atau lebih (16GB direkomendasikan)',
      gpuVal: 'GPU kompatibel DirectX 11 / Metal',
      storageVal: '1GB ruang kosong',
    },
    gate: {
      title: 'Kanvas Terkunci',
      subtitle: 'Beli untuk membuka unduhan dan semua fitur secara instan.',
      buy: 'Beli BanaNyang — $19.99',
      buyNote: 'Pembelian sekali · Tanpa langganan',
      alreadyBought: 'Sudah membeli?',
      enterKey: 'Masukkan kunci lisensi',
      keyPlaceholder: 'XXXX-XXXX-XXXX-XXXX',
      keySubmit: 'Verifikasi',
      keyError: 'Kunci lisensi tidak valid.',
      unlocked: 'Terbuka',
      unlockedNote: 'Tautan unduhan Anda kini aktif.',
      apiKeyNotice: 'Generasi AI memerlukan kunci API Google pribadi atau akun Google Vertex AI. Membeli aplikasi saja tidak termasuk generasi AI.',
    },
    changelog: 'Yang Baru',
    changelogItems: [
      'Performa kanvas tak terbatas ditingkatkan secara signifikan (200+ gambar)',
      'Stabilitas generasi 4K yang ditingkatkan',
      'Optimasi rendering WebGL',
      'Akurasi pewarnaan otomatis yang ditingkatkan',
      'Ekstraksi pose 2× lebih cepat',
    ],
  },
  footer: {
    copyright: '© 2025 BanaNyang',
    tos: 'Terms of Service',
    privacy: 'Privacy Policy',
    contact: 'Contact',
  },
  auth: {
    login: 'Masuk',
    signup: 'Daftar',
    logout: 'Keluar',
    myAccount: 'Akun Saya',
    email: 'Email',
    password: 'Kata Sandi',
    name: 'Nama',
    continueWithGoogle: 'Lanjutkan dengan Google',
    or: 'atau',
    forgotPassword: 'Lupa kata sandi?',
    alreadyHaveAccount: 'Sudah punya akun?',
    noAccount: 'Belum punya akun?',
    resetEmailSent: 'Email reset kata sandi terkirim. Periksa kotak masuk Anda.',
    verificationEmailSent: 'Email verifikasi terkirim. Periksa kotak masuk Anda.',
    errors: {
      email_in_use: 'Email ini sudah digunakan.',
      wrong_password: 'Email atau kata sandi salah.',
      user_not_found: 'Tidak ada akun dengan email ini.',
      weak_password: 'Kata sandi harus minimal 6 karakter.',
      invalid_email: 'Masukkan alamat email yang valid.',
      unauthorized_domain: 'Login Google tidak diizinkan di domain ini. Hubungi dukungan.',
      popup_blocked: 'Browser Anda memblokir popup. Izinkan popup lalu coba lagi.',
      network_error: 'Kesalahan jaringan. Periksa koneksi internet Anda lalu coba lagi.',
      config_error: 'Kesalahan konfigurasi login. Hubungi dukungan.',
      unknown: 'Terjadi kesalahan. Silakan coba lagi.',
    },
  },
  account: {
    title: 'Akun Saya',
    greeting: 'Halo',
    purchaseHistory: 'Riwayat Pembelian',
    noPurchases: 'Belum ada pembelian.',
    invoice: 'Invoice PDF',
    licenseKey: 'Kunci Lisensi',
    copyKey: 'Salin',
    keyCopied: 'Tersalin!',
    profile: 'Info Akun',
    saveChanges: 'Simpan',
    saved: 'Tersimpan',
    deviceChangeNotice: 'Mengganti perangkat? Gunakan kunci lisensi di halaman unduhan untuk mengaktifkan kembali.',
    loading: 'Memuat...',
    loginRequired: 'Anda harus masuk untuk melihat halaman ini.',
  },
  contact: {
    title: 'Hubungi Kami',
    subtitle: 'Kirimkan pertanyaan, saran, atau pertanyaan kolaborasi Anda. Kami akan membalasnya sesegera mungkin.',
    name: 'Nama',
    email: 'Email',
    message: 'Pesan',
    messagePlaceholder: 'Ketik pesan Anda di sini...',
    submit: 'Kirim',
    success: 'Klien email dibuka!',
    successDetail: 'Kirim email dan kami akan membalas Anda segera.',
    directEmail: 'Email kami langsung',
  },
  legal: {
    lastUpdated: 'Terakhir diperbarui',
  },
  comingSoon: {
    badge: 'Segera Hadir',
    cardTitle: 'Unduh BanaNyang',
    cardBody: 'Sedang dalam sentuhan akhir. Segera diluncurkan.',
    macOptimizing: 'Mengoptimalkan untuk macOS',
    notifyMe: 'Beritahu Saya',
    notifyPlaceholder: 'your@email.com',
    notifySuccess: '✓ Kami akan memberi tahu Anda.',
    notifyAlready: '✓ Anda sudah terdaftar.',
    notifyError: 'Masukkan email yang valid.',
    notifyServerError: 'Terjadi kesalahan. Silakan coba lagi.',
    notifyRateLimited: 'Mohon tunggu sebentar sebelum mencoba lagi.',
    availableAtLaunch: 'Tersedia saat peluncuran',
    tooltip: 'Segera hadir',
  },
  featuresPage: {
    title: 'Fitur & Alat',
    subtitle: 'Alur kerja AI yang disediakan BanaNyang',
  },
  changelog: {
    title: 'Changelog',
    subtitle: 'Riwayat pembaruan BanaNyang',
    empty: 'Pembaruan segera hadir',
    emptyDesc: 'Catatan patch pertama akan segera dipublikasikan.',
    viewDetail: 'Lihat detail',
    close: 'Tutup',
  },
  pricing: {
    title: 'Harga',
    lifetimeDesc: 'Tidak ada biaya langganan bulanan yang menjengkelkan. Satu pembelian memberikan akses permanen ke ruang kerja kanvas tak terbatas BanaNyang yang powerful.',
    notice: {
      title: '💡 Tentang Generasi AI',
      body: 'BanaNyang mengintegrasikan langsung model AI global terkemuka untuk output berkualitas terbaik. Fitur pembuatan gambar memerlukan pendaftaran kunci API pribadi atau perusahaan dari setiap platform AI (OpenAI, FLUX, dll.). Biaya panggilan API ditagih secara terpisah sesuai kebijakan harga masing-masing platform. (Vertex AI dapat dihubungkan melalui akun organisasi Anda.)',
    },
    apiPricingTitle: 'Harga API Model AI',
    apiPricingSubtitle: 'Harga per gambar berdasarkan penyedia',
    providers: { google: 'Google', openai: 'OpenAI', flux: 'Flux' },
    table: { model: 'Model', resolution: 'Resolusi', quality: 'Kualitas', pricePerImage: 'Harga / gambar' },
    footnote: {
      gemini: 'Sumber: Google AI for Developers / Vertex AI Pricing',
      openai: 'Sumber: OpenAI Pricing',
      flux: 'Sumber: BFL Pricing — $0.07/MP',
    },
  },
};

/* ─── Spanish ─── */
const es: Translations = {
  nav: {
    download: 'Descargar',
    features: 'Características',
    backHome: 'Volver al inicio',
    pricing: 'Precios',
    changelog: 'Cambios',
  },
  hero: {
    title: 'Lienzo Infinito,\nDonde Toda Inspiración Se Conecta.',
    subtitle: 'Despliega cientos de referencias, combínalas,\ny crea nuevos conceptos al instante.',
    tagline: 'Ofrecemos el espacio de trabajo de IA más flexible exclusivamente para artistas 2D/3D.',
    downloadWindows: 'Descargar para Windows',
    downloadMac: 'Descargar para Mac',
    price: 'Compra única · $19.99 USD · Sin suscripción',
    priceBadgeDesc: 'La generación de IA requiere tu propia clave de API de Google o cuenta de Google Vertex AI',
    buyNow: 'Comprar ahora — $19.99',
    pricingTagline: 'Un pago. Tuyo para siempre.',
    pricingDesc: 'Sin más cuotas mensuales. Por el precio de un almuerzo, reduce drásticamente el tiempo que dedicas a la recopilación diaria de referencias y trabajo de hoja.',
    pricingFeatures: '✔ Lienzo Ilimitado | ✔ Procesamiento Local | ✔ Sin Cargos Adicionales',
  },
  intro: {
    label: 'Why BanaNyang',
    headline: 'Diseñado para artistas profesionales',
    byok: {
      title: 'Paga solo por lo que usas',
      desc: 'Conecta tus propias claves API de Gemini, OpenAI, Flux y más. Sin suscripciones mensuales ni comisiones intermedias — paga directamente a los proveedores por lo que generas.',
    },
    canvas: {
      title: 'Edición profesional en lienzo infinito',
      desc: 'Despliega tus ideas libremente en un lienzo verdaderamente infinito. Generación y edición de imágenes a nivel profesional sin complicaciones.',
    },
    desktop: {
      title: 'Desktop primero, totalmente local',
      desc: 'Sin web app que cargar, sin inicios de sesión constantes. Una app de escritorio nativa que gestiona archivos locales y organiza imágenes de forma rápida e intuitiva.',
    },
  },
  features: {
    title: 'Why BanaNyang?',
    subtitle: 'Explora ideas en un solo lienzo y amplíalas con IA.',
    canvas: {
      title: 'Infinite Canvas',
      desc: 'Coloca y explora cientos de imágenes en un lienzo infinito sin límites. Zoom, desplazamiento y navegación perfectamente fluidos.',
    },
    aiGen: {
      title: 'AI Generation',
      desc: 'Inspírate con las referencias de tu lienzo y genera arte conceptual nuevo al instante. Desde extracción de atuendos hasta transferencia de poses y coloración automática.',
    },
    reference: {
      title: 'Reference Board',
      desc: 'Recoge imágenes web o trabajos de Photoshop al instante mediante portapapeles o arrastrar y soltar. Úsalos directamente para la generación de IA en el lienzo.',
    },
    smartTools: {
      title: 'Smart Tools',
      desc: 'Eliminación de fondo, coloración automática, extracción de atuendos, variaciones de diseño — todas las herramientas de IA para artistas en un solo espacio de trabajo.',
    },
    noCostAi: {
      title: 'IA Sin Suscripción',
      desc: 'Úsalo inmediatamente con tu cuenta personal de Google — sin cuotas mensuales. Para trabajos sensibles, también se admite la integración de cuentas Vertex AI para entornos empresariales.',
    },
    lightingControl: {
      title: 'Lighting Control',
      tagline: 'Controla la dirección, intensidad y temperatura de color de la iluminación directamente en el lienzo.',
      desc: 'Controla de forma independiente la dirección de iluminación, intensidad y temperatura de color para crear exactamente el ambiente buscado. Cambia el ángulo de las sombras para añadir profundidad dramática, o ajusta la temperatura a cálida o fría para establecer el tono emocional. Regula las intensidades de luz clave y luz de relleno por separado y aplica capas de iluminación independientes a personajes y fondos. Todo ajustable directamente en el lienzo — sin necesidad de re-renderizar.',
    },
    partsCompositing: {
      title: 'Control de Composición por Partes',
      tagline: 'Selecciona partes del cuerpo de forma independiente y regenera solo lo que necesitas — con precisión.',
      desc: 'Apunta a cara, cuerpo superior, cuerpo inferior, manos y pies de forma independiente para regenerar solo las partes que necesitas. Selecciona regiones del cuerpo desde la pestaña de concepto — el resto del personaje permanece intacto mientras una máscara pixel-precisa combina perfectamente las áreas generadas con las regiones sin tocar. Itera en detalles de armadura, cambia expresiones faciales o intercambia componentes de atuendo sin redibujar la ilustración completa. Composición de precisión en cada etapa de producción.',
    },
  },
  tools: {
    title: 'AI Generation Tools',
    subtitle: '4 herramientas de generación de IA diseñadas para flujos de trabajo de artistas profesionales.\nEjecútalas directamente en el lienzo.',
    autoColoring: {
      title: 'Coloración Automática',
      name: 'Auto Coloring',
      tagline: 'Sube el line art y la IA lo coloreará automáticamente.',
      desc: 'Una de las tareas más laboriosas en el arte conceptual inicial es el coloreado preliminar. La Coloración Automática detecta cabello, piel y áreas de atuendo en tu line art y los colorea de forma natural. Ideal para establecer rápidamente el estado de color en bocetos preliminares, con un control deslizante de intensidad para ajustar entre automático completo y coloreado guiado.',
    },
    variation: {
      title: 'Variación de Diseño',
      name: 'Design Variation',
      tagline: 'Explora docenas de variaciones desde un solo diseño.',
      desc: 'Antes de finalizar un diseño de personaje, explorar diferentes direcciones rápidamente es esencial. Genera múltiples versiones con composición, color y detalles variados desde una imagen existente. Cambia la forma de la armadura, prueba paletas de colores o reorganiza accesorios — compara las posibilidades generadas por IA en tu lienzo sin dibujar cada una.',
    },
    pose: {
      title: 'Extracción de Pose',
      name: 'Pose Extraction',
      tagline: 'Aísla la pose de una referencia y aplícala a un nuevo personaje.',
      desc: 'Reproduce cualquier pose con precisión sin 3D. Detecta automáticamente la estructura articular de las imágenes de referencia, extrae un esqueleto y luego genera una nueva imagen de un personaje diferente en la misma pose. Perfecto cuando quieres usar la pose de una foto de referencia para ilustración pero con tu propio diseño de personaje.',
    },
    outfit: {
      title: 'Extracción de Atuendo',
      name: 'Outfit Extraction',
      tagline: 'Separa el atuendo de un personaje y pruébalo en diferentes personajes.',
      desc: 'En el diseño de personajes de fantasía y juegos, los atuendos definen la identidad del personaje. Extrae la forma y detalles de la ropa (armadura, vestido, uniforme) de imágenes de referencia y compónalos de forma natural en personajes con diferentes tipos de cuerpo o poses. Obtén la respuesta a "¿Cómo quedaría este atuendo en ese personaje?" en 30 segundos.',
    },
  },
  download: {
    title: 'Descargar BanaNyang',
    subtitle: 'Una compra, sin suscripción',
    version: 'Versión',
    released: 'Lanzado',
    windows: { label: 'Descargar para Windows (.exe)', req: 'Windows 10 64-bit o posterior' },
    mac: { label: 'Descargar para Mac (.dmg)', req: 'macOS 12 Monterey o posterior' },
    sysReq: 'Requisitos del Sistema',
    requirements: {
      os: 'SO',
      ram: 'RAM',
      gpu: 'GPU',
      storage: 'Almacenamiento',
      windowsVal: 'Windows 10 64-bit o posterior',
      macVal: 'macOS 12 Monterey o posterior',
      ramVal: '8GB RAM o más (16GB recomendado)',
      gpuVal: 'GPU compatible con DirectX 11 / Metal',
      storageVal: '1GB de espacio libre',
    },
    gate: {
      title: 'Lienzo Bloqueado',
      subtitle: 'Compra para desbloquear descargas y todas las funciones al instante.',
      buy: 'Comprar BanaNyang — $19.99',
      buyNote: 'Compra única · Sin suscripción',
      alreadyBought: '¿Ya compraste?',
      enterKey: 'Introducir clave de licencia',
      keyPlaceholder: 'XXXX-XXXX-XXXX-XXXX',
      keySubmit: 'Verificar',
      keyError: 'Clave de licencia inválida.',
      unlocked: 'Desbloqueado',
      unlockedNote: 'Tus enlaces de descarga están activos.',
      apiKeyNotice: 'La generación de IA requiere tu propia clave de API de Google o cuenta de Google Vertex AI. Comprar la aplicación por sí sola no incluye la generación de IA.',
    },
    changelog: 'Novedades',
    changelogItems: [
      'Rendimiento del lienzo infinito significativamente mejorado (200+ imágenes)',
      'Estabilidad de generación 4K mejorada',
      'Optimización de renderizado WebGL',
      'Precisión de coloración automática mejorada',
      'Extracción de pose 2× más rápida',
    ],
  },
  footer: {
    copyright: '© 2025 BanaNyang',
    tos: 'Terms of Service',
    privacy: 'Privacy Policy',
    contact: 'Contact',
  },
  auth: {
    login: 'Iniciar sesión',
    signup: 'Registrarse',
    logout: 'Cerrar sesión',
    myAccount: 'Mi Cuenta',
    email: 'Correo electrónico',
    password: 'Contraseña',
    name: 'Nombre',
    continueWithGoogle: 'Continuar con Google',
    or: 'o',
    forgotPassword: '¿Olvidaste tu contraseña?',
    alreadyHaveAccount: '¿Ya tienes una cuenta?',
    noAccount: '¿No tienes una cuenta?',
    resetEmailSent: 'Correo de restablecimiento de contraseña enviado. Revisa tu bandeja de entrada.',
    verificationEmailSent: 'Correo de verificación enviado. Revisa tu bandeja de entrada.',
    errors: {
      email_in_use: 'Este correo electrónico ya está en uso.',
      wrong_password: 'Correo electrónico o contraseña incorrectos.',
      user_not_found: 'No se encontró ninguna cuenta con este correo electrónico.',
      weak_password: 'La contraseña debe tener al menos 6 caracteres.',
      invalid_email: 'Por favor, introduce una dirección de correo electrónico válida.',
      unauthorized_domain: 'El inicio de sesión con Google no está permitido en este dominio. Contacta con soporte.',
      popup_blocked: 'Tu navegador bloqueó la ventana emergente. Permite las ventanas emergentes e inténtalo de nuevo.',
      network_error: 'Error de red. Comprueba tu conexión a internet e inténtalo de nuevo.',
      config_error: 'Error de configuración de inicio de sesión. Contacta con soporte.',
      unknown: 'Se produjo un error. Por favor, inténtalo de nuevo.',
    },
  },
  account: {
    title: 'Mi Cuenta',
    greeting: 'Hola',
    purchaseHistory: 'Historial de Compras',
    noPurchases: 'Sin compras aún.',
    invoice: 'Factura PDF',
    licenseKey: 'Clave de Licencia',
    copyKey: 'Copiar',
    keyCopied: '¡Copiado!',
    profile: 'Información de Cuenta',
    saveChanges: 'Guardar',
    saved: 'Guardado',
    deviceChangeNotice: '¿Cambiaste de dispositivo? Usa tu clave de licencia en la página de descarga para reactivar.',
    loading: 'Cargando...',
    loginRequired: 'Debes iniciar sesión para ver esta página.',
  },
  contact: {
    title: 'Contáctanos',
    subtitle: 'Envíanos tus preguntas, sugerencias o consultas de colaboración. Te responderemos lo antes posible.',
    name: 'Nombre',
    email: 'Correo electrónico',
    message: 'Mensaje',
    messagePlaceholder: 'Escribe tu mensaje aquí...',
    submit: 'Enviar',
    success: '¡Cliente de correo abierto!',
    successDetail: 'Envía el correo y te responderemos pronto.',
    directEmail: 'Envíanos un correo directamente',
  },
  legal: {
    lastUpdated: 'Última actualización',
  },
  comingSoon: {
    badge: 'Próximamente',
    cardTitle: 'Descargar BanaNyang',
    cardBody: 'Últimos retoques en progreso. Lanzamiento próximo.',
    macOptimizing: 'Optimizando para macOS',
    notifyMe: 'Notifícame',
    notifyPlaceholder: 'your@email.com',
    notifySuccess: '✓ Te avisaremos.',
    notifyAlready: '✓ Ya estás en la lista.',
    notifyError: 'Por favor ingresa un email válido.',
    notifyServerError: 'Algo salió mal. Por favor inténtalo de nuevo.',
    notifyRateLimited: 'Espera un momento antes de intentarlo de nuevo.',
    availableAtLaunch: 'Disponible al lanzamiento',
    tooltip: 'Próximamente',
  },
  featuresPage: {
    title: 'Funciones y Herramientas',
    subtitle: 'El flujo de trabajo de IA que ofrece BanaNyang',
  },
  changelog: {
    title: 'Cambios',
    subtitle: 'Historial de actualizaciones de BanaNyang',
    empty: 'Actualizaciones próximamente',
    emptyDesc: 'Las primeras notas de parche se publicarán pronto.',
    viewDetail: 'Ver detalles',
    close: 'Cerrar',
  },
  pricing: {
    title: 'Precios',
    lifetimeDesc: 'Sin más tarifas de suscripción mensual. Una compra te da acceso permanente al potente espacio de trabajo de lienzo infinito de BanaNyang.',
    notice: {
      title: '💡 Sobre la Generación de IA',
      body: 'BanaNyang se integra directamente con los principales modelos de IA globales para obtener el mejor resultado de calidad. La función de generación de imágenes requiere registrar tu propia clave API personal o empresarial de cada plataforma de IA (OpenAI, FLUX, etc.). Los costos de las llamadas API se facturan por separado según la política de precios de cada plataforma. (Vertex AI se puede conectar a través de la cuenta de tu organización.)',
    },
    apiPricingTitle: 'Precios de la API de Modelos de IA',
    apiPricingSubtitle: 'Precio por imagen según proveedor',
    providers: { google: 'Google', openai: 'OpenAI', flux: 'Flux' },
    table: { model: 'Modelo', resolution: 'Resolución', quality: 'Calidad', pricePerImage: 'Precio / imagen' },
    footnote: {
      gemini: 'Fuente: Google AI for Developers / Vertex AI Pricing',
      openai: 'Fuente: OpenAI Pricing',
      flux: 'Fuente: BFL Pricing — $0.07/MP',
    },
  },
};

/* ─── French ─── */
const fr: Translations = {
  nav: {
    download: 'Télécharger',
    features: 'Fonctionnalités',
    backHome: "Retour à l'accueil",
    pricing: 'Tarifs',
    changelog: 'Journal',
  },
  hero: {
    title: 'Toile Infinie,\nOù Chaque Inspiration Se Connecte.',
    subtitle: 'Déployez des centaines de références, mélangez-les,\net créez instantanément de nouveaux concepts.',
    tagline: "Nous offrons l'espace de travail IA le plus flexible exclusivement pour les artistes 2D/3D.",
    downloadWindows: 'Télécharger pour Windows',
    downloadMac: 'Télécharger pour Mac',
    price: 'Achat unique · $19.99 USD · Sans abonnement',
    priceBadgeDesc: 'La génération IA nécessite votre propre clé API Google ou compte Google Vertex AI',
    buyNow: 'Acheter maintenant — $19.99',
    pricingTagline: 'Un seul paiement. À vous pour toujours.',
    pricingDesc: "Plus de frais d'abonnement mensuels. Pour le prix d'un déjeuner, réduisez considérablement le temps consacré à la collecte quotidienne de références et au travail sur les feuilles.",
    pricingFeatures: '✔ Toile Illimitée | ✔ Traitement Local | ✔ Sans Frais Supplémentaires',
  },
  intro: {
    label: 'Why BanaNyang',
    headline: 'Conçu pour les artistes professionnels',
    byok: {
      title: 'Payez uniquement ce que vous utilisez',
      desc: "Connectez vos propres clés API pour Gemini, OpenAI, Flux, et plus. Sans abonnement mensuel ni frais intermédiaires — payez directement les fournisseurs de modèles pour ce que vous générez.",
    },
    canvas: {
      title: 'Édition pro sur canvas infini',
      desc: "Déployez vos idées librement sur un canvas véritablement infini. Génération et édition d'images de niveau professionnel sans complexité.",
    },
    desktop: {
      title: "Desktop d'abord, entièrement local",
      desc: "Aucune application web à charger, pas de connexion répétée. Une application desktop native qui gère les fichiers locaux et organise les images rapidement et intuitivement.",
    },
  },
  features: {
    title: 'Why BanaNyang?',
    subtitle: "Explorez des idées sur une seule toile et développez-les avec l'IA.",
    canvas: {
      title: 'Infinite Canvas',
      desc: "Placez et explorez des centaines d'images sur une toile infinie sans limites. Zoom, panoramique et navigation parfaitement fluides.",
    },
    aiGen: {
      title: 'AI Generation',
      desc: "Inspirez-vous des références sur votre toile et générez instantanément de nouveaux arts conceptuels. De l'extraction de tenues au transfert de poses en passant par la colorisation automatique.",
    },
    reference: {
      title: 'Reference Board',
      desc: "Collectez instantanément des images web ou des travaux Photoshop via le presse-papiers ou le glisser-déposer. Utilisez-les directement pour la génération IA sur la toile.",
    },
    smartTools: {
      title: 'Smart Tools',
      desc: "Suppression d'arrière-plan, colorisation automatique, extraction de tenues, variations de design — tous les outils IA pour artistes dans un seul espace de travail.",
    },
    noCostAi: {
      title: 'IA Sans Abonnement',
      desc: "Utilisez immédiatement avec votre compte Google personnel — sans frais mensuels. Pour les travaux sensibles, l'intégration du compte Vertex AI est également prise en charge pour les environnements d'entreprise.",
    },
    lightingControl: {
      title: 'Lighting Control',
      tagline: "Contrôlez la direction, l'intensité et la température de couleur de l'éclairage directement sur la toile.",
      desc: "Contrôlez indépendamment la direction de l'éclairage, l'intensité et la température de couleur pour créer exactement l'ambiance souhaitée. Modifiez les angles d'ombre pour une profondeur dramatique, ou réglez la température sur chaud ou froid pour définir le ton émotionnel. Ajustez les intensités de la lumière principale et de remplissage séparément et appliquez des couches d'éclairage indépendantes aux personnages et arrière-plans. Tous les paramètres sont réglables directement sur la toile — sans re-rendu nécessaire.",
    },
    partsCompositing: {
      title: 'Contrôle de Composition par Parties',
      tagline: 'Sélectionnez des parties du corps indépendamment et régénérez uniquement ce dont vous avez besoin — avec précision.',
      desc: "Ciblez visage, haut du corps, bas du corps, mains et pieds indépendamment pour régénérer uniquement les parties nécessaires. Sélectionnez des régions du corps depuis l'onglet concept — le reste du personnage reste intact pendant qu'un masque pixel-précis fusionne les zones générées avec les régions intactes. Itérez sur les détails d'armure, changez les expressions faciales ou échangez des composants de tenue sans redessiner l'illustration complète. Composition précise pour chaque étape de production des personnages.",
    },
  },
  tools: {
    title: 'AI Generation Tools',
    subtitle: "4 outils de génération IA conçus pour les flux de travail des artistes professionnels.\nExécutez-les directement sur la toile.",
    autoColoring: {
      title: 'Colorisation Automatique',
      name: 'Auto Coloring',
      tagline: "Téléchargez le line art et l'IA le colorisera automatiquement.",
      desc: "L'une des tâches les plus chronophages dans l'art conceptuel initial est le coloriage préliminaire. La Colorisation Automatique détecte les zones de cheveux, de peau et de tenue dans votre line art et les colorise naturellement. Idéal pour établir rapidement une ambiance colorée sur des esquisses préliminaires, avec un curseur d'intensité pour ajuster entre automatique complet et coloriage guidé.",
    },
    variation: {
      title: 'Variation de Design',
      name: 'Design Variation',
      tagline: "Explorez des dizaines de variations depuis un seul design.",
      desc: "Avant de finaliser un design de personnage, explorer rapidement différentes directions est essentiel. Générez plusieurs versions avec composition, couleur et détails variés depuis une image existante. Changez la forme de l'armure, essayez des palettes de couleurs ou réarrangez les accessoires — comparez les possibilités générées par l'IA sur votre toile sans dessiner chacune.",
    },
    pose: {
      title: 'Extraction de Pose',
      name: 'Pose Extraction',
      tagline: "Isolez la pose d'une référence et appliquez-la à un nouveau personnage.",
      desc: "Reproduisez n'importe quelle pose avec précision sans 3D. Détecte automatiquement la structure articulaire des images de référence, extrait un squelette, puis génère une nouvelle image d'un personnage différent dans la même pose. Parfait quand vous voulez utiliser la pose d'une photo de référence pour une illustration mais avec votre propre design de personnage.",
    },
    outfit: {
      title: 'Extraction de Tenue',
      name: 'Outfit Extraction',
      tagline: "Séparez la tenue d'un personnage et essayez-la sur différents personnages.",
      desc: "Dans le design de personnages de fantasy et de jeux, les tenues définissent l'identité du personnage. Extrayez la forme et les détails des vêtements (armure, robe, uniforme) des images de référence et composez-les naturellement sur des personnages avec différents types de corps ou poses. Obtenez la réponse à \"À quoi ressemblerait cette tenue sur ce personnage ?\" en 30 secondes.",
    },
  },
  download: {
    title: 'Télécharger BanaNyang',
    subtitle: 'Un achat, sans abonnement',
    version: 'Version',
    released: 'Publié le',
    windows: { label: 'Télécharger pour Windows (.exe)', req: 'Windows 10 64-bit ou version ultérieure' },
    mac: { label: 'Télécharger pour Mac (.dmg)', req: 'macOS 12 Monterey ou version ultérieure' },
    sysReq: 'Configuration Requise',
    requirements: {
      os: 'OS',
      ram: 'RAM',
      gpu: 'GPU',
      storage: 'Stockage',
      windowsVal: 'Windows 10 64-bit ou version ultérieure',
      macVal: 'macOS 12 Monterey ou version ultérieure',
      ramVal: '8 Go de RAM ou plus (16 Go recommandé)',
      gpuVal: 'GPU compatible DirectX 11 / Metal',
      storageVal: "1 Go d'espace libre",
    },
    gate: {
      title: 'Toile Verrouillée',
      subtitle: 'Achetez pour débloquer les téléchargements et toutes les fonctionnalités instantanément.',
      buy: 'Acheter BanaNyang — $19.99',
      buyNote: 'Achat unique · Sans abonnement',
      alreadyBought: 'Déjà acheté ?',
      enterKey: 'Entrer la clé de licence',
      keyPlaceholder: 'XXXX-XXXX-XXXX-XXXX',
      keySubmit: 'Vérifier',
      keyError: 'Clé de licence invalide.',
      unlocked: 'Déverrouillé',
      unlockedNote: 'Vos liens de téléchargement sont maintenant actifs.',
      apiKeyNotice: "La génération IA nécessite votre propre clé API Google ou compte Google Vertex AI. L'achat de l'application seule n'inclut pas la génération IA.",
    },
    changelog: 'Nouveautés',
    changelogItems: [
      'Performances de la toile infinie considérablement améliorées (200+ images)',
      'Stabilité de génération 4K améliorée',
      'Optimisation du rendu WebGL',
      'Précision de colorisation automatique améliorée',
      'Extraction de pose 2× plus rapide',
    ],
  },
  footer: {
    copyright: '© 2025 BanaNyang',
    tos: 'Terms of Service',
    privacy: 'Privacy Policy',
    contact: 'Contact',
  },
  auth: {
    login: 'Se connecter',
    signup: "S'inscrire",
    logout: 'Se déconnecter',
    myAccount: 'Mon Compte',
    email: 'E-mail',
    password: 'Mot de passe',
    name: 'Nom',
    continueWithGoogle: 'Continuer avec Google',
    or: 'ou',
    forgotPassword: 'Mot de passe oublié ?',
    alreadyHaveAccount: 'Vous avez déjà un compte ?',
    noAccount: "Vous n'avez pas de compte ?",
    resetEmailSent: 'E-mail de réinitialisation du mot de passe envoyé. Vérifiez votre boîte de réception.',
    verificationEmailSent: 'E-mail de vérification envoyé. Vérifiez votre boîte de réception.',
    errors: {
      email_in_use: 'Cet e-mail est déjà utilisé.',
      wrong_password: 'E-mail ou mot de passe incorrect.',
      user_not_found: 'Aucun compte trouvé avec cet e-mail.',
      weak_password: 'Le mot de passe doit comporter au moins 6 caractères.',
      invalid_email: 'Veuillez entrer une adresse e-mail valide.',
      unauthorized_domain: "La connexion Google n'est pas autorisée sur ce domaine. Contactez le support.",
      popup_blocked: 'Votre navigateur a bloqué la fenêtre contextuelle. Autorisez les pop-ups et réessayez.',
      network_error: 'Erreur réseau. Vérifiez votre connexion internet et réessayez.',
      config_error: 'Erreur de configuration de connexion. Contactez le support.',
      unknown: 'Une erreur est survenue. Veuillez réessayer.',
    },
  },
  account: {
    title: 'Mon Compte',
    greeting: 'Bonjour',
    purchaseHistory: "Historique d'Achats",
    noPurchases: "Aucun achat pour l'instant.",
    invoice: 'Facture PDF',
    licenseKey: 'Clé de Licence',
    copyKey: 'Copier',
    keyCopied: 'Copié !',
    profile: 'Informations du Compte',
    saveChanges: 'Enregistrer',
    saved: 'Enregistré',
    deviceChangeNotice: "Vous avez changé d'appareil ? Utilisez votre clé de licence sur la page de téléchargement pour réactiver.",
    loading: 'Chargement...',
    loginRequired: 'Vous devez être connecté pour voir cette page.',
  },
  contact: {
    title: 'Nous Contacter',
    subtitle: 'Envoyez-nous vos questions, suggestions ou demandes de collaboration. Nous vous répondrons dans les plus brefs délais.',
    name: 'Nom',
    email: 'E-mail',
    message: 'Message',
    messagePlaceholder: 'Tapez votre message ici...',
    submit: 'Envoyer',
    success: 'Client de messagerie ouvert !',
    successDetail: "Envoyez l'e-mail et nous vous répondrons rapidement.",
    directEmail: 'Nous envoyer un e-mail directement',
  },
  legal: {
    lastUpdated: 'Dernière mise à jour',
  },
  comingSoon: {
    badge: 'Bientôt disponible',
    cardTitle: 'Télécharger BanaNyang',
    cardBody: 'Finition en cours. Lancement imminent.',
    macOptimizing: 'Optimisation pour macOS',
    notifyMe: 'Me notifier',
    notifyPlaceholder: 'your@email.com',
    notifySuccess: '✓ Nous vous préviendrons.',
    notifyAlready: '✓ Vous êtes déjà inscrit.',
    notifyError: 'Veuillez entrer un email valide.',
    notifyServerError: 'Une erreur est survenue. Veuillez réessayer.',
    notifyRateLimited: 'Veuillez patienter avant de réessayer.',
    availableAtLaunch: 'Disponible au lancement',
    tooltip: 'Bientôt disponible',
  },
  featuresPage: {
    title: 'Fonctionnalités & Outils',
    subtitle: "Le flux de travail IA qu'offre BanaNyang",
  },
  changelog: {
    title: 'Journal des mises à jour',
    subtitle: 'Historique des mises à jour de BanaNyang',
    empty: 'Mises à jour à venir',
    emptyDesc: 'Les premières notes de patch seront publiées bientôt.',
    viewDetail: 'Voir les détails',
    close: 'Fermer',
  },
  pricing: {
    title: 'Tarifs',
    lifetimeDesc: "Plus de frais d'abonnement logiciel mensuels. Un seul achat vous donne un accès permanent à l'espace de travail puissant à toile infinie de BanaNyang.",
    notice: {
      title: '💡 À propos de la Génération IA',
      body: "BanaNyang s'intègre directement avec les principaux modèles d'IA mondiaux pour une sortie de meilleure qualité. La fonctionnalité de génération d'images nécessite l'enregistrement de votre propre clé API personnelle ou d'entreprise auprès de chaque plateforme IA (OpenAI, FLUX, etc.). Les coûts des appels API sont facturés séparément selon la politique tarifaire de chaque plateforme. (Vertex AI peut être connecté via le compte de votre organisation.)",
    },
    apiPricingTitle: "Tarification de l'API des modèles IA",
    apiPricingSubtitle: 'Prix par image selon le fournisseur',
    providers: { google: 'Google', openai: 'OpenAI', flux: 'Flux' },
    table: { model: 'Modèle', resolution: 'Résolution', quality: 'Qualité', pricePerImage: 'Prix / image' },
    footnote: {
      gemini: 'Source : Google AI for Developers / Vertex AI Pricing',
      openai: 'Source : OpenAI Pricing',
      flux: 'Source : BFL Pricing — $0.07/MP',
    },
  },
};

export const translations: Record<Locale, Translations> = { ko, en, ja, id, es, fr };
