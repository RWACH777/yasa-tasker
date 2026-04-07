"use client";

import { useState, useEffect } from "react";

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

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setStars(5);
      setComment("");
      setHoverStars(0);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = () => {
    onSubmit(stars, comment);
  };

  return (
    <div className="fixed inset-0 glass-overlay flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-md glass-modal p-6">
        <h2 className="text-2xl font-bold mb-4 glass-text">Rate {otherUserName}</h2>
        <p className="glass-text-muted text-sm mb-6">How was your experience working together?</p>

        {/* Star Rating */}
        <div className="flex justify-center gap-2 mb-6">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onMouseEnter={() => setHoverStars(star)}
              onMouseLeave={() => setHoverStars(0)}
              onClick={() => setStars(star)}
              className="text-3xl transition transform hover:scale-110 glass-text-accent"
              title={`${star} star${star !== 1 ? 's' : ''}`}
            >
              {star <= (hoverStars || stars) ? "⭐" : "☆"}
            </button>
          ))}
        </div>

        {/* Comment */}
        <div className="mb-6">
          <label className="text-xs glass-text-muted block mb-2">Optional Comment</label>
          <textarea
            placeholder="Share your feedback (optional)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="w-full glass-input px-4 py-2 text-sm"
            rows={3}
          />
        </div>

        {/* Buttons */}
        <div className="flex gap-2">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 glass-button px-4 py-2 text-sm disabled:opacity-50"
          >
            Skip
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 glass-button glass-button-primary px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            {loading ? "Submitting..." : "Submit Rating"}
          </button>
        </div>
      </div>
    </div>
  );
}
