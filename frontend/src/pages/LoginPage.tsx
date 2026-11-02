import React, { useState, useEffect } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { getErrorMessage } from "../services/api";
import {
  AlertCircle,
  ArrowRight,
  CircleHelp,
  Eye,
  EyeOff,
  FileText,
  GraduationCap,
  Info,
  Lock,
  Mail,
  Search,
  Target,
  TrendingUp,
  User,
  Users,
  ShieldCheck,
  ShieldAlert,
  ChartColumn,
} from "lucide-react";

import { AnimatedCounter } from "../components/AnimatedCounter";

const REMEMBER_KEY = "wf-remembered-email";
const DEMO_PASSWORD = "demo1234";

const ROLES = [
  { id: "admin", label: "Admin", note: "Governance & Admin", email: "admin@workforce.local", icon: ShieldCheck },
  { id: "manager", label: "HR Manager", note: "Workforce & Retention", email: "user@workforce.local", icon: Users },
  { id: "employee", label: "Employee", note: "Personal Self-Service", email: "demo@workforce.local", icon: User },
] as const;

type RoleId = (typeof ROLES)[number]["id"];

export interface EmployeeProfile {
  sno: number;
  name: string;
  title: string;
  email: string;
}

const EMPLOYEE_PROFILES: EmployeeProfile[] = [
  { sno: 1, name: "Sarah Johnson", title: "Senior Software Engineer", email: "demo@workforce.local" },
  { sno: 2, name: "Adam Johansson", title: "Senior Financial Analyst", email: "adam.johansson157@workforce.local" },
  { sno: 3, name: "Adrian Kaminski", title: "Senior Financial Analyst", email: "adrian.kaminski159@workforce.local" },
  { sno: 4, name: "Amelia Kim", title: "Financial Analyst", email: "amelia.kim155@workforce.local" },
  { sno: 5, name: "Amelia Walsh", title: "Systems Administrator", email: "amelia.walsh176@workforce.local" },
  { sno: 6, name: "Andrew Rodriguez", title: "Senior Software Engineer", email: "andrew.rodriguez22@workforce.local" },
  { sno: 7, name: "Andrew Wilson", title: "HR Business Partner", email: "andrew.wilson50@workforce.local" },
  { sno: 8, name: "Anna Lindberg", title: "Regulatory Compliance Specialist", email: "anna.lindberg190@workforce.local" },
  { sno: 9, name: "Anthony Smith", title: "Lead Software Architect", email: "anthony.smith20@workforce.local" },
  { sno: 10, name: "Barbara Thomas", title: "Enterprise Account Executive", email: "barbara.thomas39@workforce.local" },
  { sno: 11, name: "Carol Thompson", title: "Enterprise Account Executive", email: "carol.thompson40@workforce.local" },
  { sno: 12, name: "Casey Patel", title: "Senior Product Manager", email: "casey.patel90@workforce.local" },
  { sno: 13, name: "Daniel Lopez", title: "Lead Software Architect", email: "daniel.lopez4@workforce.local" },
  { sno: 14, name: "David Sanchez", title: "Senior Product Manager", email: "david.sanchez27@workforce.local" },
  { sno: 15, name: "Deborah Jackson", title: "Senior Product Manager", email: "deborah.jackson30@workforce.local" },
  { sno: 16, name: "Donna Martin", title: "Enterprise Account Executive", email: "donna.martin45@workforce.local" },
  { sno: 17, name: "Dorothy Anderson", title: "Enterprise Account Executive", email: "dorothy.anderson41@workforce.local" },
  { sno: 18, name: "Dorothy Martin", title: "HR Business Partner", email: "dorothy.martin46@workforce.local" },
  { sno: 19, name: "George Thomas", title: "Senior Software Engineer", email: "george.thomas9@workforce.local" },
  { sno: 20, name: "Harper Russo", title: "Finance Manager", email: "harper.russo153@workforce.local" },
  { sno: 21, name: "James Jackson", title: "Enterprise Account Executive", email: "james.jackson43@workforce.local" },
  { sno: 22, name: "James White", title: "Lead Software Architect", email: "james.white1@workforce.local" },
  { sno: 23, name: "Jaxon Lindberg", title: "Business Operations Lead", email: "jaxon.lindberg172@workforce.local" },
  { sno: 24, name: "Jennifer Perez", title: "Senior Product Manager", email: "jennifer.perez23@workforce.local" },
  { sno: 25, name: "Jessica Jones", title: "Frontend Engineer", email: "jessica.jones6@workforce.local" },
  { sno: 26, name: "John Gonzalez", title: "Senior Machine Learning Engineer", email: "john.gonzalez12@workforce.local" },
  { sno: 27, name: "Joseph Perez", title: "HR Business Partner", email: "joseph.perez49@workforce.local" },
  { sno: 28, name: "Julian Silva", title: "Senior Financial Analyst", email: "julian.silva154@workforce.local" },
  { sno: 29, name: "Linda Anderson", title: "HR Business Partner", email: "linda.anderson48@workforce.local" },
  { sno: 30, name: "Linda Moore", title: "HR Business Partner", email: "linda.moore47@workforce.local" },
  { sno: 31, name: "Lisa Hernandez", title: "Senior Product Manager", email: "lisa.hernandez29@workforce.local" },
  { sno: 32, name: "Margaret Wilson", title: "Growth Marketing Lead", email: "margaret.wilson38@workforce.local" },
  { sno: 33, name: "Mark Martin", title: "Senior Software Engineer", email: "mark.martin16@workforce.local" },
  { sno: 34, name: "Maya Simon", title: "Director of Operations", email: "maya.simon171@workforce.local" },
  { sno: 35, name: "Melissa Garcia", title: "Senior Product Manager", email: "melissa.garcia25@workforce.local" },
  { sno: 36, name: "Nathan Ortiz", title: "Systems Administrator", email: "nathan.ortiz174@workforce.local" },
  { sno: 37, name: "Nora Johansson", title: "Senior Corporate Counsel", email: "nora.johansson189@workforce.local" },
  { sno: 38, name: "Paul Martinez", title: "Senior Machine Learning Engineer", email: "paul.martinez3@workforce.local" },
  { sno: 39, name: "Penelope Eriksson", title: "Regulatory Compliance Specialist", email: "penelope.eriksson191@workforce.local" },
  { sno: 40, name: "Richard Clark", title: "Growth Marketing Lead", email: "richard.clark34@workforce.local" },
  { sno: 41, name: "Richard Martinez", title: "Enterprise Account Executive", email: "richard.martinez42@workforce.local" },
  { sno: 42, name: "Richard Martinez", title: "Lead Software Architect", email: "richard.martinez14@workforce.local" },
  { sno: 43, name: "Robert Jackson", title: "Growth Marketing Lead", email: "robert.jackson36@workforce.local" },
  { sno: 44, name: "Robert Lee", title: "Growth Marketing Lead", email: "robert.lee32@workforce.local" },
  { sno: 45, name: "Sarah Clark", title: "Growth Marketing Lead", email: "sarah.clark33@workforce.local" },
  { sno: 46, name: "Thomas Wilson", title: "Growth Marketing Lead", email: "thomas.wilson31@workforce.local" },
  { sno: 47, name: "William Jones", title: "Enterprise Account Executive", email: "william.jones44@workforce.local" },
];


