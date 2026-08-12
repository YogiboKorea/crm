import './styles.css';

export const metadata = {
  title: 'Yogico CRM',
  description: 'K-beauty B2B outreach pipeline',
};

// 다크모드 초기화 스크립트 — <head> 안에서 실행되어 FOUC 방지
// localStorage.theme 우선, 없으면 시스템 prefers-color-scheme
const themeInitScript = `
(function() {
  try {
    var stored = localStorage.getItem('theme');
    var theme = stored || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'light');
  }
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // suppressHydrationWarning: 인라인 themeInitScript 가 React hydrate 전에
  // <html> 에 data-theme 을 심음 → 서버 HTML 과 클라이언트 tree 미스매치가 의도된 것.
  // <body> 에도 붙임 — 브라우저 확장 (Grammarly 등) 이 body 속성 추가하는 케이스 방어.
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
