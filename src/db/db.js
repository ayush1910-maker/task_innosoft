import { Sequelize } from "sequelize";
import mysql2 from "mysql2"
import config from "./envConfig.js";

const sequelize = new Sequelize(
    config.DB_NAME,
    config.DB_USER,
    config.DB_PASSWORD,
    {
        host: config.DB_HOST,
        dialect: "mysql",
        dialectModule: mysql2,
        pool: {
            min: 0,
            max: 10,
            idle: 10000,
        },
        define: {
            underscored: true,
            timestamps: true
        },
        logging: false
    }
);

export default sequelize