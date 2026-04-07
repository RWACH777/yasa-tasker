"use client";

import { useState } from "react";

interface ApplicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (form: ApplicationFormData) => void;
  formData: ApplicationFormData;
  onFormChange: (form: ApplicationFormData) => void;
}

export interface ApplicationFormData {
  name: string;
  skills: string;
  experience: string;
  description: string;
}

export default function ApplicationModal({
  isOpen,
  onClose,
  onSubmit,
  formData,
  onFormChange,
}: ApplicationModalProps) {
  const [showError, setShowError] = useState(false);

  if (!isOpen) return null;

  const isFormValid = Object.values(formData).every((value) => value.trim() !== "");

  const handleSubmit = () => {
    if (!isFormValid) {
      setShowError(true);
      return;
    }
    setShowError(false);
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 glass-overlay flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-md glass-modal p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold glass-text">Submit Your Application</h2>
          <button
            onClick={onClose}
            className="glass-close"
          >
            ✕
          </button>
        </div>

        {showError && (
          <div className="mb-4 p-3 glass-button-danger rounded-lg">
            <p className="text-red-200 text-sm font-semibold">⚠️ Please fill in all required fields</p>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="text-xs glass-text-muted block mb-2">Full Name <span className="text-red-300">*</span></label>
            <input
              type="text"
              placeholder="Your name"
              value={formData.name}
              onChange={(e) => {
                onFormChange({ ...formData, name: e.target.value });
                setShowError(false);
              }}
              autoComplete="off"
              className="w-full glass-input px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="text-xs glass-text-muted block mb-2">Skills <span className="text-red-300">*</span></label>
            <input
              type="text"
              placeholder="e.g., React, Node.js, Design"
              value={formData.skills}
              onChange={(e) => {
                onFormChange({ ...formData, skills: e.target.value });
                setShowError(false);
              }}
              className="w-full glass-input px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="text-xs glass-text-muted block mb-2">Experience <span className="text-red-300">*</span></label>
            <input
              type="text"
              placeholder="e.g., 5 years in web development"
              value={formData.experience}
              onChange={(e) => {
                onFormChange({ ...formData, experience: e.target.value });
                setShowError(false);
              }}
              className="w-full glass-input px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="text-xs glass-text-muted block mb-2">Description <span className="text-red-300">*</span></label>
            <textarea
              placeholder="Tell the tasker why you're a good fit for this task"
              value={formData.description}
              onChange={(e) => {
                onFormChange({ ...formData, description: e.target.value });
                setShowError(false);
              }}
              className="w-full glass-input px-3 py-2 text-sm"
              rows={3}
            />
          </div>

          <div className="flex gap-2 pt-4">
            <button
              onClick={onClose}
              className="flex-1 glass-button px-4 py-2 text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!isFormValid}
              className={`flex-1 px-4 py-2 rounded-lg transition text-sm font-semibold ${
                isFormValid ? "glass-button glass-button-success" : "glass-button opacity-50 cursor-not-allowed"
              }`}
            >
              Submit
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
