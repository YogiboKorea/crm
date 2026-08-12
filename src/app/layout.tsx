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
  return (
    <html lang="ko">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
