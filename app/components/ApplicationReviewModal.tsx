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
    <div className="fixed inset-0 glass-overlay flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-2xl glass-modal p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold glass-text">Applications ({applications.length})</h2>
          <button
            onClick={onClose}
            className="glass-close"
          >
            ✕
          </button>
        </div>

        {applications.length === 0 ? (
          <p className="glass-text-muted text-center py-8">No applications yet</p>
        ) : (
          <div className="space-y-4">
            {applications.map((app) => (
              <div
                key={app.id}
                className="glass-panel p-4"
              >
                {/* Applicant Info */}
                <div className="mb-4">
                  <h3 className="text-lg font-semibold glass-text-accent">{app.applicant_name}</h3>
                  <p className="text-sm glass-text mt-1">
                    <span className="font-semibold">Skills:</span> {app.applicant_skills}
                  </p>
                  <p className="text-sm glass-text">
                    <span className="font-semibold">Experience:</span> {app.applicant_experience}
                  </p>
                  <p className="text-sm glass-text mt-2">
                    <span className="font-semibold">Why they're a good fit:</span>
                  </p>
                  <p className="text-sm glass-text-muted mt-1 glass-list-item p-3">
                    {app.applicant_description}
                  </p>
                  <p className="text-xs glass-text-muted opacity-60 mt-2">
                    Applied: {new Date(app.created_at).toLocaleDateString()}
                  </p>
                </div>

                {/* Status Badge */}
                <div className="mb-4">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-sm ${
                      app.status === "approved"
                        ? "glass-button-success"
                        : app.status === "denied"
                        ? "glass-button-danger"
                        : "glass-button"
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
                      className="flex-1 glass-button glass-button-success px-4 py-2 text-sm font-semibold disabled:opacity-50"
                    >
                      ✓ Approve
                    </button>
                    <button
                      onClick={() => onDeny(app.id)}
                      disabled={loading}
                      className="flex-1 glass-button glass-button-danger px-4 py-2 text-sm font-semibold disabled:opacity-50"
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
