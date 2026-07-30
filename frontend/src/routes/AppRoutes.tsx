import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "../layouts/Layout";

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route
            path="/"
            element={
              <div className="p-6 bg-slate-950/40 rounded-xl border border-slate-800 backdrop-blur-sm">
                <h2 className="text-2xl font-bold text-white mb-2">
                  Welcome to Enterprise Workforce Analytics
                </h2>
                <p className="text-slate-400">
                  This is the portal home screen shell. Module implementations
                  will commence in Sprint 2.
                </p>
              </div>
            }
          />
          <Route
            path="/dashboard"
            element={
              <div className="p-6 bg-slate-950/40 rounded-xl border border-slate-800 backdrop-blur-sm">
                <h2 className="text-2xl font-bold text-white mb-2">
                  Analytics Dashboard Shell
                </h2>
                <p className="text-slate-400">
                  Visual analytics panels and charts will be loaded here using
                  Recharts.
                </p>
              </div>
            }
          />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
