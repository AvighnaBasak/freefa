import './globals.css'
import Providers from '@/components/Providers'
import Navbar from '@/components/Navbar'

export const metadata = {
  title: 'FREEFA — World Cup 2026 Live Hub',
  description: 'FREEFA: FIFA World Cup 2026 live streams, scores, stats and group standings.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <Navbar />
          <main>
            {children}
          </main>
        </Providers>
      </body>
    </html>
  )
}
