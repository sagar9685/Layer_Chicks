const { sql, poolPromise } = require("../db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

// ============================================================
// ADMIN SIGNUP
// ============================================================

exports.signupAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Full name, email and password are required",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters",
      });
    }

    const pool = await poolPromise;

    const normalizedEmail = email.trim().toLowerCase();

    // Check existing admin
    const existingAdmin = await pool
      .request()
      .input("Email", sql.NVarChar(150), normalizedEmail).query(`
        SELECT AdminId
        FROM AdminUsers
        WHERE Email = @Email
      `);

    if (existingAdmin.recordset.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Admin with this email already exists",
      });
    }

    // Hash Password
    const passwordHash = await bcrypt.hash(password, 12);

    // Insert Admin
    const result = await pool
      .request()

      .input("Email", sql.NVarChar(150), normalizedEmail)
      .input("PasswordHash", sql.NVarChar(255), passwordHash).query(`
        INSERT INTO AdminUsers
        (
        
          Email,
          PasswordHash
        )
        OUTPUT
          INSERTED.AdminId,
          
          INSERTED.Email,
          INSERTED.CreatedAt
        VALUES
        (
       
          @Email,
          @PasswordHash
        )
      `);

    const admin = result.recordset[0];

    res.status(201).json({
      success: true,
      message: "Admin account created successfully",
      admin,
    });
  } catch (error) {
    console.error("Admin Signup Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to create admin account",
      error: error.message,
    });
  }
};

// ============================================================
// ADMIN LOGIN
// ============================================================

exports.loginAdmin = async (req, res) => {
  try {
    const { email, password, rememberMe } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET is missing in .env");

      return res.status(500).json({
        success: false,
        message: "Server authentication configuration error",
      });
    }

    const pool = await poolPromise;

    const normalizedEmail = email.trim().toLowerCase();

    const result = await pool
      .request()
      .input("Email", sql.NVarChar(150), normalizedEmail).query(`
        SELECT
          AdminId,
          Email,
          PasswordHash,
          IsActive
        FROM AdminUsers
        WHERE Email = @Email
      `);

    if (result.recordset.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const admin = result.recordset[0];

    if (!admin.IsActive) {
      return res.status(403).json({
        success: false,
        message: "Admin account is inactive",
      });
    }

    const isPasswordValid = await bcrypt.compare(password, admin.PasswordHash);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    /*
      Remember Me:

      true  -> 3650 days
      false -> 1 day

      Agar aap hamesha long login chahte ho,
      to expiresIn hamesha "3650d" kar sakte ho.
    */

    const expiresIn = rememberMe ? "3650d" : "1d";

    const token = jwt.sign(
      {
        adminId: admin.AdminId,
        email: admin.Email,
        role: "admin",
      },
      process.env.JWT_SECRET,
      {
        expiresIn,
      },
    );

    return res.status(200).json({
      success: true,
      message: "Login successful",

      token,

      admin: {
        id: admin.AdminId,
        email: admin.Email,
        role: "admin",
      },

      expiresIn,
    });
  } catch (error) {
    console.error("Admin Login Error:", error);

    return res.status(500).json({
      success: false,
      message: "Login failed",
      error: error.message,
    });
  }
};
