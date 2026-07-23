import React from "react";
import {
  LayoutDashboard,
  Users,
  Repeat,
  TrendingUp,
  CalendarDays,
  ClipboardCheck,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  LogOut,
  Settings,
} from "lucide-react";
import styles from "./AdminSidebar.module.css";
import { useNavigate } from "react-router-dom";

const AdminSideBar = ({
  activeTab = "Dashboard",
  onSelectTab,
  isCollapsed,
  onToggleCollapse,
}) => {
  const navigate = useNavigate();

  const menuItems = [
    {
      name: "Dashboard",
      icon: LayoutDashboard,
      path: "/dashboard",
    },
    {
      name: "Farmers",
      icon: Users,
      path: "/farmeer",
    },
    {
      name: "Placement",
      icon: Repeat,
      path: "/placement",
    },
    {
      name: "Replacement Forecast",
      icon: TrendingUp,
      path: "/replacement",
    },
    {
      name: "Calendar",
      icon: CalendarDays,
      path: "/calenders",
    },
    {
      name: "Reports",
      icon: ClipboardCheck,
      path: "/report",
    },
  ];

  const handleNavigation = (item) => {
    if (onSelectTab) {
      onSelectTab(item.name);
    }

    navigate(item.path);
  };

  // =========================
  // LOGOUT
  // =========================
  const handleLogout = () => {
    const confirmLogout = window.confirm("Are you sure you want to logout?");

    if (!confirmLogout) return;

    // Remove login session
    localStorage.removeItem("adminToken");
    localStorage.removeItem("admin");

    // Optional: if you stored token with "token"
    localStorage.removeItem("token");

    // Redirect to login
    navigate("/", { replace: true });
  };

  return (
    <aside
      className={`${styles.sidebar} ${
        isCollapsed ? styles.collapsed : styles.expanded
      }`}
    >
      {/* Toggle Button */}
      <button
        onClick={onToggleCollapse}
        className={styles.toggleBtn}
        aria-label="Toggle Sidebar"
      >
        {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
      </button>

      {/* Brand */}
      <div className={styles.brandHeader}>
        <div className={styles.logoIcon}>
          <Sparkles size={isCollapsed ? 20 : 24} />
        </div>

        {!isCollapsed && (
          <div className={styles.logoText}>
            <h1>LayerPro</h1>
            <p>Phoenix Poultry</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className={styles.navContainer}>
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.name;

          return (
            <button
              key={item.name}
              onClick={() => handleNavigation(item)}
              className={`${styles.navItem} ${isActive ? styles.active : ""}`}
            >
              <Icon className={styles.icon} size={isCollapsed ? 20 : 18} />

              {!isCollapsed && <span>{item.name}</span>}

              {isCollapsed && <div className={styles.tooltip}>{item.name}</div>}
            </button>
          );
        })}
      </nav>

      {/* Promo Box */}
      {!isCollapsed && (
        <div className={styles.promoBox}>
          <p className={styles.promoTitle}>Plan Smart</p>

          <p className={styles.promoHeading}>Produce More</p>

          <p className={styles.promoText}>
            Efficient planning today for a better tomorrow.
          </p>
        </div>
      )}

      {/* Bottom Actions */}
      <div className={styles.bottomActions}>
        {/* Settings */}

        {/* Logout */}
        <button className={styles.bottomActionItem} onClick={handleLogout}>
          <LogOut size={isCollapsed ? 20 : 18} />

          {!isCollapsed && <span>Logout</span>}

          {isCollapsed && <div className={styles.tooltip}>Logout</div>}
        </button>
      </div>
    </aside>
  );
};

export default AdminSideBar;
