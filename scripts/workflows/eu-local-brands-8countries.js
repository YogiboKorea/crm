
export const meta = {
  name: 'eu-local-brands-scale',
  description: 'B 유형 확대 — 유럽 로컬 화장품 브랜드·제조사 300건+ (dermaofficial 유형)',
  phases: [
    { title: 'Search', detail: '20개국 × 세부유형 다국어 검색' },
    { title: 'Verify', detail: '사이트 확인 + B2B 연락처 추출' },
  ],
}

// 파일럿에서 B 검색 전략이 검증됨 (124건 전원 K-뷰티 미취급).
// 이번엔 국가를 20개로 넓히고, 세부 유형을 나눠 겹치지 않게 뽑는다.
const SUBTYPES = [
  {
    key: 'derma',
    label: '더마·약국화장품 제조사',
    hint: '피부과학 기반 스킨케어 제조사 · 약국 유통 브랜드(pharmacy/parapharmacie). 예: Sebapharma(sebamed), Dr.Grandel, Dr.Spiller 유형.',
    terms: ['dermocosmetics manufacturer', 'pharmacy skincare brand', 'dermatological skincare company'],
  },
  {
    key: 'natural',
    label: '천연·유기농 화장품 제조사',
    hint: '인증 천연화장품(NATRUE·COSMOS·Ecocert) 자체 생산사. 예: lavera(Laverana), PRIMAVERA, Speick, WALA(Dr.Hauschka) 유형.',
    terms: ['organic cosmetics manufacturer', 'natural skincare producer', 'certified natural cosmetics brand'],
  },
  {
    key: 'proline',
    label: '전문가용·에스테틱 브랜드',
    hint: '살롱·스파·에스테틱 채널 전용 브랜드 제조사. 예: BABOR, Dr.Spiller 유형. B2B 파트너 포털을 운영하는 곳이 많다.',
    terms: ['professional skincare brand salon', 'spa cosmetics manufacturer', 'esthetician skincare supplier'],
  },
  {
    key: 'privatelabel',
    label: 'OEM·ODM·프라이빗라벨 제조사',
    hint: '타사 브랜드를 위탁 생산하는 화장품 제조사. 한국 원료·기술 공급 대상으로 가치가 높다.',
    terms: ['private label cosmetics manufacturer', 'contract manufacturer cosmetics', 'OEM ODM skincare Europe'],
  },
]

const REGIONS = [
  { c: 'Germany', local: ['Kosmetik Hersteller', 'Naturkosmetik Produzent', 'Lohnhersteller Kosmetik'] },
  { c: 'France', local: ['fabricant cosmétique', 'laboratoire cosmétique', 'façonnier cosmétique'] },
  { c: 'Italy', local: ['produttore cosmetici', 'laboratorio cosmetico', 'conto terzi cosmetica'] },
  { c: 'Spain', local: ['fabricante cosmética', 'laboratorio cosmético', 'marca blanca cosmética'] },
  { c: 'United Kingdom', local: ['skincare manufacturer UK', 'British skincare brand', 'cosmetics contract manufacturer UK'] },
  { c: 'Netherlands', local: ['cosmetica fabrikant', 'huidverzorging merk', 'private label cosmetica'] },
  { c: 'Poland', local: ['producent kosmetyków', 'kosmetyki naturalne producent', 'marka własna kosmetyki'] },
  { c: 'Sweden', local: ['hudvård tillverkare', 'svensk hudvårdsmärke'] },
]
// 50분 안에 이메일까지 확보하려고 8개국으로 좁혔다.
// 파일럿 실측상 이 8개국이 B 유형(로컬 브랜드·제조사)의 대부분을 차지했고,
// 노르웨이·핀란드는 각 2~3건이라 시간 대비 효율이 낮았다.
// 앞선 실행에서 독일·프랑스·이탈리아·스페인·영국·네덜란드 24개 검색이 이미 끝나
// 캐시에서 즉시 재생되므로, 실제로 새로 도는 것은 폴란드·스웨덴 8개뿐이다.
// 나머지 12개국은 이 목록에 되돌려 놓고 다시 돌리면 이어서 수집된다.

