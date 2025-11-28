"use client";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  return (
    <div
      className={`fixed left-0 top-0 h-screen bg-white/10 backdrop-blur-lg border-r border-white/20 transition-all duration-300 z-40 ${
        isOpen ? "w-80" : "w-0"
      } overflow-hidden`}
    >
      <div className="p-4 space-y-2 h-full flex flex-col">
        <button
          onClick={onClose}
          className="text-right text-gray-400 hover:text-white text-2xl mb-2"
        >
          ✕
        </button>

        <div>
          <h3 className="text-lg font-semibold mb-3">💬 Messages</h3>
          <a
            href="/messages"
            onClick={onClose}
            className="w-full px-4 py-2 bg-purple-600/80 hover:bg-purple-700 rounded-lg transition text-sm block text-center"
          >
            View All Messages
          </a>
        </div>

        <div className="mt-2">
          <h3 className="text-lg font-semibold mb-3">📞 Support</h3>
          <a
            href="mailto:YasaTasker@gmail.com"
            className="w-full px-4 py-2 bg-blue-600/80 hover:bg-blue-700 rounded-lg transition text-sm block text-center"
          >
            Contact Support
          </a>
        </div>
      </div>
    </div>
  );
}
