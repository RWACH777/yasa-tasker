"use client";

import Link from "next/link";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onNotificationsClick?: () => void;
  notificationCount?: number;
  messageCount?: number;
  transactionCount?: number;
}

export default function Sidebar({ isOpen, onClose, onNotificationsClick, notificationCount = 0, messageCount = 0, transactionCount = 0 }: SidebarProps) {
  return (
    <div
      className={`fixed left-0 top-0 h-screen glass-nav transition-all duration-300 z-40 ${
        isOpen ? "w-80" : "w-0"
      } overflow-hidden`}
    >
      <div className="p-4 space-y-2 h-full flex flex-col">
        <button
          onClick={onClose}
          className="glass-close ml-auto mb-2"
        >
          ✕
        </button>

        <div className="glass-panel p-4">
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-lg font-semibold glass-text">Messages</h3>
            {messageCount > 0 && (
              <span className="glass-badge text-white text-xs font-bold w-6 h-6 flex items-center justify-center">
                {messageCount}
              </span>
            )}
          </div>
          <a
            href="/messages"
            onClick={onClose}
            className="glass-button glass-button-primary w-full px-4 py-2 text-sm block text-center"
          >
            View All Messages
          </a>
        </div>

        <div className="glass-panel p-4">
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-lg font-semibold glass-text">Payments</h3>
            {transactionCount > 0 && (
              <span className="glass-badge text-white text-xs font-bold w-6 h-6 flex items-center justify-center">
                {transactionCount}
              </span>
            )}
          </div>
          <Link
            href="/payments"
            onClick={onClose}
            className="glass-button w-full px-4 py-2 text-sm block text-center"
          >
            View Transactions
          </Link>
        </div>

        <div className="glass-panel p-4">
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-lg font-semibold glass-text">Notifications</h3>
            {notificationCount > 0 && (
              <span className="glass-badge text-white text-xs font-bold w-6 h-6 flex items-center justify-center">
                {notificationCount}
              </span>
            )}
          </div>
          <Link
            href="/notifications"
            onClick={onClose}
            className="glass-button w-full px-4 py-2 text-sm block text-center"
          >
            View All Notifications
          </Link>
        </div>

        <div className="glass-panel p-4">
          <h3 className="text-lg font-semibold glass-text mb-3">Membership</h3>
          <Link
            href="/membership"
            onClick={onClose}
            className="glass-button w-full px-4 py-2 text-sm block text-center"
          >
            View Membership
          </Link>
        </div>

        <div className="glass-panel p-4">
          <h3 className="text-lg font-semibold glass-text mb-3">Support</h3>
          <a
            href="mailto:YasaTasker@gmail.com"
            className="glass-button w-full px-4 py-2 text-sm block text-center"
          >
            Contact Support
          </a>
        </div>
      </div>
    </div>
  );
}