const SEARCH_SCHEMA = {
  type: 'object',
  properties: {
    candidates: {
      type: 'array',
      description: '해당 국가·유형의 회사 8개 이상',
      items: {
        type: 'object',
        properties: {
          Company: { type: 'string', description: '공식 회사명만. 부연설명·주소·등기번호를 붙이지 말 것' },
          Country: { type: 'string', description: '국가명 하나만 (영문). 괄호·주소·부연설명 금지' },
          WebsiteContact: { type: 'string', description: '공식 사이트 URL 하나만 (https:// 포함). 여러 개 나열 금지' },
          Type: { type: 'string', description: 'Manufacturer 또는 Brand' },
          OwnBrands: { type: 'string', description: '보유한 자체 브랜드명' },
          Scale: { type: 'string', description: '설립연도·직원수·수출국수 등 아는 범위' },
          Evidence: { type: 'string', description: '자체 생산·자체 브랜드 근거 한 문장' },
        },
        required: ['Company', 'Country', 'WebsiteContact'],
      },
    },
  },
  required: ['candidates'],
}

phase('Search')

const tasks = []
for (const r of REGIONS) {
  for (const st of SUBTYPES) tasks.push({ r, st })
}

const searched = await parallel(tasks.map((t) => () =>
  agent(
    `당신은 한국 화장품 수출사(요기코)의 B2B 리드 리서처입니다.
요기코는 유럽 화장품 회사에 한국 제품·원료·OEM 을 공급하려 합니다.
따라서 **아직 한국 브랜드를 취급하지 않는** 유럽 로컬 회사가 표적입니다.

목표: **${t.r.c}** 소재의 **${t.st.label}** 회사를 8개 이상 찾으세요.

유형 설명: ${t.st.hint}

검색어 (영어 + 현지어 모두 시도하세요):
${t.st.terms.map((x) => `  · "${x} ${t.r.c}"`).join('\n')}
${t.r.local.map((x) => `  · "${x}"`).join('\n')}
추가로 스스로 3개 이상 변형 검색어를 만들어 시도하세요.

포함 기준:
  ✓ 자체 브랜드를 보유하거나 자체 생산시설이 있는 회사
  ✓ 공식 웹사이트가 있는 실존 법인
  ✓ 한국 브랜드를 취급하지 않는 로컬 회사 (오히려 이런 곳을 찾습니다)

제외 기준:
  ✗ K-뷰티 유통사·한국 화장품 판매점 (이미 확보했습니다)
  ✗ 단순 소매점·편집숍 (제조나 자체 브랜드가 없는 곳)
  ✗ 마켓플레이스 상품페이지·뉴스기사·블로그·리스트 기사

⚠️ 출력 형식 주의 — 데이터가 그대로 CRM 에 들어갑니다:
  · Company: 회사명만. "Beiersdorf AG" (O) / "Beiersdorf AG — NIVEA 보유, 1882년 함부르크 설립, HRB 12345" (X)
  · Country: 국가명 하나만. "Germany" (O) / "Germany (HQ: Hamburg, VAT DE123...)" (X)
  · WebsiteContact: URL 하나만. "https://www.beiersdorf.com" (O) / "https://a.com / https://b.com (설명)" (X)
  · 부연설명은 Evidence·Scale·OwnBrands 필드에 넣으세요.

**8개 이상 필수.** 못 채우면 검색어를 넓히세요.`,
    { phase: 'Search', schema: SEARCH_SCHEMA, label: `${t.st.key}:${t.r.c.slice(0, 10)}`, agentType: 'general-purpose' },
  ).then((res) => ({ sub: t.st.key, subLabel: t.st.label, candidates: res?.candidates || [] }))
   .catch(() => null),
))

const seen = new Map()
for (const s of searched.filter(Boolean)) {
  for (const c of s.candidates) {
    const key = String(c.WebsiteContact || '').toLowerCase()
      .replace(/^https?:\/\/(www\.)?/, '').replace(/\/.*$/, '')
    if (!key) continue
    if (!seen.has(key)) seen.set(key, { ...c, _sub: s.sub, _subLabel: s.subLabel })
  }
}
const unique = Array.from(seen.values())
log(`후보 ${unique.length}개 (${tasks.length}개 검색: ${REGIONS.length}개국 × ${SUBTYPES.length}유형)`)

phase('Verify')

