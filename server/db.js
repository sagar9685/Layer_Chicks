const sql = require("mssql");

const dbConfig = {
  user: "sa",
  password: "Ph@hoenix#g",
  server: "192.168.0.130",
  database: "PhxGroupERP",
  options: {
    trustServerCertificate: true,
    enableArithAbort: true,
  },
  connectionTimeout: 30000,
  requestTimeout: 60000,
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

// ✅ poolPromise (USED BY schedule & month APIs)
const poolPromise = new sql.ConnectionPool(dbConfig)
  .connect()
  .then((pool) => {
    console.log("✅ SQL Server connected (pool)");
    return pool;
  })
  .catch((err) => {
    console.error("❌ DB Connection Failed:", err.message);
    throw err;
  });

// ✅ connectDB (USED BY /due & /expected)
const connectDB = async () => {
  try {
    if (!sql.connected) {
      await sql.connect(dbConfig);
      console.log("✅ SQL Server connected (single)");
    }
  } catch (err) {
    console.error("❌ DB Connection Failed:", err.message);
    throw err;
  }
};

module.exports = {
  sql,
  connectDB,
  poolPromise,
};