const readRemembered = () => {
  try {
    return localStorage.getItem(REMEMBER_KEY) ?? "";
  } catch {
    return "";
  }
};

const FEATURES = [
  { icon: ChartColumn, title: "Predict", note: "Attrition Risk", tone: "#4f46e5", bg: "#eef0ff" },
  { icon: GraduationCap, title: "Identify", note: "Skill Gaps", tone: "#059669", bg: "#e5f7ef" },
  { icon: Users, title: "Empower", note: "Your Talent", tone: "#d97706", bg: "#fdf1e0" },
  { icon: Target, title: "Drive", note: "Higher Retention", tone: "#dc2626", bg: "#fdeaea" },
];

const SAMPLE_ROWS = [
  {
    name: "Deborah Jackson",
    role: "Staff Product Manager",
    risk: "High",
    score: 88,
    dot: "#ef4444",
    tag: "Action required",
    tagTone: "#dc2626",
    tagBg: "#fef2f2",
  },
  {
    name: "James Wilson",
    role: "Enterprise Sales Lead",
    risk: "Medium",
    score: 64,
    dot: "#f59e0b",
    tag: "1:1 Scheduled",
    tagTone: "#d97706",
    tagBg: "#fffbeb",
  },
  {
    name: "Marcus Chen",
    role: "Senior DevOps Engineer",
    risk: "High",
    score: 79,
    dot: "#ef4444",
    tag: "Reviewing",
    tagTone: "#dc2626",
    tagBg: "#fef2f2",
  },
  {
    name: "Linda Anderson",
    role: "HR Business Partner",
    risk: "Low",
    score: 18,
    dot: "#10b981",
    tag: "On track",
    tagTone: "#059669",
    tagBg: "#ecfdf5",
  },
];

const ROTATING_PHRASES = [
  {
    action: "Predict Attrition.",
    detail: "Detect flight risk before it impacts your business.",
    gradient: "linear-gradient(90deg, #4f46e5, #7c3aed)",
  },
  {
    action: "Bridge Skill Gaps.",
    detail: "Automated curriculum diagnostics tailored to every role.",
    gradient: "linear-gradient(90deg, #059669, #0d9488)",
  },
  {
    action: "Empower Talent.",
    detail: "Personalized growth paths, career discussions, and assessments.",
    gradient: "linear-gradient(90deg, #7c3aed, #c026d3)",
  },
  {
    action: "Drive Higher Retention.",
    detail: "Proactive manager interventions and real-time retention telemetry.",
    gradient: "linear-gradient(90deg, #dc2626, #ea580c)",
  },
];

const initials = (name: string) =>
  name
    .split(" ")
    .map((p) => p[0])
    .join("");

/** Illustrative product preview:
 * 1) All 5 sub-cards start slightly scattered/elevated outside the base card
 * 2) Each card smoothly glides with continuous bezier curve into its designated spot in the base card
 * 3) Live metrics and counters count up gracefully once landed
 */