const VERIFY_SCHEMA = {
  type: 'object',
  properties: {
    Company: { type: 'string', description: '공식 회사명만 (부연설명 금지)' },
    Country: { type: 'string', description: '국가명 하나만' },
    WebsiteContact: { type: 'string', description: '공식 사이트 URL 하나만' },
    Email: { type: 'string', description: 'B2B 이메일 우선(export/wholesale/b2b/partner/sales/info). noreply 제외. 없으면 빈 문자열' },
    Phone: { type: 'string' },
    Type: { type: 'string', description: 'Manufacturer 또는 Brand' },
    OwnBrands: { type: 'string', description: '보유 자체 브랜드' },
    Scale: { type: 'string', description: '설립연도·직원수·수출국수·생산시설' },
    HasB2BPortal: { type: 'boolean', description: '파트너/도매/B2B 전용 페이지가 있는지' },
    CarriesKBeauty: { type: 'string', description: 'yes / no / unknown — 한국 브랜드 취급 여부' },
    Evidence: { type: 'string', description: '사이트에서 확인한 사업 내용 한 문장' },
    isValid: { type: 'boolean', description: '자체 브랜드/제조 기반의 실존 화장품 회사이고 사이트가 살아있는지' },
  },
  required: ['Company', 'WebsiteContact', 'isValid'],
}

const verified = await parallel(unique.map((c) => () =>
  agent(
    `당신은 B2B 리드 검증 리서처입니다.

대상: ${c.WebsiteContact}
힌트 — 회사명="${c.Company}", 국가="${c.Country}", 유형="${c._subLabel}", 자체브랜드="${c.OwnBrands || ''}"

작업:
1. WebFetch 로 사이트 방문. 접근 불가·404·빈 도메인이면 isValid=false 반환 후 종료.
2. 필요시 /about, /contact, /company, /b2b, /wholesale, /partners, /impressum 추가 확인 (최대 3페이지).
3. 추출:
   - Company(공식 법인명), Country(본사 소재국), Email(B2B용 우선), Phone
   - Type: Manufacturer(자체 생산시설 보유) 또는 Brand(자체 브랜드 보유)
   - OwnBrands: 보유 브랜드명
   - Scale: 설립연도·직원수·수출국수·생산시설 위치
   - HasB2BPortal: 파트너/도매/B2B 페이지 존재 여부
   - CarriesKBeauty: 한국 브랜드(COSRX, Beauty of Joseon, Anua, Laneige, Innisfree 등)가 보이면 yes,
     명확히 자사 브랜드만 취급하면 no, 판단 어려우면 unknown
4. isValid: 자체 브랜드나 자체 생산 기반의 실존 화장품 회사면 true.
   단순 소매점·K-뷰티 판매점이면 false.

⚠️ Company/Country/WebsiteContact 는 값 하나만. 부연설명은 Evidence·Scale 로.
빈 값은 "" 로. null 금지.`,
    { phase: 'Verify', schema: VERIFY_SCHEMA, label: `v:${String(c.WebsiteContact || '').replace(/^https?:\/\/(www\.)?/, '').slice(0, 30)}`, agentType: 'general-purpose' },
  ).then((v) => (v ? { ...v, _sub: c._sub, _subLabel: c._subLabel } : null))
   .catch(() => null),
))

const good = verified.filter(Boolean).filter((v) => v.isValid && v.Company)
const newProspects = good.filter((v) => v.CarriesKBeauty !== 'yes')

const bySub = {}
for (const g of good) {
  bySub[g._sub] = bySub[g._sub] || []
  bySub[g._sub].push(g)
}
const summary = Object.keys(bySub).map((k) => ({
  subtype: k,
  label: bySub[k][0]?._subLabel || k,
  count: bySub[k].length,
  withEmail: bySub[k].filter((x) => x.Email).length,
  withB2BPortal: bySub[k].filter((x) => x.HasB2BPortal).length,
  alreadyKBeauty: bySub[k].filter((x) => x.CarriesKBeauty === 'yes').length,
}))

log(`검증 통과 ${good.length}개 · 신규 개척 대상(K뷰티 미취급) ${newProspects.length}개`)

return {
  searched: tasks.length,
  rawUnique: unique.length,
  validCount: good.length,
  newProspectCount: newProspects.length,
  summary,
  candidates: good,
}
