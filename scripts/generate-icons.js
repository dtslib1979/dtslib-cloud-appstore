const sharp = require('sharp');
const path = require('path');

// 현대적인 앱 스토어 스타일 아이콘 SVG
// 그라데이션 배경 + 4개 앱 그리드 패턴
const createIconSVG = (size) => `
<svg width="${size}" height="${size}" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- 메인 그라데이션: 보라-파랑-핑크 -->
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#667eea"/>
      <stop offset="50%" style="stop-color:#764ba2"/>
      <stop offset="100%" style="stop-color:#f093fb"/>
    </linearGradient>

    <!-- 앱 타일 그라데이션들 -->
    <linearGradient id="tile1" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#FF6B6B"/>
      <stop offset="100%" style="stop-color:#FF8E53"/>
    </linearGradient>
    <linearGradient id="tile2" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#4ECDC4"/>
      <stop offset="100%" style="stop-color:#44A08D"/>
    </linearGradient>
    <linearGradient id="tile3" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#A8E6CF"/>
      <stop offset="100%" style="stop-color:#88D8B0"/>
    </linearGradient>
    <linearGradient id="tile4" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#FFD93D"/>
      <stop offset="100%" style="stop-color:#FF6B6B"/>
    </linearGradient>
  </defs>

  <!-- 배경 (둥근 사각형) -->
  <rect x="0" y="0" width="512" height="512" rx="100" ry="100" fill="url(#bgGrad)"/>

  <!-- 4개 앱 타일 그리드 -->
  <g transform="translate(96, 96)">
    <!-- 좌상단 -->
    <rect x="0" y="0" width="140" height="140" rx="28" ry="28" fill="url(#tile1)"/>
    <!-- 우상단 -->
    <rect x="180" y="0" width="140" height="140" rx="28" ry="28" fill="url(#tile2)"/>
    <!-- 좌하단 -->
    <rect x="0" y="180" width="140" height="140" rx="28" ry="28" fill="url(#tile3)"/>
    <!-- 우하단 -->
    <rect x="180" y="180" width="140" height="140" rx="28" ry="28" fill="url(#tile4)"/>
  </g>

  <!-- 미묘한 광택 효과 -->
  <rect x="0" y="0" width="512" height="256" rx="100" ry="100" fill="white" opacity="0.08"/>
</svg>
`;

// Apple Touch Icon용 (iOS는 자동으로 둥글게 처리)
const createAppleTouchIconSVG = () => `
<svg width="180" height="180" viewBox="0 0 180 180" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#667eea"/>
      <stop offset="50%" style="stop-color:#764ba2"/>
      <stop offset="100%" style="stop-color:#f093fb"/>
    </linearGradient>
    <linearGradient id="t1" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#FF6B6B"/>
      <stop offset="100%" style="stop-color:#FF8E53"/>
    </linearGradient>
    <linearGradient id="t2" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#4ECDC4"/>
      <stop offset="100%" style="stop-color:#44A08D"/>
    </linearGradient>
    <linearGradient id="t3" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#A8E6CF"/>
      <stop offset="100%" style="stop-color:#88D8B0"/>
    </linearGradient>
    <linearGradient id="t4" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#FFD93D"/>
      <stop offset="100%" style="stop-color:#FF6B6B"/>
    </linearGradient>
  </defs>

  <!-- 배경 -->
  <rect width="180" height="180" fill="url(#bgGrad2)"/>

  <!-- 4개 앱 타일 -->
  <g transform="translate(30, 30)">
    <rect x="0" y="0" width="52" height="52" rx="10" fill="url(#t1)"/>
    <rect x="68" y="0" width="52" height="52" rx="10" fill="url(#t2)"/>
    <rect x="0" y="68" width="52" height="52" rx="10" fill="url(#t3)"/>
    <rect x="68" y="68" width="52" height="52" rx="10" fill="url(#t4)"/>
  </g>

  <rect width="180" height="90" fill="white" opacity="0.08"/>
</svg>
`;

async function generateIcons() {
  const assetsDir = path.join(__dirname, '..', 'assets');

  // 생성할 아이콘 사이즈
  const sizes = [
    { name: 'favicon-16.png', size: 16 },
    { name: 'favicon-32.png', size: 32 },
    { name: 'icon-192.png', size: 192 },
    { name: 'icon-512.png', size: 512 },
  ];

  console.log('🎨 Generating modern app store icons...\n');

  for (const { name, size } of sizes) {
    const svg = Buffer.from(createIconSVG(size));
    await sharp(svg)
      .resize(size, size)
      .png()
      .toFile(path.join(assetsDir, name));
    console.log(`✓ ${name} (${size}x${size})`);
  }

  // Apple Touch Icon (180x180)
  const appleSvg = Buffer.from(createAppleTouchIconSVG());
  await sharp(appleSvg)
    .resize(180, 180)
    .png()
    .toFile(path.join(assetsDir, 'apple-touch-icon.png'));
  console.log('✓ apple-touch-icon.png (180x180)');

  console.log('\n✅ All icons generated successfully!');
}

generateIcons().catch(console.error);