const HeroPreview: React.FC = () => {
  const [isDocked, setIsDocked] = useState(false);
  const [isRevealed, setIsRevealed] = useState(false);

  useEffect(() => {
    // 1. Initial gentle floating state outside base card, then smoothly dock
    const t1 = setTimeout(() => {
      setIsDocked(true);
    }, 500);

    // 2. Once the glide starts settling, smoothly reveal live metrics & counter animations
    const t2 = setTimeout(() => {
      setIsRevealed(true);
    }, 1400);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  return (
    <div className="relative mx-auto mt-8 h-[460px] w-full max-w-[840px] select-none" aria-hidden="true">
      {/* Base background main card — clean canvas frame that holds the sub cards */}
      <div className="absolute inset-0 rounded-[24px] border border-indigo-200/60 bg-gradient-to-br from-white/95 via-indigo-50/20 to-purple-50/30 shadow-[0_24px_60px_-15px_rgba(79,70,229,0.18)] pointer-events-none" />

      {/* ===================== LEFT COLUMN (width: 396px) ===================== */}

      {/* Card 1: At risk — Top-Left (16, 16, 396×136) */}
      <div
        className="absolute z-10 rounded-xl bg-white p-4 border border-slate-200/70 flex flex-col justify-between"
        style={{
          left: 16,
          top: 16,
          width: 396,
          height: 136,
          transform: isDocked
            ? "translate3d(0px, 0px, 0px) rotate(0deg) scale(1)"
            : "translate3d(-52px, -36px, 0px) rotate(-5.5deg) scale(0.96)",
          boxShadow: isDocked
            ? "0 4px 14px -3px rgba(30, 27, 75, 0.08), 0 1px 3px 0 rgba(30, 27, 75, 0.04)"
            : "0 32px 64px -16px rgba(79, 70, 229, 0.35)",
          opacity: isDocked ? 1 : 0.9,
          transition: "transform 1.7s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 1.7s ease, opacity 1.2s ease",
          transitionDelay: isDocked ? "0ms" : "0ms",
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-rose-50 text-rose-600">
              <ShieldAlert className="h-3.5 w-3.5" />
            </span>
            <span className="text-[11.5px] font-semibold text-slate-800">Flight Risk Attrition</span>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[9.5px] font-semibold text-rose-700 border border-rose-200/60">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
            High Priority
          </span>
        </div>

        <div className="mt-1 flex items-center justify-between">
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-[22px] font-bold leading-none text-slate-900 tabular-nums">
                {isRevealed ? <AnimatedCounter value={10} duration={850} /> : 0}
              </span>
              <span className="text-[12px] text-slate-400 font-medium">/ 50 monitored</span>
              <span className="inline-flex items-center rounded-full bg-rose-50 px-1.5 py-0.2 text-[9.5px] font-semibold text-rose-600">
                ↑ 20%
              </span>
            </div>
            <p className="mt-0.5 text-[10px] text-slate-500">Predicted attrition in next 60 days</p>
          </div>
          <div className="flex h-8 items-end gap-1.5 pb-0.5">
            {[14, 22, 30, 44, 34, 52].map((h, i) => (
              <span
                key={i}
                className="w-2.5 rounded-t transition-all duration-1000 ease-out"
                style={{
                  height: isRevealed ? `${h * 0.55}px` : "4px",
                  background: i === 5 ? "#ef4444" : i >= 3 ? "#f97316" : `rgb(99 102 241 / ${0.35 + i * 0.1})`,
                }}
              />
            ))}
          </div>
        </div>

        <div className="mt-1.5 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[9.5px]">
          <div className="flex items-center gap-2 text-slate-600">
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
              Eng: <b className="text-slate-800">4</b>
            </span>
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              Sales: <b className="text-slate-800">3</b>
            </span>
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
              Product: <b className="text-slate-800">2</b>
            </span>
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
              Ops: <b className="text-slate-800">1</b>
            </span>
          </div>
          <span className="text-rose-600 font-medium">3 leadership leads</span>
        </div>
      </div>

      {/* Card 3: Critical skill gaps — Mid-Left (16, 164, 396×132) */}
      <div
        className="absolute z-10 rounded-xl bg-white p-4 border border-slate-200/70 flex flex-col justify-between"
        style={{
          left: 16,
          top: 164,
          width: 396,
          height: 132,
          transform: isDocked
            ? "translate3d(0px, 0px, 0px) rotate(0deg) scale(1)"
            : "translate3d(-58px, 10px, 0px) rotate(-4.5deg) scale(0.96)",
          boxShadow: isDocked
            ? "0 4px 14px -3px rgba(30, 27, 75, 0.08), 0 1px 3px 0 rgba(30, 27, 75, 0.04)"
            : "0 32px 64px -16px rgba(79, 70, 229, 0.35)",
          opacity: isDocked ? 1 : 0.9,
          transition: "transform 1.7s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 1.7s ease, opacity 1.2s ease",
          transitionDelay: isDocked ? "180ms" : "0ms",
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-amber-50 text-amber-600">
              <Users className="h-3.5 w-3.5" />
            </span>
            <span className="text-[11.5px] font-semibold text-slate-800">Critical Skill Gaps</span>
          </div>
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[9.5px] font-semibold text-amber-700 border border-amber-200/60">
            Action Needed
          </span>
        </div>

        <div className="mt-1 flex items-baseline justify-between">
          <div className="flex items-baseline gap-1.5">
            <span className="text-[22px] font-bold leading-none text-slate-900 tabular-nums">
              {isRevealed ? <AnimatedCounter value={5} duration={750} /> : 0}
            </span>
            <span className="text-[10.5px] text-slate-500">Key competency deficits</span>
          </div>
          <div className="flex items-center gap-1 text-[9.5px] font-medium text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            3 In Upskilling
          </div>
        </div>

        <div className="mt-1.5 pt-1.5 border-t border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="rounded bg-rose-50 px-1.5 py-0.5 text-[9px] font-semibold text-rose-700 border border-rose-200/50">
              Kubernetes (-35%)
            </span>
            <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[9px] font-semibold text-amber-800 border border-amber-200/50">
              System Design (-28%)
            </span>
            <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[9px] font-semibold text-indigo-700 border border-indigo-200/50">
              Data Gov (-20%)
            </span>
          </div>
          <span className="text-[9px] font-medium text-indigo-600">Curricula ready →</span>
        </div>
      </div>

      {/* Card 4: Training completion — Bottom-Left (16, 308, 396×136) */}
      <div
        className="absolute z-10 rounded-xl bg-white p-4 border border-slate-200/70 flex flex-col justify-between"
        style={{
          left: 16,
          top: 308,
          width: 396,
          height: 136,
          transform: isDocked
            ? "translate3d(0px, 0px, 0px) rotate(0deg) scale(1)"
            : "translate3d(-48px, 46px, 0px) rotate(4.5deg) scale(0.96)",
          boxShadow: isDocked
            ? "0 4px 14px -3px rgba(30, 27, 75, 0.08), 0 1px 3px 0 rgba(30, 27, 75, 0.04)"
            : "0 32px 64px -16px rgba(79, 70, 229, 0.35)",
          opacity: isDocked ? 1 : 0.9,
          transition: "transform 1.7s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 1.7s ease, opacity 1.2s ease",
          transitionDelay: isDocked ? "260ms" : "0ms",
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-emerald-50 text-emerald-600">
              <GraduationCap className="h-3.5 w-3.5" />
            </span>
            <span className="text-[11.5px] font-semibold text-slate-800">L&D Training Velocity</span>
          </div>
          <span className="text-[9.5px] text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/50">
            ↑ 12% MoM
          </span>
        </div>

        <div>
          <div className="flex items-baseline justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-[20px] font-bold leading-none text-slate-900 tabular-nums">
                {isRevealed ? <AnimatedCounter value={68} duration={950} suffix="%" /> : "0%"}
              </span>
              <span className="text-[10px] text-slate-500">34 of 50 completed</span>
            </div>
            <span className="text-[9.5px] font-medium text-emerald-600 flex items-center gap-0.5">
              <TrendingUp className="h-3 w-3" /> On Track
            </span>
          </div>

          <div className="mt-1.5 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-1000 ease-out"
              style={{ width: isRevealed ? "68%" : "0%" }}
            />
          </div>
        </div>

        <div className="mt-1 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[9.5px] text-slate-500">
          <span>Avg Score: <strong className="text-slate-700">89%</strong></span>
          <span>•</span>
          <span>Hours: <strong className="text-slate-700">142h</strong></span>
          <span>•</span>
          <span>Cohort: <strong className="text-emerald-600">82%</strong></span>
          <span>•</span>
          <span>Certs: <strong className="text-indigo-600">18</strong></span>
        </div>
      </div>

      {/* ===================== RIGHT COLUMN (width: 396px) ===================== */}

      {/* Card 2: Skill alignment — Top-Right (428, 16, 396×136) */}
      <div
        className="absolute z-10 rounded-xl bg-white p-4 border border-slate-200/70 flex flex-col justify-between"
        style={{
          left: 428,
          top: 16,
          width: 396,
          height: 136,
          transform: isDocked
            ? "translate3d(0px, 0px, 0px) rotate(0deg) scale(1)"
            : "translate3d(52px, -36px, 0px) rotate(5.5deg) scale(0.96)",
          boxShadow: isDocked
            ? "0 4px 14px -3px rgba(30, 27, 75, 0.08), 0 1px 3px 0 rgba(30, 27, 75, 0.04)"
            : "0 32px 64px -16px rgba(79, 70, 229, 0.35)",
          opacity: isDocked ? 1 : 0.9,
          transition: "transform 1.7s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 1.7s ease, opacity 1.2s ease",
          transitionDelay: isDocked ? "100ms" : "0ms",
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-emerald-50 text-emerald-600">
              <Target className="h-3.5 w-3.5" />
            </span>
            <span className="text-[11.5px] font-semibold text-slate-800">Skill Alignment Index</span>
          </div>
          <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[9.5px] font-semibold text-emerald-700 border border-emerald-200/60">
            +4% ahead
          </span>
        </div>

        <div className="mt-1 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <svg viewBox="0 0 48 48" className="h-9 w-9 -rotate-90 flex-shrink-0">
              <circle cx="24" cy="24" r="19" fill="none" stroke="#e2f5ea" strokeWidth="5" />
              <circle
                cx="24"
                cy="24"
                r="19"
                fill="none"
                stroke="#10b981"
                strokeWidth="5"
                strokeLinecap="round"
                className="transition-all duration-1000 ease-out"
                strokeDasharray={`${(isRevealed ? 0.94 : 0.05) * 2 * Math.PI * 19} ${2 * Math.PI * 19}`}
              />
            </svg>
            <div>
              <div className="flex items-baseline gap-1">
                <span className="text-[19px] font-bold leading-none text-slate-900 tabular-nums">
                  {isRevealed ? <AnimatedCounter value={94} duration={950} suffix="%" /> : "0%"}
                </span>
                <span className="text-[10px] text-slate-500">Target: 90%</span>
              </div>
              <p className="mt-0.5 text-[9px] text-slate-400">All 8 Departments</p>
            </div>
          </div>

          <div className="text-right border-l border-slate-100 pl-3 space-y-0.5 text-[9.5px]">
            <div className="font-semibold text-slate-700">Engineering: <span className="text-emerald-600">96%</span></div>
            <div className="font-semibold text-slate-700">Product & UX: <span className="text-emerald-600">92%</span></div>
          </div>
        </div>

        <div className="mt-1.5 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[9.5px]">
          <span className="text-slate-500 font-medium">Top Strengths:</span>
          <div className="flex items-center gap-1.5">
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-medium text-slate-700">Cloud Arch 98%</span>
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-medium text-slate-700">GenAI / ML 94%</span>
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-medium text-slate-700">System Eng 91%</span>
          </div>
        </div>
      </div>

      {/* Card 5: People Status Table — Bottom-Right (428, 164, 396×280) */}
      <div
        className="absolute z-10 rounded-xl bg-white px-4 py-3 border border-slate-200/70 flex flex-col justify-between"
        style={{
          left: 428,
          top: 164,
          width: 396,
          height: 280,
          transform: isDocked
            ? "translate3d(0px, 0px, 0px) rotate(0deg) scale(1)"
            : "translate3d(52px, 42px, 0px) rotate(-4.5deg) scale(0.96)",
          boxShadow: isDocked
            ? "0 4px 14px -3px rgba(30, 27, 75, 0.08), 0 1px 3px 0 rgba(30, 27, 75, 0.04)"
            : "0 32px 64px -16px rgba(79, 70, 229, 0.35)",
          opacity: isDocked ? 1 : 0.9,
          transition: "transform 1.7s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 1.7s ease, opacity 1.2s ease",
          transitionDelay: isDocked ? "340ms" : "0ms",
        }}
      >
        <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
          <div className="flex items-center gap-1.5">
            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-indigo-50 text-indigo-600">
              <ChartColumn className="h-3.5 w-3.5" />
            </span>
            <span className="text-[11.5px] font-semibold text-slate-800">Employee Retention Telemetry</span>
          </div>
          <div className="flex items-center gap-1 text-[9px] font-medium text-emerald-600">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Live Scored
          </div>
        </div>

        {/* Cohort status summary strip (fills previous empty space) */}
        <div className="my-1 grid grid-cols-4 gap-1.5 rounded-lg bg-slate-50/80 p-1 text-center text-[9px]">
          <div className="rounded bg-white py-0.5 px-1 shadow-2xs border border-slate-100">
            <span className="text-slate-400 block text-[7.5px] uppercase tracking-wider">Cohort</span>
            <strong className="text-slate-800 text-[10.5px] font-bold">50</strong>
          </div>
          <div className="rounded bg-white py-0.5 px-1 shadow-2xs border border-rose-100">
            <span className="text-rose-500 block text-[7.5px] uppercase tracking-wider font-semibold">High</span>
            <strong className="text-rose-700 text-[10.5px] font-bold">10</strong>
          </div>
          <div className="rounded bg-white py-0.5 px-1 shadow-2xs border border-amber-100">
            <span className="text-amber-500 block text-[7.5px] uppercase tracking-wider font-semibold">Medium</span>
            <strong className="text-amber-700 text-[10.5px] font-bold">14</strong>
          </div>
          <div className="rounded bg-white py-0.5 px-1 shadow-2xs border border-emerald-100">
            <span className="text-emerald-500 block text-[7.5px] uppercase tracking-wider font-semibold">Safe</span>
            <strong className="text-emerald-700 text-[10.5px] font-bold">26</strong>
          </div>
        </div>

        {/* 4 Telemetry Rows with rich metrics */}
        <div className="divide-y divide-slate-100">
          {SAMPLE_ROWS.map((r) => (
            <div key={r.name} className="flex items-center gap-2 py-1.5 text-[10.5px]">
              <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[9.5px] font-bold text-indigo-700">
                {initials(r.name)}
              </span>
              <div className="w-[110px] min-w-0 flex-shrink-0">
                <span className="block truncate font-semibold text-slate-800 text-[10.5px] leading-tight">{r.name}</span>
                <span className="block truncate text-[9px] text-slate-400">{r.role}</span>
              </div>
              <div className="flex items-center gap-1 text-[9.5px] font-medium text-slate-600 flex-shrink-0 w-[64px]">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: r.dot }} />
                <span>{r.risk} ({r.score}%)</span>
              </div>
              <span
                className="ml-auto rounded-full px-2 py-0.5 text-[8.5px] font-semibold whitespace-nowrap border"
                style={{ color: r.tagTone, background: r.tagBg, borderColor: `${r.tagTone}30` }}
              >
                {r.tag}
              </span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-0.5 pt-1 border-t border-slate-100 flex items-center justify-between text-[9px] text-slate-400">
          <span>Model: <strong className="text-slate-600">XGBoost Ensemble v2.4</strong></span>
          <span className="text-emerald-600 font-medium">94.8% AUC • Instant Alerting</span>
        </div>
      </div>
    </div>
  );
};

export const LoginPage: React.FC = () => {
  const { login, user } = useAuth();
  const navigate = useNavigate();

  const remembered = readRemembered();
  const [email, setEmail] = useState(remembered);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [role, setRole] = useState<RoleId | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [showProfilePicker, setShowProfilePicker] = useState(false);
  const [profileSearch, setProfileSearch] = useState("");
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [animStage, setAnimStage] = useState<"visible" | "exit-left" | "enter-bottom">("visible");

  // Rotating sentence animation: old slides left, new slides up from bottom (slow & smooth)
  useEffect(() => {
    const timer = setInterval(() => {
      // 1. Slide old sentence to left
      setAnimStage("exit-left");

      setTimeout(() => {
        // 2. Prepare new sentence at bottom
        setPhraseIndex((prev) => (prev + 1) % ROTATING_PHRASES.length);
        setAnimStage("enter-bottom");

        // 3. Slide new sentence up from bottom into view
        requestAnimationFrame(() => {
          setTimeout(() => {
            setAnimStage("visible");
          }, 40);
        });
      }, 550);
    }, 4200);

    return () => clearInterval(timer);
  }, []);

  const pickRole = (id: RoleId) => {
    const r = ROLES.find((x) => x.id === id)!;
    setRole(id);
    setEmail(r.email);
    setPassword(DEMO_PASSWORD);
    setError(null);
    setInfo(null);
    if (id !== "employee") setShowProfilePicker(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(email, password);
      try {
        if (remember) localStorage.setItem(REMEMBER_KEY, email);
        else localStorage.removeItem(REMEMBER_KEY);
      } catch {
        /* storage can be blocked; signing in still works */
      }
      navigate("/");
    } catch (err) {
      setError(getErrorMessage(err, "Authentication failed. Check your credentials."));
    } finally {
      setLoading(false);
    }
  };

  // Already signed in (e.g. opened /login in a new tab): go straight to the app
  if (user) return <Navigate to="/" replace />;

  const showInfo = (text: string) => {
    setError(null);
    setInfo(text);
  };

  return (
    <div
      className="relative flex min-h-screen w-full overflow-hidden text-slate-800 antialiased"
      style={{ background: "linear-gradient(135deg, #fbfbff 0%, #f4f3ff 45%, #f8f9ff 100%)" }}
    >
      {/* Left: story */}
      <section className="relative hidden flex-1 flex-col px-14 py-10 lg:flex xl:px-20">
        {/* background glow */}
        <div
          className="pointer-events-none absolute -right-24 top-24 h-[520px] w-[520px] rounded-full"
          style={{ background: "radial-gradient(circle, rgb(129 120 245 / 0.22), transparent 65%)" }}
        />
        <svg className="pointer-events-none absolute right-6 top-[210px] w-[240px]" viewBox="0 0 300 120" fill="none">
          <path d="M0 110 C90 100 160 70 285 22" stroke="#8b83f5" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
          <circle cx="285" cy="22" r="5" fill="#6d5ff0" />
        </svg>

        <div className="relative z-10 flex items-center gap-3 -ml-4 lg:-ml-6">
          <img
            src="/logo-transparent.png"
            alt="WorkforceAI Predictive Platform"
            className="h-10 w-auto max-w-[240px] object-contain drop-shadow-sm"
          />
        </div>

        <div className="relative z-10 mt-10 w-full max-w-[660px] mx-auto text-center flex flex-col items-center">
          <div className="mt-5 min-h-[165px] w-full flex flex-col items-center justify-center overflow-hidden text-center">
            <h1
              className={`text-[44px] font-extrabold leading-[1.12] tracking-tight xl:text-[52px] text-center ${
                animStage === "exit-left"
                  ? "-translate-x-12 opacity-0 transition-all duration-500 ease-in"
                  : animStage === "enter-bottom"
                  ? "translate-y-10 opacity-0 transition-none"
                  : "translate-x-0 translate-y-0 opacity-100 transition-all duration-700 ease-out"
              }`}
            >
              <span className="block text-slate-900">Enterprise AI to</span>
              <span
                className="block bg-clip-text text-transparent transition-all duration-300"
                style={{ backgroundImage: ROTATING_PHRASES[phraseIndex].gradient }}
              >
                {ROTATING_PHRASES[phraseIndex].action}
              </span>
            </h1>
            <p
              className={`mt-4 max-w-[520px] mx-auto text-[15px] leading-relaxed text-slate-600 text-center ${
                animStage === "exit-left"
                  ? "-translate-x-8 opacity-0 transition-all duration-500 ease-in"
                  : animStage === "enter-bottom"
                  ? "translate-y-6 opacity-0 transition-none"
                  : "translate-x-0 translate-y-0 opacity-100 transition-all duration-700 ease-out"
              }`}
            >
              {ROTATING_PHRASES[phraseIndex].detail}
            </p>
          </div>

          {/* Centered Stepper dots / slider */}
          <div className="mt-4 flex items-center justify-center gap-2">
            {ROTATING_PHRASES.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  setPhraseIndex(i);
                  setAnimStage("visible");
                }}
                aria-label={`Go to slide ${i + 1}`}
                className={`h-1.5 rounded-full transition-all duration-500 ${
                  i === phraseIndex ? "w-8 bg-indigo-600 shadow-sm" : "w-2 bg-slate-300 hover:bg-slate-400"
                }`}
              />
            ))}
          </div>

          <ul className="mt-9 flex flex-wrap justify-center gap-4 sm:flex-nowrap sm:gap-x-5">
            {FEATURES.map(({ icon: Icon, title, note, tone, bg }) => (
              <li key={title} className="flex items-center gap-2.5 rounded-xl border border-slate-200/60 bg-white/60 px-2.5 py-1.5 shadow-xs">
                <span
                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg"
                  style={{ background: bg, color: tone }}
                >
                  <Icon className="h-4.5 w-4.5" />
                </span>
                <span className="whitespace-nowrap leading-tight text-left">
                  <span className="block text-[13px] font-semibold text-slate-900">{title}</span>
                  <span className="block text-[11px] text-slate-500">{note}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative z-10 mt-8 flex-1">
          <HeroPreview />
        </div>

        <ul className="relative z-10 mt-6 flex flex-wrap items-center gap-x-8 gap-y-2 text-[13px] text-slate-600">
          <li className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-600" /> Enterprise-grade security
          </li>
          <li className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-slate-500" /> JWT authentication
          </li>
          <li className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-slate-500" /> Complete audit trails
          </li>
        </ul>
      </section>

      {/* Right: sign in */}
      <section className="relative flex w-full flex-col border-l border-white/60 bg-white/55 px-6 py-8 backdrop-blur-sm sm:px-12 lg:w-[46%] lg:max-w-[720px] lg:px-16">
        <div className="flex justify-between lg:justify-end">
          <div className="flex items-center gap-2.5 lg:hidden">
            <img
              src="/logo-transparent.png"
              alt="WorkforceAI"
              className="h-8 w-auto max-w-[190px] object-contain"
            />
          </div>
          <button
            type="button"
            onClick={() => showInfo("Need a hand? Contact your HR administrator to get an account or reset access.")}
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-600 hover:text-slate-900"
          >
            <CircleHelp className="h-4 w-4" /> Need help?
          </button>
        </div>

        <div className="flex flex-1 items-center py-8">
          <div
            className="mx-auto w-full max-w-[540px] rounded-2xl border border-white bg-white p-8 sm:p-9"
            style={{ boxShadow: "0 30px 70px -30px rgb(67 56 202 / 0.25), 0 4px 14px rgb(30 27 75 / 0.06)" }}
          >
            <h2 className="text-[27px] font-bold tracking-tight text-slate-900">
              Welcome to{" "}
              <span
                className="bg-clip-text text-transparent"
                style={{ backgroundImage: "linear-gradient(90deg, #4f46e5, #6d5ff0)" }}
              >
                WorkforceAI
              </span>
            </h2>
            <p className="mt-1.5 text-sm text-slate-500">Sign in to access your workforce analytics platform.</p>

            <div className="mt-6 grid grid-cols-3 gap-3" role="radiogroup" aria-label="Demo role">
              {ROLES.map(({ id, label, note, icon: Icon }) => {
                const on = role === id;
                return (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => pickRole(id)}
                    className={`flex items-center gap-2 rounded-xl border px-2.5 py-3 text-left transition-all ${
                      on
                        ? "border-indigo-300 bg-indigo-50/70 shadow-[0_0_0_3px_rgb(99_102_241/0.12)]"
                        : "border-slate-200 bg-slate-50/60 hover:border-indigo-200 hover:bg-white"
                    }`}
                  >
                    <Icon className={`h-[18px] w-[18px] flex-shrink-0 ${on ? "text-indigo-600" : "text-slate-500"}`} />
                    <span className="min-w-0 leading-tight">
                      <span className="block truncate text-[13px] font-semibold text-slate-900">{label}</span>
                      <span className="block whitespace-nowrap text-[10px] text-slate-500">{note}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Quick Employee Profile Switcher — toggle button + collapsible list with all 47 employees */}
            {role === "employee" && (() => {
              const initials = (n: string) => n.split(" ").map(p => p[0]).join("").slice(0, 2);
              const active = EMPLOYEE_PROFILES.find(p => p.email === email);
              const filteredProfiles = EMPLOYEE_PROFILES.filter(p => {
                if (!profileSearch.trim()) return true;
                const q = profileSearch.toLowerCase();
                return p.name.toLowerCase().includes(q) || p.title.toLowerCase().includes(q) || p.email.toLowerCase().includes(q);
              });

              return (
                <div className="relative mt-3">
                  {/* Toggle button */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowProfilePicker(v => !v);
                      setProfileSearch("");
                    }}
                    className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left transition hover:bg-slate-100"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      {active ? (
                        <>
                          <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-indigo-600 text-[9px] font-bold text-white">
                            {initials(active.name)}
                          </span>
                          <span className="truncate text-[12px] font-semibold text-slate-800">{active.name}</span>
                          <span className="truncate text-[11px] text-slate-400">— {active.title}</span>
                        </>
                      ) : (
                        <span className="text-[12px] text-slate-500">Select employee profile ({EMPLOYEE_PROFILES.length} available)…</span>
                      )}
                    </span>
                    <span
                      className={`ml-2 text-slate-400 transition-transform duration-200 ${showProfilePicker ? "rotate-180" : ""}`}
                      style={{ fontSize: 10 }}
                    >▼</span>
                  </button>

                  {/* Floating popup — absolutely positioned, does NOT expand the card */}
                  {showProfilePicker && (
                    <>
                      {/* Click-away backdrop */}
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setShowProfilePicker(false)}
                      />
                      {/* Popup panel */}
                      <div
                        className="absolute left-0 right-0 z-50 mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
                        style={{ top: "100%" }}
                      >
                        {/* Search input */}
                        <div className="border-b border-slate-100 bg-slate-50 p-2">
                          <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                            <input
                              type="text"
                              placeholder={`Search ${EMPLOYEE_PROFILES.length} employees by name or title...`}
                              value={profileSearch}
                              onChange={(e) => setProfileSearch(e.target.value)}
                              className="w-full rounded-md border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-[11px] text-slate-700 placeholder-slate-400 focus:border-indigo-500 focus:outline-none"
                              autoFocus
                            />
                          </div>
                        </div>

                        {/* Column header */}
                        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-3 py-1.5 text-[9px] font-semibold uppercase tracking-wider text-slate-400">
                          <span>{filteredProfiles.length} of {EMPLOYEE_PROFILES.length} Profiles</span>
                          <span>Click to Auto-fill</span>
                        </div>

                        {/* Rows — scrollable */}
                        <div className="overflow-y-auto" style={{ maxHeight: "220px" }}>
                          {filteredProfiles.length === 0 ? (
                            <div className="py-6 text-center text-[12px] text-slate-400">
                              No matching employee profiles found.
                            </div>
                          ) : (
                            filteredProfiles.map((p) => {
                              const isActive = email === p.email;
                              return (
                                <button
                                  key={p.email}
                                  type="button"
                                  onClick={() => {
                                    setEmail(p.email);
                                    setPassword(DEMO_PASSWORD);
                                    setRole("employee");
                                    setError(null);
                                    setInfo(null);
                                    setShowProfilePicker(false);
                                    setProfileSearch("");
                                  }}
                                  className={`grid w-full grid-cols-[24px_1fr] gap-x-2 items-center px-3 py-2 text-left transition-colors border-b border-slate-100/80 last:border-b-0 ${
                                    isActive
                                      ? "bg-indigo-50 border-l-[3px] border-indigo-500"
                                      : "border-l-[3px] border-transparent hover:bg-slate-50"
                                  }`}
                                >
                                  <span className={`text-[11px] font-semibold tabular-nums ${isActive ? "text-indigo-500" : "text-slate-400"}`}>
                                    {p.sno}
                                  </span>
                                  <span className="flex min-w-0 items-center gap-2">
                                    <span className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${
                                      isActive ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-600"
                                    }`}>
                                      {initials(p.name)}
                                    </span>
                                    <span className="min-w-0">
                                      <span className={`block truncate text-[12px] font-semibold leading-tight ${
                                        isActive ? "text-indigo-700" : "text-slate-800"
                                      }`}>{p.name}</span>
                                      <span className="block truncate text-[10px] leading-tight text-slate-400">{p.title}</span>
                                    </span>
                                  </span>
                                </button>
                              );
                            })
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              );
            })()}

            {error && (
              <div
                role="alert"
                className="mt-5 flex items-center gap-3 rounded-lg border border-rose-200 bg-rose-50 p-3.5 text-sm text-rose-700"
              >
                <AlertCircle className="h-5 w-5 flex-shrink-0" />
                <p>{error}</p>
              </div>
            )}
            {info && !error && (
              <div
                role="status"
                className="mt-5 flex items-center gap-3 rounded-lg border border-indigo-100 bg-indigo-50/70 p-3.5 text-[13px] text-indigo-800"
              >
                <Info className="h-4 w-4 flex-shrink-0" />
                <p>{info}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-5 space-y-5">
              <div>
                <label htmlFor="login-email" className="mb-1.5 block text-[13.5px] font-semibold text-slate-900">
                  Corporate Email
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
                  <input
                    id="login-email"
                    type="text"
                    required
                    autoComplete="username"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setRole(null);
                    }}
                    placeholder="admin@workforce.local"
                    className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-sm text-slate-900 placeholder-slate-400 shadow-sm transition focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-100"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="login-password" className="mb-1.5 block text-[13.5px] font-semibold text-slate-900">
                  Password
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
                  <input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-12 text-sm text-slate-900 placeholder-slate-400 shadow-sm transition focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-100"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:text-slate-700"
                  >
                    {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-[13px]">
                <label className="flex cursor-pointer items-center gap-2 text-slate-700">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 accent-indigo-600"
                  />
                  Remember me
                </label>
                <button
                  type="button"
                  onClick={() =>
                    showInfo("Password resets are handled by your HR administrator. Ask them to reset your account.")
                  }
                  className="font-medium text-indigo-600 hover:underline"
                >
                  Forgot password?
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[15px] font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
                style={{
                  background: "linear-gradient(180deg, #5148ee, #4338ca)",
                  boxShadow: "0 12px 24px -10px rgb(67 56 202 / 0.65), inset 0 1px 0 rgb(255 255 255 / 0.18)",
                }}
              >
                {loading ? (
                  "Signing in..."
                ) : (
                  <>
                    Sign In to Platform <ArrowRight className="h-[18px] w-[18px]" />
                  </>
                )}
              </button>
            </form>

            <div className="my-5 flex items-center gap-4 text-[11px] font-medium uppercase tracking-wider text-slate-400">
              <span className="h-px flex-1 bg-slate-200" /> or <span className="h-px flex-1 bg-slate-200" />
            </div>

            <button
              type="button"
              onClick={() =>
                showInfo("Single sign-on isn't configured for this workspace. Sign in with your corporate email.")
              }
              className="flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white text-[14.5px] font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50"
            >
              <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden="true">
                <path
                  fill="#EA4335"
                  d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"
                />
                <path
                  fill="#4285F4"
                  d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.2 5.5-4.7 7.2l7.6 5.9c4.4-4.1 6.9-10.1 6.9-17.6z"
                />
                <path
                  fill="#FBBC05"
                  d="M10.5 28.7c-.5-1.4-.8-3-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C.9 16.4 0 20.1 0 24s.9 7.6 2.6 10.8l7.9-6.1z"
                />
                <path
                  fill="#34A853"
                  d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"
                />
              </svg>
              Continue with Google (SSO)
            </button>

            <p className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-500">
              <ShieldCheck className="h-4 w-4 text-emerald-600" /> Your data is secure and encrypted
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
