import React, { useState, useEffect, useCallback } from "react";
import api, { getErrorMessage } from "../services/api";
import type { UserRole } from "../types";
import {
  ShieldCheck,
  UserPlus,
  Search,
  Mail,
  CheckCircle,
  XCircle,
  Edit2,
  X,
  Shield,
  Briefcase,
  User as UserIcon,
} from "lucide-react";

interface UserItem {
  id: string;
  username: string;
  email: string;
  display_name: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const ROLE_BADGE: Record<UserRole, { label: string; tone: string; icon: React.ElementType }> = {
  HR_ADMIN: {
    label: "HR Admin",
    tone: "bg-purple-50 text-purple-700 border-purple-200",
    icon: Shield,
  },
  HR_MANAGER: {
    label: "HR Manager",
    tone: "bg-indigo-50 text-indigo-700 border-indigo-200",
    icon: Briefcase,
  },
  EMPLOYEE: {
    label: "Employee",
    tone: "bg-slate-100 text-slate-700 border-slate-200",
    icon: UserIcon,
  },
};

export const UsersPage: React.FC = () => {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");

  // Create Modal
  const [createModal, setCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    username: "",
    email: "",
    password: "",
    display_name: "",
    role: "EMPLOYEE" as UserRole,
  });
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Edit Modal
  const [editUser, setEditUser] = useState<UserItem | null>(null);
  const [editForm, setEditForm] = useState<{
    display_name: string;
    role: UserRole;
    is_active: boolean;
    password?: string;
  }>({
    display_name: "",
    role: "EMPLOYEE",
    is_active: true,
  });
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/users", { params: { page_size: 100 } });
      setUsers(res.data.items);
      setTotal(res.data.total);
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load user accounts"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateSubmitting(true);
    setCreateError(null);
    try {
      await api.post("/users", createForm);
      setCreateModal(false);
      setCreateForm({
        username: "",
        email: "",
        password: "",
        display_name: "",
        role: "EMPLOYEE",
      });
      await fetchUsers();
    } catch (err) {
      setCreateError(getErrorMessage(err, "Failed to create user account"));
    } finally {
      setCreateSubmitting(false);
    }
  };

  const handleOpenEdit = (user: UserItem) => {
    setEditUser(user);
    setEditForm({
      display_name: user.display_name || "",
      role: user.role,
      is_active: user.is_active,
    });
    setEditError(null);
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUser) return;
    setEditSubmitting(true);
    setEditError(null);
    try {
      const payload: Record<string, unknown> = {
        display_name: editForm.display_name,
        role: editForm.role,
        is_active: editForm.is_active,
      };
      if (editForm.password && editForm.password.trim().length > 0) {
        payload.password = editForm.password;
      }
      await api.put(`/users/${editUser.id}`, payload);
      setEditUser(null);
      await fetchUsers();
    } catch (err) {
      setEditError(getErrorMessage(err, "Failed to update user account"));
    } finally {
      setEditSubmitting(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.username.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.display_name && u.display_name.toLowerCase().includes(search.toLowerCase()));
    const matchesRole = roleFilter === "ALL" || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-indigo-600" /> User & Role Management
          </h1>
          <p className="text-xs text-slate-600 mt-1">
            HR Admin governance: manage login credentials, role assignments, and access permissions.
          </p>
        </div>
        <button
          onClick={() => setCreateModal(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 shadow-sm"
        >
          <UserPlus className="h-4 w-4" /> Add User Account
        </button>
      </div>

      {/* Role Responsibility Matrix Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-purple-200 bg-purple-50/50 p-4">
          <div className="flex items-center gap-2 text-purple-800 font-semibold text-sm">
            <Shield className="h-4 w-4" /> HR Administrator
          </div>
          <p className="text-xs text-purple-700 mt-1">
            User provisioning, system configuration, audit logs, department management, and employee record administration.
          </p>
        </div>
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-4">
          <div className="flex items-center gap-2 text-indigo-800 font-semibold text-sm">
            <Briefcase className="h-4 w-4" /> HR Manager
          </div>
          <p className="text-xs text-indigo-700 mt-1">
            Attrition risk analytics, employee risk investigation, retention interventions, training recommendations, and follow-up tracking.
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center gap-2 text-slate-800 font-semibold text-sm">
            <UserIcon className="h-4 w-4" /> Employee
          </div>
          <p className="text-xs text-slate-700 mt-1">
            Personal self-service dashboard, voluntary learning enrollment, lesson progress, quizzes, and career discussion requests.
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search username, email, or name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-1.5 text-xs text-slate-800 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs text-slate-500 font-medium">Role:</span>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-700 outline-none focus:border-indigo-500"
          >
            <option value="ALL">All Roles ({total})</option>
            <option value="HR_ADMIN">HR Admin</option>
            <option value="HR_MANAGER">HR Manager</option>
            <option value="EMPLOYEE">Employee</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
          {error}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Display Name</th>
                <th className="py-3 px-4">Assigned Role</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Created</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No user accounts match the current filter.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const badge = ROLE_BADGE[u.role] || ROLE_BADGE.EMPLOYEE;
                  const BadgeIcon = badge.icon;
                  return (
                    <tr key={u.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 font-semibold text-xs uppercase">
                            {u.username.slice(0, 2)}
                          </div>
                          <div>
                            <span className="font-semibold text-slate-900 block">{u.username}</span>
                            <span className="text-[11px] text-slate-500 flex items-center gap-1">
                              <Mail className="h-3 w-3" /> {u.email}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-700">
                        {u.display_name || <span className="text-slate-400 italic">None</span>}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${badge.tone}`}
                        >
                          <BadgeIcon className="h-3 w-3" /> {badge.label}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {u.is_active ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 font-medium text-[11px]">
                            <CheckCircle className="h-3.5 w-3.5" /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-slate-400 font-medium text-[11px]">
                            <XCircle className="h-3.5 w-3.5" /> Inactive
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-500">
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleOpenEdit(u)}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-slate-600 hover:bg-slate-100 text-[11px] font-medium"
                        >
                          <Edit2 className="h-3 w-3" /> Edit
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Create User Modal */}
      {createModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-indigo-600" /> Create User Account
              </h2>
              <button onClick={() => setCreateModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleCreateUser} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Username *</label>
                <input
                  type="text"
                  required
                  value={createForm.username}
                  onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
                  placeholder="e.g. jdoe"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  placeholder="jdoe@workforce.local"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Display Name</label>
                <input
                  type="text"
                  value={createForm.display_name}
                  onChange={(e) => setCreateForm({ ...createForm, display_name: e.target.value })}
                  placeholder="John Doe"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Initial Password *</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  placeholder="Minimum 8 characters"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Role Permission *</label>
                <select
                  value={createForm.role}
                  onChange={(e) => setCreateForm({ ...createForm, role: e.target.value as UserRole })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 outline-none focus:border-indigo-500"
                >
                  <option value="EMPLOYEE">Employee (Self-service only)</option>
                  <option value="HR_MANAGER">HR Manager (Risk & Interventions)</option>
                  <option value="HR_ADMIN">HR Admin (Governance & Master Data)</option>
                </select>
              </div>

              {createError && (
                <div className="rounded-lg bg-rose-50 border border-rose-200 p-2 text-xs text-rose-700">
                  {createError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCreateModal(false)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createSubmitting}
                  className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {createSubmitting ? "Creating..." : "Create Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Edit2 className="h-4 w-4 text-indigo-600" /> Edit User ({editUser.username})
              </h2>
              <button onClick={() => setEditUser(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleUpdateUser} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Display Name</label>
                <input
                  type="text"
                  value={editForm.display_name}
                  onChange={(e) => setEditForm({ ...editForm, display_name: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Role Permission</label>
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value as UserRole })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 outline-none focus:border-indigo-500"
                >
                  <option value="EMPLOYEE">Employee (Self-service only)</option>
                  <option value="HR_MANAGER">HR Manager (Risk & Interventions)</option>
                  <option value="HR_ADMIN">HR Admin (Governance & Master Data)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Reset Password (Optional)</label>
                <input
                  type="password"
                  placeholder="Leave blank to keep unchanged"
                  onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="flex items-center gap-2 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={editForm.is_active}
                    onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-xs font-medium text-slate-800">Account Active</span>
                </label>
              </div>

              {editError && (
                <div className="rounded-lg bg-rose-50 border border-rose-200 p-2 text-xs text-rose-700">
                  {editError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditUser(null)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {editSubmitting ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
