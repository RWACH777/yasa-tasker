"use client";

interface Application {
  id: string;
  task_id: string;
  applicant_id: string;
  applicant_name: string;
  applicant_skills: string;
  applicant_experience: string;
  applicant_description: string;
  status: string;
  created_at: string;
}

interface ApplicationReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  applications: Application[];
  onApprove: (applicationId: string, applicantId: string) => void;
  onDeny: (applicationId: string) => void;
  loading?: boolean;
}

export default function ApplicationReviewModal({
  isOpen,
  onClose,
  applications,
  onApprove,
  onDeny,
  loading = false,
}: ApplicationReviewModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-2xl bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Applications ({applications.length})</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl"
          >
            ✕
          </button>
        </div>

        {applications.length === 0 ? (
          <p className="text-gray-400 text-center py-8">No applications yet</p>
        ) : (
          <div className="space-y-4">
            {applications.map((app) => (
              <div
                key={app.id}
                className="bg-white/5 border border-white/10 rounded-lg p-4"
              >
                {/* Applicant Info */}
                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-blue-400">{app.applicant_name}</h3>
                  <p className="text-sm text-gray-300 mt-1">
                    <span className="font-semibold">Skills:</span> {app.applicant_skills}
                  </p>
                  <p className="text-sm text-gray-300">
                    <span className="font-semibold">Experience:</span> {app.applicant_experience}
                  </p>
                  <p className="text-sm text-gray-300 mt-2">
                    <span className="font-semibold">Why they're a good fit:</span>
                  </p>
                  <p className="text-sm text-gray-400 mt-1 bg-white/5 p-3 rounded border border-white/10">
                    {app.applicant_description}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    Applied: {new Date(app.created_at).toLocaleDateString()}
                  </p>
                </div>

                {/* Status Badge */}
                <div className="mb-4">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      app.status === "approved"
                        ? "bg-green-600/30 text-green-300"
                        : app.status === "denied"
                        ? "bg-red-600/30 text-red-300"
                        : "bg-yellow-600/30 text-yellow-300"
                    }`}
                  >
                    {app.status.charAt(0).toUpperCase() + app.status.slice(1)}
                  </span>
                </div>

                {/* Action Buttons */}
                {app.status === "pending" && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => onApprove(app.id, app.applicant_id)}
                      disabled={loading}
                      className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded-lg transition text-sm font-semibold"
                    >
                      ✓ Approve
                    </button>
                    <button
                      onClick={() => onDeny(app.id)}
                      disabled={loading}
                      className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg transition text-sm font-semibold"
                    >
                      ✕ Deny
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
