"use client";

import { useState } from "react";

interface RatingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (stars: number, comment: string) => void;
  otherUserName: string;
  loading?: boolean;
}

export default function RatingModal({
  isOpen,
  onClose,
  onSubmit,
  otherUserName,
  loading = false,
}: RatingModalProps) {
  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState("");
  const [hoverStars, setHoverStars] = useState(0);

  if (!isOpen) return null;

  const handleSubmit = () => {
    onSubmit(stars, comment);
    setStars(5);
    setComment("");
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-md bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-6">
        <h2 className="text-2xl font-bold mb-4">Rate {otherUserName}</h2>
        <p className="text-gray-300 text-sm mb-6">How was your experience working together?</p>

        {/* Star Rating */}
        <div className="flex justify-center gap-2 mb-6">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onMouseEnter={() => setHoverStars(star)}
              onMouseLeave={() => setHoverStars(0)}
              onClick={() => setStars(star)}
              className="text-3xl transition transform hover:scale-110"
              title={`${star} star${star !== 1 ? 's' : ''}`}
            >
              {star <= (hoverStars || stars) ? "⭐" : "☆"}
            </button>
          ))}
        </div>

        {/* Comment */}
        <div className="mb-6">
          <label className="text-xs text-gray-400 block mb-2">Optional Comment</label>
          <textarea
            placeholder="Share your feedback (optional)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="w-full bg-white/10 border-2 border-white/30 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 caret-white"
            rows={3}
          />
        </div>

        {/* Buttons */}
        <div className="flex gap-2">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg transition text-sm disabled:opacity-50"
          >
            Skip
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition text-sm font-semibold disabled:opacity-50"
          >
            {loading ? "Submitting..." : "Submit Rating"}
          </button>
        </div>
      </div>
    </div>
  );
}
