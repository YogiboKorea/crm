/**
 * 검증완료 리드 tier 등급 (A/B/C).
 * A: AI 통과 + 이메일 + 사이트 + 대형 리테일러/체인 (최우선 컨택 타깃)
 * B: AI 통과 + 이메일 + 사이트 (일반 B2B 타깃)
 * C: AI 통과만 (사이트 없거나 이메일 자신감 낮음)
 */

// 대형 리테일러 · 체인 · 유통사 키워드 (회사명 / 도메인 매칭 · 소문자 substring)
export const MAJOR_RETAILERS: string[] = [
  // Global chains
  'sephora', 'ulta', 'walmart', 'target', 'costco', 'amazon',
  'boots', 'superdrug', 'watsons', 'as watson', 'mannings',
  'douglas', 'nocibe', 'marionnaud', 'kruidvat',
  'dm-drogerie', 'dm drogerie', 'rossmann', 'muller', 'müller',
  'etos', 'trekpleister', 'ici paris', 'iciparisxl',
  // Department stores
  'harrods', 'selfridges', 'liberty', 'harvey nichols',
  'el corte ingles', 'el corte inglés',
  'galeries lafayette', 'printemps', 'kadewe',
  'la rinascente', 'la redoute',
  // Korea
  'shinsegae', 'lotte', 'olive young', 'chicor', 'aritaum',
  'hyundai department',
  // India / SEA / MEA
  'nykaa', 'purplle', 'tira', 'reliance', 'shoppers stop',
  'sociolla', 'cosrx', 'watson', 'guardian',
  // JP
  'matsumotokiyoshi', 'matsukiyo', 'welcia',
  'ainz', 'tsuruha', 'sundrug', 'tokyu hands', 'loft',
  // MENA
  'faces', 'sephora middle east', 'gulf',
  // Online pure-play
  'asos', 'cult beauty', 'lookfantastic', 'feelunique',
  'beauty bay', 'mecca', 'adore beauty',
  'yesstyle', 'stylekorean', 'jolse', 'stylevana',
  // LatAm
  'falabella', 'liverpool', 'palacio de hierro',
  // Distributors — beauty focus
  'beauty distributor', 'beauty wholesaler', 'cosmetics distributor',
];

const REAL_EMAIL_RE = /@/;

function isMajorRetailer(company: string, website: string): boolean {
  const c = (company || '').toLowerCase();
  const w = (website || '').toLowerCase();
  return MAJOR_RETAILERS.some((kw) => c.includes(kw) || w.includes(kw));
}

function hasRealEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  const e = String(email).trim();
  if (!e) return false;
  if (/^not found/i.test(e)) return false;
  return REAL_EMAIL_RE.test(e);
}

function hasWebsite(url: string | undefined | null): boolean {
  const s = (url || '').toString().trim();
  if (!s) return false;
  return /^https?:\/\/|^www\.|\.(com|net|org|co|io|kr|jp|de|fr|uk|es|it|ru|au|nl|pl|tr|sa|ae|hk|sg|my|vn|th|id|ph|in|br|mx|ar|ca)($|\/)/i.test(s);
}

export type LeadTier = 'A' | 'B' | 'C';

export interface LeadTierInput {
  Company?: string;
  Email?: string;
  WebsiteContact?: string;
}

export function getLeadTier(lead: LeadTierInput): LeadTier {
  const email = hasRealEmail(lead.Email);
  const site = hasWebsite(lead.WebsiteContact);
  if (!email) return 'C';
  if (!site) return 'C';
  if (isMajorRetailer(lead.Company || '', lead.WebsiteContact || '')) return 'A';
  return 'B';
}
