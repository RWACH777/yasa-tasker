"use client";

import { useState } from "react";

export default function TestInputPage() {
  const [text, setText] = useState("");

  return (
    <div className="min-h-screen bg-[#000222] text-white p-8">
      <div className="max-w-md mx-auto space-y-6">
        <h1 className="text-3xl font-bold">Input Test Page</h1>
        
        {/* Test 1: Basic input */}
        <div>
          <h2 className="text-xl font-semibold mb-2">Test 1: Basic Input</h2>
          <input
            type="text"
            placeholder="Type here..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full bg-white/10 border-2 border-white/30 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 caret-white pointer-events-auto"
          />
          <p className="text-sm text-gray-400 mt-2">Value: {text}</p>
        </div>

        {/* Test 2: Textarea */}
        <div>
          <h2 className="text-xl font-semibold mb-2">Test 2: Textarea</h2>
          <textarea
            placeholder="Type here..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full bg-white/10 border-2 border-white/30 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 caret-white pointer-events-auto"
            rows={3}
          />
          <p className="text-sm text-gray-400 mt-2">Value: {text}</p>
        </div>

        {/* Test 3: Select */}
        <div>
          <h2 className="text-xl font-semibold mb-2">Test 3: Select</h2>
          <select
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full bg-white/10 border-2 border-white/30 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pointer-events-auto"
          >
            <option value="">Select an option</option>
            <option value="option1">Option 1</option>
            <option value="option2">Option 2</option>
            <option value="option3">Option 3</option>
          </select>
          <p className="text-sm text-gray-400 mt-2">Value: {text}</p>
        </div>

        {/* Test 4: Input without pointer-events-auto */}
        <div>
          <h2 className="text-xl font-semibold mb-2">Test 4: Input (no pointer-events-auto)</h2>
          <input
            type="text"
            placeholder="Type here..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full bg-white/10 border-2 border-white/30 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 caret-white"
          />
          <p className="text-sm text-gray-400 mt-2">Value: {text}</p>
        </div>

        {/* Test 5: Simple input */}
        <div>
          <h2 className="text-xl font-semibold mb-2">Test 5: Simple Input</h2>
          <input
            type="text"
            placeholder="Type here..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full px-4 py-2 text-black"
          />
          <p className="text-sm text-gray-400 mt-2">Value: {text}</p>
        </div>
      </div>
    </div>
  );
}
