import './globals.css';

export const metadata = {
  title: 'The Open Pick 3 Live',
  description: 'Live Pick 3 golf pool leaderboard for The Open Championship.'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
