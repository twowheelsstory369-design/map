import { Router } from "express";
import { registerUser, loginUser, getCurrentUser } from "../controllers/user.controllers.js";
 import { verifyJWT } from "../middlewares/auth.middleware.js";

const userRouter = Router();

userRouter.route("/register").post(registerUser);
userRouter.route("/login").post(loginUser);
 userRouter.route("/me").get(verifyJWT, getCurrentUser);

export { userRouter };
