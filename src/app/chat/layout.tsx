'use client';
import ChatSidebar from '@/components/ChatSidebar';
import Navbar from '@/components/Navbar';

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-screen flex flex-col bg-slate-50 text-slate-900 font-sans overflow-hidden">
      <Navbar />
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 flex gap-4 overflow-hidden h-[calc(100vh-64px)]">
        <ChatSidebar />
        {children}
      </div>
    </div>
  );
}
