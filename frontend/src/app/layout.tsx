import type { Metadata } from 'next'
import './globals.css'
import { GlobalBackground } from '@/components/GlobalBackground'

export const metadata: Metadata = {
  title: 'Reprova — See beyond the paper.',
  description: 'AI-powered ML paper reproducibility platform connecting research claims, code repositories, implementation evidence, and reproduced results.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark scroll-smooth bg-black">
      <body className="bg-black text-neutral-100 antialiased min-h-screen flex flex-col font-sans selection:bg-white/20 selection:text-white relative">
        {/* Global fixed background layer + sparkles overlay across all pages */}
        <GlobalBackground />
        {children}
      </body>
    </html>
  )
}
