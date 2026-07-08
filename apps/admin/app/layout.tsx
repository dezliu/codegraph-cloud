import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CodeGraph Cloud - Admin',
  description: 'Manage your code graph projects',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen flex">
          {/* Sidebar */}
          <aside className="w-64 bg-gray-900 text-white p-4">
            <h1 className="text-xl font-bold mb-8">CodeGraph Cloud</h1>
            <nav className="space-y-2">
              <a href="/projects" className="block px-4 py-2 rounded hover:bg-gray-800">
                Projects
              </a>
              <a href="/settings" className="block px-4 py-2 rounded hover:bg-gray-800">
                Settings
              </a>
            </nav>
          </aside>
          
          {/* Main content */}
          <main className="flex-1 p-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
