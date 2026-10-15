import User from "../models/user.model.js";
import jwt from "jsonwebtoken";

const verifyJWT = async (req, res, next) => {
  try {
    let token = null;

    if (req.cookies?.accessToken) {
      token = req.cookies.accessToken;
    }
    else if (req.header("Authorization")) {
      
        const authHeader = req.header("Authorization");
      
      if (authHeader.startsWith("Bearer ")) {
        token = authHeader.replace("Bearer ", "").trim();
      }
    }

    if (!token) {
      return res.json({status: false,message: "Unauthorized: No token provided",});
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded?.id) {
        return res.json({status: false , message: "Invalid token payload"});
    }

    
    const user = await User.findByPk(decoded.id, {
      attributes: { exclude: ["password"] },
    });

    if (!user) {
      return res.json({status: false , message: "User not found"});
    }

    req.user = user;
    next();

  } catch (err) {
    
    console.error("JWT Error:", err.message);

    if (err.name === "TokenExpiredError") {
      return res.json({status: false , message: "Token expired. Please login again."});
    }

    if (err.name === "JsonWebTokenError") {
      return res.json({status: false , message: "Invalid token. Please login again."});
    }

    return res.json({status: false , message: "Unauthorized",});

  }
};

export default verifyJWT;