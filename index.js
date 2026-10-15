import express from "express"
import {createServer} from "http"
import cors from "cors"

import database from "./src/db/db.js"
import config from "./src/db/envConfig.js"

import "./src/models/association.js"

import walletRoutes from "./src/routes/wallet.route.js"

const app = express()
const server = createServer(app)

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use(express.static('public'))


app.use("/api/v1/wallet" , walletRoutes)

app.get("/" , (req , res) => {
    res.json({message : "Hello from the server"})
})

try {
    await database.authenticate();
    console.log(`Database connected at ${config.DB_HOST}`);
} catch (error) {
    console.log("Database connection failed");
}

server.listen(config.PORT , config.HOST , () => {
    console.log(`server running at http://${config.HOST}:${config.PORT}`);
})