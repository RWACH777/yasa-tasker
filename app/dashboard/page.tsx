"use client";

import React, { useState } from "react";
import { Bell, Menu, LogOut } from "lucide-react";

export default function DashboardPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#000222] via-black to-[#000222] text-white flex">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0 fixed lg:static z-40 h-full w-64 bg-white/10 backdrop-blur-xl border-r border-white/10 transition-transform duration-300`}
      >
        <div className="flex flex-col h-full p-4">
          <h1 className="text-2xl font-bold mb-6 text-center">YASA TASKER</h1>

          <nav className="flex-1 space-y-2">
            <button className="w-full text-left px-4 py-2 rounded-lg bg-white/5 hover:bg-white/15 transition">
              Dashboard
            </button>
            <button className="w-full text-left px-4 py-2 rounded-lg hover:bg-white/10 transition">
              My Tasks
            </button>
            <button className="w-full text-left px-4 py-2 rounded-lg hover:bg-white/10 transition">
              Create Task
            </button>
            <button className="w-full text-left px-4 py-2 rounded-lg hover:bg-white/10 transition">
              Wallet
            </button>
            <button className="w-full text-left px-4 py-2 rounded-lg hover:bg-white/10 transition">
              Settings
            </button>
          </nav>

          <button className="mt-auto flex items-center justify-center gap-2 px-4 py-2 bg-white/10 rounded-lg hover:bg-white/20 transition">
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/5 backdrop-blur-xl sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden p-2 rounded-lg bg-white/10 hover:bg-white/20"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              <Menu size={20} />
            </button>
            <h2 className="text-lg font-semibold">Dashboard Overview</h2>
          </div>
          <div className="flex items-center gap-4">
            <button className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition">
              <Bell size={18} />
            </button>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500"></div>
          </div>
        </header>

        {/* Dashboard Body */}
        <main className="flex-1 p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {/* Example Card */}
          <div className="bg-white/10 backdrop-blur-xl p-5 rounded-2xl border border-white/10 shadow-lg hover:bg-white/15 transition">
            <h3 className="text-lg font-semibold mb-2">Active Tasks</h3>
            <p className="text-sm text-gray-300">
              View and manage the tasks you’re currently working on.
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-xl p-5 rounded-2xl border border-white/10 shadow-lg hover:bg-white/15 transition">
            <h3 className="text-lg font-semibold mb-2">Completed Tasks</h3>
            <p className="text-sm text-gray-300">
              See all your previously completed tasks and reviews.
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-xl p-5 rounded-2xl border border-white/10 shadow-lg hover:bg-white/15 transition">
            <h3 className="text-lg font-semibold mb-2">Wallet Balance</h3>
            <p className="text-sm text-gray-300">
              Track your Pi earnings and manage transactions securely.
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-xl p-5 rounded-2xl border border-white/10 shadow-lg hover:bg-white/15 transition">
            <h3 className="text-lg font-semibold mb-2">New Opportunities</h3>
            <p className="text-sm text-gray-300">
              Browse available tasks to earn more Pi.
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-xl p-5 rounded-2xl border border-white/10 shadow-lg hover:bg-white/15 transition">
            <h3 className="text-lg font-semibold mb-2">Leaderboard</h3>
            <p className="text-sm text-gray-300">
              See the top contributors in the Yasa Tasker community.
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-xl p-5 rounded-2xl border border-white/10 shadow-lg hover:bg-white/15 transition">
            <h3 className="text-lg font-semibold mb-2">Support</h3>
            <p className="text-sm text-gray-300">
              Get help or contact the Yasa Tasker support team anytime.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}