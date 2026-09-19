import { ApiError } from "../utils.js";
import { User } from "../models/user.models.js";
import { Session } from "../models/session.models.js";

// ==========================================
// Generate Access Token + Refresh Token
// ==========================================

const generateAccessAndRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);

    if (!user) {
      throw new ApiError(404, "User not found");
    }

    const accessToken = await user.generateAccessToken();
    const refreshToken = await user.generateRefreshToken();

    user.refreshToken = refreshToken;

    await user.save({
      validateBeforeSave: false,
    });

    return {
      accessToken,
      refreshToken,
    };
  } catch (error) {
    throw new ApiError(
      500,
      "Something went wrong while generating access and refresh token",
    );
  }
};

// ==========================================
// Register User
// ==========================================

const registerUser = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Check required fields
    if (!email || !password) {
      throw new ApiError(
        400,
        "Email and password are required",
      );
    }

    // Check whether user already exists
    const existedUser = await User.findOne({ email });

    if (existedUser) {
      throw new ApiError(
        409,
        "User with this email already exists",
      );
    }

    // Create user
    const user = await User.create({
      email,
      password,
    });

    // Remove sensitive fields
    const createdUser = await User.findById(user._id).select(
      "-password -refreshToken",
    );

    if (!createdUser) {
      throw new ApiError(
        500,
        "Something went wrong while registering the user",
      );
    }

    return res.status(201).json({
      createdUser,
      message: "User registered successfully",
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// Login User
// ==========================================

const loginUser = async (req, res, next) => {
  try {
    const {
      email,
      password,
      deviceId,
    } = req.body;

    // ==========================================
    // CHECK REQUIRED FIELDS
    // ==========================================

    if (!email || !password || !deviceId) {
      throw new ApiError(
        400,
        "Email, password and deviceId are required",
      );
    }

    // ==========================================
    // FIND USER
    // ==========================================

    const user = await User.findOne({ email });

    if (!user) {
      throw new ApiError(
        404,
        "User not found",
      );
    }

    // ==========================================
    // CHECK PASSWORD
    // ==========================================

    const isPasswordValid =
      await user.isPasswordCorrect(password);

    if (!isPasswordValid) {
      throw new ApiError(
        401,
        "Password is incorrect",
      );
    }

    const now = new Date();

    // ==========================================
    // CHECK EXISTING ACTIVE SESSION
    // ==========================================

    const existingSession = await Session.findOne({
      userId: user._id,
      expiresAt: {
        $gt: now,
      },
    });

    // ==========================================
    // USER ALREADY ACTIVE
    // ==========================================

    if (existingSession) {
      // ------------------------------------------
      // DIFFERENT DEVICE → REJECT
      // ------------------------------------------

      if (existingSession.deviceId !== deviceId) {
        throw new ApiError(
          403,
          "This account is already active on another device. Please log out from that device first.",
        );
      }

      // ------------------------------------------
      // SAME DEVICE → ALLOW
      // ------------------------------------------

      console.log(
        `User ${user._id} is logging in again from the same device.`,
      );
    }

    // ==========================================
    // CHECK MAXIMUM 10 ACTIVE USERS
    // ==========================================
    //
    // IMPORTANT:
    // We only need to perform this check when
    // this is a NEW active user.
    //
    // If the user already has a session on the
    // same device, they are already counted.
    // ==========================================

    if (!existingSession) {
      const activeUserIds = await Session.distinct(
        "userId",
        {
          expiresAt: {
            $gt: now,
          },
        },
      );

      console.log(
        `Active users: ${activeUserIds.length}`,
      );

      if (activeUserIds.length >= 10) {
        throw new ApiError(
          403,
          "Login limit reached. Only 10 users can be active at a time.",
        );
      }
    }

    // ==========================================
    // GENERATE NEW TOKENS
    // ==========================================

    const {
      accessToken,
      refreshToken,
    } = await generateAccessAndRefreshToken(
      user._id,
    );

    // ==========================================
    // SESSION EXPIRATION
    // ==========================================

    const expiresAt = new Date(
      Date.now() + 1 * 24 * 60 * 60 * 1000,
    );

    // ==========================================
    // CREATE OR UPDATE SESSION
    // ==========================================

    if (existingSession) {
      // Same device:
      // reuse the existing session document
      // but rotate the refresh token.

      existingSession.refreshToken =
        refreshToken;

      existingSession.expiresAt =
        expiresAt;

      await existingSession.save();
    } else {
      // New user:
      // create a new session.

      await Session.create({
        userId: user._id,
        deviceId,
        refreshToken,
        expiresAt,
      });
    }

    // ==========================================
    // GET SAFE USER
    // ==========================================

    const loggedInUser = await User.findById(
      user._id,
    ).select("-password -refreshToken");

    if (!loggedInUser) {
      throw new ApiError(
        500,
        "Something went wrong while fetching logged in user",
      );
    }

    // ==========================================
    // COOKIE OPTIONS
    // ==========================================

    const options = {
      httpOnly: true,
      secure: true,
    };

    // ==========================================
    // RESPONSE
    // ==========================================

    return res
      .status(200)
      .cookie(
        "accessToken",
        accessToken,
        options,
      )
      .cookie(
        "refreshToken",
        refreshToken,
        options,
      )
      .json({
        user: {
          loggedInUser,
          accessToken,
          refreshToken,
        },
        message: "User logged in successfully",
      });

  } catch (error) {
    console.error(
      `Error in loginUser controller: ${error.message}`,
    );

    next(error);
  }
};

// ==========================================
// Logout User
// ==========================================

const logoutUser = async (req, res, next) => {
  try {
    const userId = req.user?._id;

    if (!userId) {
      throw new ApiError(
        401,
        "Unauthorized request",
      );
    }

    const refreshToken =
      req.cookies?.refreshToken;

    if (refreshToken) {
      await Session.findOneAndDelete({
        userId,
        refreshToken,
      });
    }

    // Clear cookies
    const options = {
      httpOnly: true,
      secure: true,
    };

    return res
      .status(200)
      .clearCookie("accessToken", options)
      .clearCookie("refreshToken", options)
      .json({
        message: "User logged out successfully",
      });
  } catch (error) {
    next(error);
  }
};

const getCurrentUser = async (req, res, next) => {
  try {
    return res.status(200).json({
      user: req.user,
      message: "Current user fetched successfully",
    });
  } catch (error) {
    next(error);
  }
};

export {
  registerUser,
  loginUser,
  logoutUser,
  getCurrentUser
};