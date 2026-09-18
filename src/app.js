import express from "express";
import cookieParser from "cookie-parser";

const app = express();

// express config
app.use(express.json());
app.use(cookieParser());

// import routes
import { userRouter } from "./routes/user.routes.js";

// routes declaration
app.use("/api", userRouter);

// error
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.statusCode || 500).json({
    message: err.message || "Internal Server Error",
  });
});

export { app };
