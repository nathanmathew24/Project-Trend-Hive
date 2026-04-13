import React, { useState, useCallback, useEffect } from "react";
import {
  BrowserRouter, Routes, Route, Navigate, useNavigate, useParams,
} from "react-router-dom";
import { trackPage } from "./lib/auth.js";

import HomePage        from "./pages/HomePage.jsx";
import LoginPage       from "./pages/LoginPage.jsx";
import SignUpPage      from "./pages/SignUpPage.jsx";
import ContactPage     from "./pages/ContactPage.jsx";
import DemoPage        from "./pages/DemoPage.jsx";
import AboutPage       from "./pages/AboutPage.jsx";
import FeaturesPage    from "./pages/FeaturesPage.jsx";
import HowItWorksPage  from "./pages/HowItWorksPage.jsx";

import DashboardPage     from "./pages/DashboardPage.jsx";
import AreaDetailPage    from "./pages/AreaDetailPage.jsx";
import OpportunitiesPage from "./pages/OpportunitiesPage.jsx";
import AlertsPage        from "./pages/AlertsPage.jsx";
import CategoriesPage    from "./pages/CategoriesPage.jsx";
import AICopilotPage     from "./pages/AICopilotPage.jsx";
import ProfilePage       from "./pages/ProfilePage.jsx";
import MapPage           from "./pages/MapPage.jsx";
import FinancialPage     from "./pages/FinancialPage.jsx";

const PROTECTED = [
  "dashboard",
  "opportunities",
  "alerts",
  "categories",
  "map",
  "ai-copilot",
  "profile",
  "area-detail",
  "financial",
];

export const AuthContext = React.createContext({});

function useLegacyNavigate(loggedIn) {
  const nav = useNavigate();

  return useCallback((target, id = null) => {
    if (PROTECTED.includes(target) && !loggedIn) {
      nav("/login");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    switch (target) {
      case "home":
        nav("/");
        break;
      case "login":
        nav("/login");
        break;
      case "signup":
        nav("/signup");
        break;
      case "contact":
        nav("/contact");
        break;
      case "demo":
        nav("/demo");
        break;
      case "about":
        nav("/about");
        break;
      case "features":
        nav("/features");
        break;
      case "how-it-works":
        nav("/how-it-works");
        break;
      case "dashboard":
        nav("/app/dashboard");
        break;
      case "opportunities":
        nav("/app/opportunities");
        break;
      case "alerts":
        nav("/app/alerts");
        break;
      case "categories":
        nav("/app/categories");
        break;
      case "map":
        nav("/app/map");
        break;
      case "ai-copilot":
        nav("/app/ai-copilot");
        break;
      case "profile":
        nav("/app/profile");
        break;
      case "financial":
        nav("/app/financial");
        break;
      case "area-detail":
        if (id) nav(`/app/areas/${encodeURIComponent(id)}`);
        else nav("/app/dashboard");
        break;
      default:
        nav("/");
    }

    trackPage(target);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [nav, loggedIn]);
}

function LegacyWrapped({ Component }) {
  const {
    loggedIn,
    setLoggedIn,
    userEmail,
    setUserEmail,
    userName,
    setUserName,
  } = React.useContext(AuthContext);

  const navigate = useLegacyNavigate(loggedIn);

  return (
    <Component
      navigate={navigate}
      loggedIn={loggedIn}
      setLoggedIn={setLoggedIn}
      userEmail={userEmail}
      setUserEmail={setUserEmail}
      userName={userName}
      setUserName={setUserName}
    />
  );
}

function ProtectedRoute({ Component }) {
  const { loggedIn } = React.useContext(AuthContext);

  if (!loggedIn) {
    return <Navigate to="/login" replace />;
  }

  return <LegacyWrapped Component={Component} />;
}

function PublicOnlyRoute({ Component }) {
  const { loggedIn } = React.useContext(AuthContext);

  if (loggedIn) {
    return <Navigate to="/app/dashboard" replace />;
  }

  return <LegacyWrapped Component={Component} />;
}

function ProtectedAreaDetailRoute() {
  const { areaId } = useParams();
  const {
    loggedIn,
    userEmail,
    userName,
  } = React.useContext(AuthContext);

  const navigate = useLegacyNavigate(loggedIn);

  if (!loggedIn) {
    return <Navigate to="/login" replace />;
  }

  return (
    <AreaDetailPage
      navigate={navigate}
      areaId={areaId}
      userEmail={userEmail}
      userName={userName}
    />
  );
}

export default function App() {
  const [loggedIn, setLoggedIn] = useState(
    localStorage.getItem("loggedIn") === "true"
  );
  const [userEmail, setUserEmail] = useState(
    localStorage.getItem("userEmail") || ""
  );
  const [userName, setUserName] = useState(
    localStorage.getItem("userName") || ""
  );

  useEffect(() => {
    if (loggedIn) {
      localStorage.setItem("loggedIn", "true");
    } else {
      localStorage.removeItem("loggedIn");
    }
  }, [loggedIn]);

  useEffect(() => {
    if (userEmail) {
      localStorage.setItem("userEmail", userEmail);
    } else {
      localStorage.removeItem("userEmail");
    }
  }, [userEmail]);

  useEffect(() => {
    if (userName) {
      localStorage.setItem("userName", userName);
    } else {
      localStorage.removeItem("userName");
    }
  }, [userName]);

  return (
    <AuthContext.Provider
      value={{
        loggedIn,
        setLoggedIn,
        userEmail,
        setUserEmail,
        userName,
        setUserName,
      }}
    >
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/"             element={<LegacyWrapped Component={HomePage} />} />
          <Route path="/login"        element={<PublicOnlyRoute Component={LoginPage} />} />
          <Route path="/signup"       element={<PublicOnlyRoute Component={SignUpPage} />} />
          <Route path="/contact"      element={<LegacyWrapped Component={ContactPage} />} />
          <Route path="/demo"         element={<LegacyWrapped Component={DemoPage} />} />
          <Route path="/about"        element={<LegacyWrapped Component={AboutPage} />} />
          <Route path="/features"     element={<LegacyWrapped Component={FeaturesPage} />} />
          <Route path="/how-it-works" element={<LegacyWrapped Component={HowItWorksPage} />} />

          {/* Protected App pages */}
          <Route path="/app/dashboard"     element={<ProtectedRoute Component={DashboardPage} />} />
          <Route path="/app/opportunities" element={<ProtectedRoute Component={OpportunitiesPage} />} />
          <Route path="/app/alerts"        element={<ProtectedRoute Component={AlertsPage} />} />
          <Route path="/app/categories"    element={<ProtectedRoute Component={CategoriesPage} />} />
          <Route path="/app/map"           element={<ProtectedRoute Component={MapPage} />} />
          <Route path="/app/ai-copilot"    element={<ProtectedRoute Component={AICopilotPage} />} />
          <Route path="/app/profile"       element={<ProtectedRoute Component={ProfilePage} />} />
          <Route path="/app/financial"     element={<ProtectedRoute Component={FinancialPage} />} />
          <Route path="/app/areas/:areaId" element={<ProtectedAreaDetailRoute />} />

          {/* Fallbacks */}
          <Route
            path="/app"
            element={
              loggedIn
                ? <Navigate to="/app/dashboard" replace />
                : <Navigate to="/login" replace />
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthContext.Provider>
  );
}