"use client";

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
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-md bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">Submit Your Application</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-gray-400 block mb-2">Full Name</label>
            <input
              type="text"
              placeholder="Your name"
              value={formData.name}
              onChange={(e) => onFormChange({ ...formData, name: e.target.value })}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="text-xs text-gray-400 block mb-2">Skills</label>
            <input
              type="text"
              placeholder="e.g., React, Node.js, Design"
              value={formData.skills}
              onChange={(e) => onFormChange({ ...formData, skills: e.target.value })}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="text-xs text-gray-400 block mb-2">Experience</label>
            <input
              type="text"
              placeholder="e.g., 5 years in web development"
              value={formData.experience}
              onChange={(e) => onFormChange({ ...formData, experience: e.target.value })}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="text-xs text-gray-400 block mb-2">Description</label>
            <textarea
              placeholder="Tell the tasker why you're a good fit for this task"
              value={formData.description}
              onChange={(e) => onFormChange({ ...formData, description: e.target.value })}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm"
              rows={3}
            />
          </div>

          <div className="flex gap-2 pt-4">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg transition text-sm"
            >
              Cancel
            </button>
            <button
              onClick={() => onSubmit(formData)}
              className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition text-sm font-semibold"
            >
              Submit
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
