import jwt from "jsonwebtoken";
import { ApiError } from "../utils.js";
import { User } from "../models/user.models.js";
import { Session } from "../models/session.models.js";

const verifyJWT = async (req, res, next) => {
  try {
    // ==========================================
    // GET ACCESS TOKEN
    // ==========================================

    const authHeader = req.headers.authorization;

    if (
      !authHeader ||
      !authHeader.startsWith("Bearer ")
    ) {
      throw new ApiError(
        401,
        "Unauthorized request",
      );
    }

    const token = authHeader.split(" ")[1];

    // ==========================================
    // VERIFY ACCESS TOKEN
    // ==========================================

    const decodedToken = jwt.verify(
      token,
      process.env.ACCESS_TOKEN_SECRET,
    );

    // ==========================================
    // FIND USER
    // ==========================================

    const user = await User.findById(
      decodedToken._id,
    ).select("-password -refreshToken");

    if (!user) {
      throw new ApiError(
        401,
        "User not found",
      );
    }

    // ==========================================
    // CHECK ACTIVE SESSION
    // ==========================================

    const activeSession =
      await Session.findOne({
        userId: user._id,
        refreshToken:
          req.cookies?.refreshToken,
        expiresAt: {
          $gt: new Date(),
        },
      });

    if (!activeSession) {
      throw new ApiError(
        401,
        "Session expired. Please log in again.",
      );
    }

    // ==========================================
    // AUTHENTICATED
    // ==========================================

    req.user = user;

    next();

  } catch (error) {
    if (
      error.name === "TokenExpiredError"
    ) {
      return next(
        new ApiError(
          401,
          "Access token expired",
        ),
      );
    }

    if (
      error.name === "JsonWebTokenError"
    ) {
      return next(
        new ApiError(
          401,
          "Invalid access token",
        ),
      );
    }

    next(error);
  }
};

export { verifyJWT };