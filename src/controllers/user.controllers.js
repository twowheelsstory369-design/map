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
    const { email, password } = req.body;

    // Check required fields
    if (!email || !password) {
      throw new ApiError(
        400,
        "Email and password are required",
      );
    }

    // Find user
    const user = await User.findOne({ email });

    if (!user) {
      throw new ApiError(
        404,
        "User not found",
      );
    }

    // Check password
    const isPasswordValid =
      await user.isPasswordCorrect(password);

    if (!isPasswordValid) {
      throw new ApiError(
        401,
        "Password is incorrect",
      );
    }

    // ==========================================
    // CHECK ACTIVE SESSION LIMIT
    // ==========================================

    const activeSessions = await Session.countDocuments({
      expiresAt: {
        $gt: new Date(),
      },
    });

    console.log(
      `Active login sessions: ${activeSessions}`,
    );

    if (activeSessions >= 10) {
      throw new ApiError(
        403,
        "Login limit reached. Only 10 devices can be logged in at a time.",
      );
    }

    // ==========================================
    // GENERATE TOKENS
    // ==========================================

    const {
      accessToken,
      refreshToken,
    } = await generateAccessAndRefreshToken(user._id);

    // ==========================================
    // CREATE NEW LOGIN SESSION
    // ==========================================

    const expiresAt = new Date(
      Date.now() + 1 * 24 * 60 * 60 * 1000,
    );

    await Session.create({
      userId: user._id,
      refreshToken,
      expiresAt,
    });

    // Remove sensitive information
    const loggedInUser = await User.findById(
      user._id,
    ).select("-password -refreshToken");

    // Cookie options
    const options = {
      httpOnly: true,
      secure: true,
    };

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

export {
  registerUser,
  loginUser,
  logoutUser,
};