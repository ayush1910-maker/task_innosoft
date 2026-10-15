import jwt from "jsonwebtoken"
import dotenv from "dotenv"

dotenv.config();

const userId = Number(process.argv[2]);

if (!Number.isSafeInteger(userId) || userId <=0) {
    console.log("Usage: node generateToken.js <userId>");
    process.exit(1);    
}

const token = jwt.sign(
    {
        id: userId
    },
    process.env.JWT_SECRET,
    {
        expiresIn: "10d"
    }
)

console.log("JWT Token:" , token);