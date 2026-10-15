import sequelize from "../db/db.js";
import { DataTypes } from "sequelize";

const WalletTransaction = sequelize.define(
    "wallet_transactions",
    {
        id:{
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
            allowNull: false
        },
        walletId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: "walllets",
                key: "id"
            }
        },
        refrenceId: {
            type: DataTypes.STRING(100),
            allowNull: false
        },
        type: {
            type: DataTypes.ENUM("CREDIT" , "DEBIT" , "TRANSFER"),
            allowNull: false
        },
        amount: {
            type: DataTypes.BIGINT,
            allowNull: false,
            validate: {
                min: 1
            }
        },
        balanceBefore: {
            type: DataTypes.BIGINT,
            allowNull: false
        },
        balanceAfter: {
            type: DataTypes.BIGINT,
            allowNull: false
        },
        description: {
            type: DataTypes.STRING(255),
            allowNull: true
        },
        counterpartyWalletId: {
            type: DataTypes.INTEGER,
            allowNull: true
        }
    },
    {
        tableName: "wallet_transactions",
        timestamps: "true",
    }
);

export default WalletTransaction
