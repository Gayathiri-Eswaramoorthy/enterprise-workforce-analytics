import React, { useCallback, useEffect, useState } from "react";
import api, { getErrorMessage } from "../services/api";
import { useAuth } from "../hooks/useAuth";
import type { EmployeeRequest } from "../types";
import {
  Calendar,
  CheckCircle2,
  Clock,
  MessageSquare,
  Plus,
  RefreshCw,
  Send,
  UserCheck,
  X,
} from "lucide-react";

export const MyRequestsPage: React.FC = () => {
  const { user } = useAuth();
  const employeeId = user?.employee_id ?? null;

  const [requests, setRequests] = useState<EmployeeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    request_type: "CAREER_DISCUSSION",
    topic: "",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    if (!employeeId) {
      setLoading(false);
      return;
    }
    try {
      const res = await api.get<EmployeeRequest[]>("/employees/me/discussion-requests");
      setRequests(res.data || []);
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err, "Could not load discussion requests."));
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.topic.trim()) {
      setSubmitError("Please enter a discussion topic.");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      await api.post("/employees/me/discussion-requests", {
        request_type: form.request_type,
        topic: form.topic.trim(),
        notes: form.notes.trim() || undefined,
      });
      setSubmitSuccess("Discussion request submitted! HR will review and coordinate next steps.");
      setForm({ request_type: "CAREER_DISCUSSION", topic: "", notes: "" });
      fetchRequests();
      setTimeout(() => {
        setShowModal(false);
        setSubmitSuccess(null);
      }, 1500);
    } catch (err) {
      setSubmitError(getErrorMessage(err, "Failed to submit discussion request."));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[450px] w-full items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          <p className="text-sm font-medium text-ink-3">Loading career discussion requests...</p>
        </div>
      </div>
    );
  }

  const pendingCount = requests.filter((r) => r.status === "PENDING").length;
  const scheduledCount = requests.filter((r) => r.status === "SCHEDULED").length;
  const resolvedCount = requests.filter((r) => r.status === "RESOLVED").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">
              Career Discussion Requests
            </h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-600/20">
              <MessageSquare className="h-3 w-3" />
              {requests.length} Total
            </span>
          </div>
          <p className="mt-1 text-sm text-ink-3">
            Initiate confidential 1-on-1 career discussions, share learning interests, and review HR responses.
          </p>
        </div>

        <button
          onClick={() => {
            setShowModal(true);
            setSubmitError(null);
            setSubmitSuccess(null);
          }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-accent-hover self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          New Discussion Request
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-medium text-rose-800">
          {error}
        </div>
      )}

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-rule bg-panel p-4 shadow-card">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wider text-ink-3">Under Review</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-ink">{pendingCount}</p>
          <p className="mt-1 text-xs text-ink-3">Awaiting HR manager scheduling</p>
        </div>

        <div className="rounded-xl border border-rule bg-panel p-4 shadow-card">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wider text-ink-3">Scheduled Discussions</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <Calendar className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-ink">{scheduledCount}</p>
          <p className="mt-1 text-xs text-ink-3">Coordinated with manager / mentor</p>
        </div>

        <div className="rounded-xl border border-rule bg-panel p-4 shadow-card">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wider text-ink-3">Completed & Resolved</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-ink">{resolvedCount}</p>
          <p className="mt-1 text-xs text-ink-3">Action plans established</p>
        </div>
      </div>

      {/* Requests History List */}
      <div className="rounded-xl border border-rule bg-panel p-5 shadow-card">
        <div className="flex items-center justify-between border-b border-rule pb-3">
          <div>
            <h2 className="text-base font-semibold text-ink">My Discussion History</h2>
            <p className="text-xs text-ink-3">Past and open discussions submitted to HR.</p>
          </div>
          <button
            onClick={fetchRequests}
            className="rounded-lg p-1 text-ink-3 hover:bg-sunken hover:text-ink"
            title="Refresh requests"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        {requests.length === 0 ? (
          <div className="py-12 text-center">
            <MessageSquare className="mx-auto h-10 w-10 text-ink-3/40" />
            <p className="mt-2 text-sm font-medium text-ink">No discussion requests submitted yet.</p>
            <p className="text-xs text-ink-3 mt-1">
              Have questions about career pathways or skill development? Submit a request anytime.
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-accent-hover"
            >
              <Plus className="h-3.5 w-3.5" />
              Request Discussion
            </button>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {requests.map((req) => {
              const isPending = req.status === "PENDING";
              const isScheduled = req.status === "SCHEDULED";
              const isResolved = req.status === "RESOLVED";

              return (
                <div
                  key={req.id}
                  className="rounded-xl border border-rule bg-sunken p-4 transition-colors hover:border-rule-strong"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded bg-indigo-100 px-2 py-0.5 text-[10.5px] font-semibold text-indigo-700">
                          {req.request_type.replace("_", " ")}
                        </span>
                        <h3 className="text-sm font-semibold text-ink">{req.topic}</h3>
                      </div>
                      {req.notes && (
                        <p className="mt-1 text-xs text-ink-2 leading-relaxed">{req.notes}</p>
                      )}
                    </div>

                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold self-start whitespace-nowrap ${
                        isPending
                          ? "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20"
                          : isScheduled
                          ? "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20"
                          : "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20"
                      }`}
                    >
                      {isPending && <Clock className="h-3 w-3" />}
                      {isScheduled && <Calendar className="h-3 w-3" />}
                      {isResolved && <CheckCircle2 className="h-3 w-3" />}
                      {req.status}
                    </span>
                  </div>

                  {/* HR Feedback / Follow-up Notes */}
                  {req.response_notes && (
                    <div className="mt-3 rounded-lg border border-indigo-100 bg-panel p-3">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-900">
                        <UserCheck className="h-3.5 w-3.5 text-indigo-600" />
                        HR Manager Response
                      </div>
                      <p className="mt-1 text-xs text-ink-2">{req.response_notes}</p>
                      {req.reviewed_at && (
                        <p className="mt-1 text-[10.5px] text-ink-3">
                          Reviewed on {new Date(req.reviewed_at).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="mt-2.5 flex items-center justify-between text-[11px] text-ink-3 border-t border-rule/60 pt-2">
                    <span>Submitted on {new Date(req.created_at).toLocaleDateString()}</span>
                    <span>Confidential Employee Request</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Submission Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-rule bg-panel p-6 shadow-pop">
            <div className="flex items-center justify-between border-b border-rule pb-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-accent" />
                <h3 className="text-base font-semibold text-ink">New Discussion Request</h3>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="rounded-lg p-1 text-ink-3 hover:bg-sunken hover:text-ink"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {submitSuccess && (
              <div className="mt-4 rounded-lg bg-emerald-50 p-3 text-xs font-medium text-emerald-800">
                {submitSuccess}
              </div>
            )}

            {submitError && (
              <div className="mt-4 rounded-lg bg-rose-50 p-3 text-xs font-medium text-rose-800">
                {submitError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-ink">Discussion Type</label>
                <select
                  value={form.request_type}
                  onChange={(e) => setForm({ ...form, request_type: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-rule bg-panel px-3 py-2 text-xs font-medium text-ink shadow-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                >
                  <option value="CAREER_DISCUSSION">Career Discussion & Role Growth</option>
                  <option value="LEARNING_INTEREST">Learning Interest & Training Request</option>
                  <option value="SKILL_DEVELOPMENT">Mentorship & Skill Development</option>
                  <option value="WORKLOAD_REVIEW">Workload & Wellbeing Check-in</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink">Topic or Primary Focus</label>
                <input
                  type="text"
                  placeholder="e.g. Preparing for Senior Engineering Lead transition"
                  value={form.topic}
                  onChange={(e) => setForm({ ...form, topic: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-rule bg-panel px-3 py-2 text-xs text-ink placeholder-ink-3 shadow-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink">
                  Additional Context or Preferred Discussion Points (Optional)
                </label>
                <textarea
                  rows={4}
                  placeholder="Share details on what you would like to discuss, target timelines, or any specific support needed."
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-rule bg-panel px-3 py-2 text-xs text-ink placeholder-ink-3 shadow-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>

              <div className="mt-5 flex justify-end gap-2 border-t border-rule pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-lg border border-rule px-4 py-2 text-xs font-semibold text-ink-2 hover:bg-sunken"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-accent-hover disabled:opacity-50"
                >
                  <Send className="h-3.5 w-3.5" />
                  {submitting ? "Submitting..." : "Submit Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
