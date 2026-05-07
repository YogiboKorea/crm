import './styles.css';

export const metadata = {
  title: 'Yogico Beauty Buyers CRM',
  description: 'Importer & buyer pipeline',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
