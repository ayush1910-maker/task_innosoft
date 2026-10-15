import User from "./user.model.js";
import Wallet from "./wallet.model.js";
import WalletTransaction from "./walletTransaction.model.js";

User.hasOne(Wallet , {
    foreignKey: "userId",
    as : "wallet"
})

Wallet.belongsTo(User , {
    foreignKey: "userId",
    as: "user"
})

Wallet.hasMany(WalletTransaction , {
    foreignKey: "walletId",
    as: "transaction"
})

WalletTransaction.belongsTo(Wallet, {
    foreignKey: "walletId",
    as: "wallet"
});

export {
    User,
    Wallet,
    WalletTransaction
}