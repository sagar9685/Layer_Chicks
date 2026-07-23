import React, { useState } from "react";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  UserCheck,
  RefreshCw,
  BarChart3,
  LogIn,
  ArrowRight,
} from "lucide-react";
import styles from "./Login.module.css";

const API_BASE_URL = "http://localhost:5007/api";

const Login = () => {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    rememberMe: false,
  });

  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));

    // Error remove while typing
    if (error) {
      setError("");
    }
  };

  // ============================================================
  // ADMIN LOGIN
  // ============================================================

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setLoading(true);
      setError("");

      const response = await fetch(`${API_BASE_URL}/admin/login`, {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          email: formData.email.trim(),
          password: formData.password,
          rememberMe: formData.rememberMe,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Login failed");
      }

      // ========================================================
      // SAVE LOGIN SESSION
      // ========================================================

      localStorage.setItem("adminToken", data.token);

      localStorage.setItem("admin", JSON.stringify(data.admin));

      // Optional: login timestamp
      localStorage.setItem("adminLoginTime", new Date().toISOString());

      // ========================================================
      // REDIRECT TO DASHBOARD
      // ========================================================

      window.location.href = "/dashboard";
    } catch (err) {
      console.error("Login Error:", err);

      setError(
        err.message || "Unable to login. Please check your credentials.",
      );
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // CONTINUE WITHOUT LOGIN
  // ============================================================

  const handleContinueWithoutLogin = () => {
    window.location.href = "/calenders";
  };

  return (
    <div className={styles.pageWrapper}>
      {/* ========================================================
          LEFT BRANDING SIDE
      ======================================================== */}

      <div className={styles.brandingSection}>
        <div className={styles.horizonGlow} aria-hidden="true" />

        <div className={styles.brandingContent}>
          {/* Header Logo */}

          <div className={styles.logoHeader}>
            <div className={styles.eggMark}>
              <svg
                viewBox="0 0 40 40"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M20 4C13 4 7 15 7 24c0 7.2 5.8 12 13 12s13-4.8 13-12C33 15 27 4 20 4Z"
                  fill="url(#eggGradient)"
                />

                <path
                  d="M13 20c1.5-1.8 3.6-2.6 5.4-1.6"
                  stroke="#1F2A1F"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  opacity="0.35"
                />

                <defs>
                  <linearGradient
                    id="eggGradient"
                    x1="7"
                    y1="4"
                    x2="33"
                    y2="36"
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop stopColor="#FBEFD2" />
                    <stop offset="1" stopColor="#F2B134" />
                  </linearGradient>
                </defs>
              </svg>
            </div>

            <div>
              <h2 className={styles.logoTitle}>LAYER</h2>

              <span className={styles.logoSubtitle}>POULTRY</span>
            </div>
          </div>

          {/* Title & Subtitle */}

          <h1 className={styles.mainHeading}>Layer Phoenix Poultry</h1>

          <p className={styles.subHeading}>Smart Poultry Management Platform</p>

          <p className={styles.description}>
            Manage farmers, placements, replacement forecasting, hatchery
            analytics, production planning, and reports from one centralized
            platform.
          </p>

          {/* Feature Grid */}

          <div className={styles.featureGrid}>
            <div className={styles.featureCard}>
              <div className={styles.featureIconBox}>
                <UserCheck size={19} />
              </div>

              <div>
                <h4>Farmer Management</h4>

                <p>Manage farmer profiles, contracts and history</p>
              </div>
            </div>

            <div className={styles.featureCard}>
              <div className={`${styles.featureIconBox} ${styles.yellowIcon}`}>
                <span>🐥</span>
              </div>

              <div>
                <h4>Placement Tracking</h4>

                <p>Track all placements in real-time</p>
              </div>
            </div>

            <div className={styles.featureCard}>
              <div className={styles.featureIconBox}>
                <RefreshCw size={19} />
              </div>

              <div>
                <h4>Replacement Forecast</h4>

                <p>Forecast upcoming replacements accurately</p>
              </div>
            </div>

            <div className={styles.featureCard}>
              <div className={styles.featureIconBox}>
                <BarChart3 size={19} />
              </div>

              <div>
                <h4>Executive Reports</h4>

                <p>Powerful reports for better decision making</p>
              </div>
            </div>
          </div>
        </div>

        {/* Decorative silhouette */}

        <svg
          className={styles.silhouetteOverlay}
          viewBox="0 0 600 120"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            d="M0 120V70L60 50l40 20 50-35 45 25 60-40 55 30 50-20 40 25 60-15 40 20 60-10V120Z"
            fill="rgba(0,0,0,0.18)"
          />
        </svg>
      </div>

      {/* ========================================================
          RIGHT FORM SIDE
      ======================================================== */}

      <div className={styles.formSection}>
        <div className={styles.cardContainer}>
          {/* Logo Badge */}

          <div className={styles.centerBadge}>
            <div className={styles.badgeIcon}>
              <svg
                viewBox="0 0 40 40"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M20 4C13 4 7 15 7 24c0 7.2 5.8 12 13 12s13-4.8 13-12C33 15 27 4 20 4Z"
                  fill="url(#eggGradientBadge)"
                />

                <defs>
                  <linearGradient
                    id="eggGradientBadge"
                    x1="7"
                    y1="4"
                    x2="33"
                    y2="36"
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop stopColor="#FBEFD2" />
                    <stop offset="1" stopColor="#F2B134" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
          </div>

          {/* Form Header */}

          <div className={styles.formHeader}>
            <h3>
              <span className={styles.waveHand}>👋</span> Welcome Back
            </h3>

            <p>Sign in to access Layer Poultry ERP</p>
          </div>

          {/* Error Message */}

          {error && (
            <div
              style={{
                color: "#dc2626",
                background: "#fee2e2",
                border: "1px solid #fecaca",
                padding: "10px 12px",
                borderRadius: "8px",
                fontSize: "14px",
                marginBottom: "16px",
                textAlign: "center",
              }}
            >
              {error}
            </div>
          )}

          {/* Form */}

          <form onSubmit={handleSubmit} className={styles.form}>
            {/* Email */}

            <div className={styles.inputGroup}>
              <label htmlFor="email">Email Address</label>

              <div className={styles.inputWrapper}>
                <Mail className={styles.fieldIcon} size={18} />

                <input
                  type="email"
                  id="email"
                  name="email"
                  placeholder="Enter your email address"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  disabled={loading}
                />
              </div>
            </div>

            {/* Password */}

            <div className={styles.inputGroup}>
              <label htmlFor="password">Password</label>

              <div className={styles.inputWrapper}>
                <Lock className={styles.fieldIcon} size={18} />

                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  name="password"
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  disabled={loading}
                />

                <button
                  type="button"
                  className={styles.passwordToggle}
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  disabled={loading}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Controls */}

            <div className={styles.formControls}>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  name="rememberMe"
                  checked={formData.rememberMe}
                  onChange={handleChange}
                  disabled={loading}
                />

                <span>Remember Me</span>
              </label>

              <a href="#forgot" className={styles.forgotLink}>
                Forgot Password?
              </a>
            </div>

            {/* Submit Button */}

            <button
              type="submit"
              className={styles.submitBtn}
              disabled={loading}
            >
              {loading ? (
                <>
                  <RefreshCw size={18} className={styles.loadingIcon} />

                  <span>Signing In...</span>
                </>
              ) : (
                <>
                  <LogIn size={18} />

                  <span>Sign In</span>
                </>
              )}
            </button>

            {/* Divider */}

            <div className={styles.divider}>
              <span>or</span>
            </div>

            {/* Continue Without Login */}

            <button
              type="button"
              className={styles.ghostBtn}
              onClick={handleContinueWithoutLogin}
              disabled={loading}
            >
              <span>Continue without login</span>

              <ArrowRight size={17} />
            </button>
          </form>

          {/* Footer */}

          <div className={styles.cardFooter}>
            <p>
              © {new Date().getFullYear()} Layer Poultry ERP. All rights
              reserved.
            </p>

            <span>Version 2.0.0</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
