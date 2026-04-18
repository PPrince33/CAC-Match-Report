import './globals.css'

export const metadata = {
  title: 'CAC Match Report',
  description: 'CAC Analytics Platform',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
