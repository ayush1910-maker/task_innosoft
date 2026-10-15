import sequelize from "../db/db.js";
import { DataTypes } from "sequelize";

const Wallet = sequelize.define(
    "wallets",
    {
        id:{
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
            allowNull: false
        },
        userId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            unique: true,
            references: {
                model: "users",
                key: "id"
            }
        },
        balance: {
            type: DataTypes.BIGINT,
            allowNull: false,
            defaultValue: 0,
            validate: {
                min: 0
            }
        },
        currency: {
            type: DataTypes.STRING(3),
            allowNull: false,
            defaultValue: "INR",
        },
        status: {
            type: DataTypes.ENUM("ACTIVE" , "BLOCKED" , "CLOSED"),
            allowNull: false,
            defaultValue: "ACTIVE"
        }
    },
    {
        tableName: "wallets",
        timestamps: "true"
    }
);

export default Wallet
