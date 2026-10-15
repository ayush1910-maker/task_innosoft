import sequelize from "../db/db.js";
import { Op, Transaction } from "sequelize";

import Wallet from "../models/wallet.model.js";
import WalletTransaction from "../models/walletTransaction.model.js";

import asyncHandler from "../utils/asyncHandler.js";

const parseAmount = (value) => {
    if (
        typeof value !== "number" &&
        typeof value !== "string"
    ) {
        return null;
    }

    const amount = Number(value);

    if (
        !Number.isSafeInteger(amount) ||
        amount <= 0
    ) {
        return null;
    }

    return amount;
};

const parseDate = (value) => {
    if (!value) {
        return null;
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return null;
    }

    return date;
};

const create_wallet = asyncHandler(async (req, res) => {
    const userId = req.user.id;

    const existingWallet = await Wallet.findOne({
        where: {
            userId
        }
    });

    if (existingWallet) {
        return res.status(409).json({
            status: false,
            message: "Wallet already exists"
        });
    }

    const wallet = await Wallet.create({
        userId,
        balance: 0,
        currency: "INR",
        status: "ACTIVE"
    });

    return res.status(201).json({
        status: true,
        message: "Wallet created successfully",
        data: wallet
    });
});

const deposit_money = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const amount = parseAmount(req.body.amount);
    const referenceId = req.get("Idempotency-Key");

    if (!amount) {
        return res.status(400).json({
            status: false,
            message: "Amount must be a positive integer in paise"
        });
    }

    if (
        !referenceId ||
        referenceId.length > 100
    ) {
        return res.status(400).json({
            status: false,
            message: "Valid Idempotency-Key header is required"
        });
    }

    const result = await sequelize.transaction(
        {
            isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED
        },
        async (t) => {
            const wallet = await Wallet.findOne({
                where: {
                    userId
                },
                transaction: t,
                lock: t.LOCK.UPDATE
            });

            if (!wallet) {
                const error = new Error("Wallet not found");
                error.statusCode = 404;
                throw error;
            }

            if (wallet.status !== "ACTIVE") {
                const error = new Error("Wallet is not active");
                error.statusCode = 400;
                throw error;
            }

            const existingTransaction =
                await WalletTransaction.findOne({
                    where: {
                        walletId: wallet.id,
                        referenceId
                    },
                    transaction: t
                });

            if (existingTransaction) {
                if (
                    existingTransaction.type !== "CREDIT" ||
                    Number(existingTransaction.amount) !== amount
                ) {
                    const error = new Error(
                        "Idempotency key already used with different request"
                    );
                    error.statusCode = 409;
                    throw error;
                }

                return {
                    transaction: existingTransaction,
                    duplicate: true
                };
            }

            const balanceBefore = Number(wallet.balance);
            const balanceAfter = balanceBefore + amount;

            if (!Number.isSafeInteger(balanceAfter)) {
                const error = new Error("Balance limit exceeded");
                error.statusCode = 400;
                throw error;
            }

            await wallet.update(
                {
                    balance: balanceAfter
                },
                {
                    transaction: t
                }
            );

            const walletTransaction =
                await WalletTransaction.create(
                    {
                        walletId: wallet.id,
                        referenceId,
                        type: "CREDIT",
                        amount,
                        balanceBefore,
                        balanceAfter,
                        description: "Wallet deposit"
                    },
                    {
                        transaction: t
                    }
                );

            return {
                transaction: walletTransaction,
                duplicate: false
            };
        }
    );

    return res.status(result.duplicate ? 200 : 201).json({
        status: true,
        message: result.duplicate
            ? "Deposit already processed"
            : "Money added successfully",
        data: result.transaction
    });
});

const transfer_money = asyncHandler(async (req, res) => {
    const senderUserId = req.user.id;
    const receiverUserId = Number(req.body.receiverUserId);

    const amount = parseAmount(req.body.amount);
    const referenceId = req.get("Idempotency-Key");

    if (
        !Number.isSafeInteger(receiverUserId) ||
        receiverUserId <= 0
    ) {
        return res.status(400).json({
            status: false,
            message: "Valid receiverUserId is required"
        });
    }

    if (receiverUserId === senderUserId) {
        return res.status(400).json({
            status: false,
            message: "Cannot transfer money to yourself"
        });
    }

    if (!amount) {
        return res.status(400).json({
            status: false,
            message: "Amount must be a positive integer in paise"
        });
    }

    if (
        !referenceId ||
        referenceId.length > 100
    ) {
        return res.status(400).json({
            status: false,
            message: "Valid Idempotency-Key header is required"
        });
    }

    const result = await sequelize.transaction(
        {
            isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED
        },
        async (t) => {
        
            const wallets = await Wallet.findAll({
                where: {
                    userId: {
                        [Op.in]: [
                            senderUserId,
                            receiverUserId
                        ]
                    }
                },
                order: [["id", "ASC"]],
                transaction: t,
                lock: t.LOCK.UPDATE
            });

            const senderWallet = wallets.find(
                (wallet) => wallet.userId === senderUserId
            );

            const receiverWallet = wallets.find(
                (wallet) => wallet.userId === receiverUserId
            );

            if (!senderWallet || !receiverWallet) {
                const error = new Error(
                    "Sender or receiver wallet not found"
                );
                error.statusCode = 404;
                throw error;
            }

            if (
                senderWallet.status !== "ACTIVE" ||
                receiverWallet.status !== "ACTIVE"
            ) {
                const error = new Error(
                    "Both wallets must be active"
                );
                error.statusCode = 400;
                throw error;
            }

            if (
                senderWallet.currency !== receiverWallet.currency
            ) {
                const error = new Error(
                    "Wallet currencies do not match"
                );
                error.statusCode = 400;
                throw error;
            }

            const existingTransaction =
                await WalletTransaction.findOne({
                    where: {
                        walletId: senderWallet.id,
                        referenceId
                    },
                    transaction: t
                });

            if (existingTransaction) {
                if (
                    existingTransaction.type !== "DEBIT" ||
                    Number(existingTransaction.amount) !== amount ||
                    existingTransaction.counterpartyWalletId !== receiverWallet.id
                ) {
                    const error = new Error(
                        "Idempotency key already used with different request"
                    );
                    error.statusCode = 409;
                    throw error;
                }

                return {
                    senderTransaction: existingTransaction,
                    duplicate: true
                };
            }

            const balanceBefore =
                Number(senderWallet.balance);

            const receiverBalanceBefore =
                Number(receiverWallet.balance);

            if (balanceBefore < amount) {
                const error = new Error("Insufficient wallet balance");
                error.statusCode = 400;
                throw error;
            }

            const senderBalanceAfter =
                balanceBefore - amount;

            const receiverBalanceAfter =
                receiverBalanceBefore + amount;

            if (
                !Number.isSafeInteger(senderBalanceAfter) ||
                !Number.isSafeInteger(receiverBalanceAfter)
            ) {
                const error = new Error("Balance limit exceeded");
                error.statusCode = 400;
                throw error;
            }

            await senderWallet.update(
                {
                    balance: senderBalanceAfter
                },
                {
                    transaction: t
                }
            );

            await receiverWallet.update(
                {
                    balance: receiverBalanceAfter
                },
                {
                    transaction: t
                }
            );

            const senderTransaction =
                await WalletTransaction.create(
                    {
                        walletId: senderWallet.id,
                        referenceId,
                        type: "DEBIT",
                        amount,
                        balanceBefore,
                        balanceAfter: senderBalanceAfter,
                        description: "Money transferred",
                        counterpartyWalletId: receiverWallet.id
                    },
                    {
                        transaction: t
                    }
                );

            await WalletTransaction.create(
                {
                    walletId: receiverWallet.id,
                    referenceId,
                    type: "CREDIT",
                    amount,
                    balanceBefore: receiverBalanceBefore,
                    balanceAfter: receiverBalanceAfter,
                    description: "Money received",
                    counterpartyWalletId: senderWallet.id
                },
                {
                    transaction: t
                }
            );

            return {
                senderTransaction,
                duplicate: false
            };
        }
    );

    return res.status(result.duplicate ? 200 : 201).json({
        status: true,
        message: result.duplicate
            ? "Transfer already processed"
            : "Money transferred successfully",
        data: result.senderTransaction
    });
});

const get_balance = asyncHandler(async (req, res) => {
    const wallet = await Wallet.findOne({
        where: {
            userId: req.user.id
        },
        attributes: [
            "id",
            "balance",
            "currency",
            "status"
        ]
    });

    if (!wallet) {
        return res.status(404).json({
            status: false,
            message: "Wallet not found"
        });
    }

    return res.status(200).json({
        status: true,
        data: {
            walletId: wallet.id,
            balance: wallet.balance,
            currency: wallet.currency,
            status: wallet.status
        }
    });
});

const get_transactions = asyncHandler(async (req, res) => {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 10);

    if (
        !Number.isInteger(page) ||
        page < 1 ||
        !Number.isInteger(limit) ||
        limit < 1 ||
        limit > 100
    ) {
        return res.status(400).json({
            status: false,
            message: "Invalid page or limit"
        });
    }

    const { type, fromDate, toDate } = req.query;

    const allowedTypes = [
        "CREDIT",
        "DEBIT",
        "TRANSFER"
    ];

    if (type && !allowedTypes.includes(type)) {
        return res.status(400).json({
            status: false,
            message: "Invalid transaction type"
        });
    }

    const from = parseDate(fromDate);
    const to = parseDate(toDate);

    if (
        (fromDate && !from) ||
        (toDate && !to) ||
        (from && to && from > to)
    ) {
        return res.status(400).json({
            status: false,
            message: "Invalid date range"
        });
    }

    const wallet = await Wallet.findOne({
        where: {
            userId: req.user.id
        }
    });

    if (!wallet) {
        return res.status(404).json({
            status: false,
            message: "Wallet not found"
        });
    }

    const where = {
        walletId: wallet.id
    };

    if (type) {
        where.type = type;
    }

    if (from || to) {
        where.createdAt = {};

        if (from) {
            where.createdAt[Op.gte] = from;
        }

        if (to) {
            where.createdAt[Op.lte] = to;
        }
    }

    const result = await WalletTransaction.findAndCountAll({
        where,
        order: [["createdAt", "DESC"], ["id", "DESC"]],
        limit,
        offset: (page - 1) * limit
    });

    return res.status(200).json({
        status: true,
        data: result.rows,
        pagination: {
            total: result.count,
            page,
            limit,
            totalPages: Math.ceil(result.count / limit)
        }
    });
});

const get_wallet_summary = asyncHandler(async (req, res) => {
    const wallet = await Wallet.findOne({
        where: {
            userId: req.user.id
        }
    });

    if (!wallet) {
        return res.status(404).json({
            status: false,
            message: "Wallet not found"
        });
    }

    const transactions = await WalletTransaction.findAll({
        where: {
            walletId: wallet.id
        },
        attributes: [
            "type",
            [
                sequelize.fn(
                    "SUM",
                    sequelize.col("amount")
                ),
                "total"
            ]
        ],
        group: ["type"],
        raw: true
    });

    const totals = {
        CREDIT: 0,
        DEBIT: 0,
        TRANSFER: 0
    };

    for (const item of transactions) {
        totals[item.type] = Number(item.total) || 0;
    }

    return res.status(200).json({
        status: true,
        data: {
            currentBalance: wallet.balance,
            totalCredited: totals.CREDIT,
            totalDebited: totals.DEBIT,
            totalTransferred: totals.DEBIT,
            currency: wallet.currency
        }
    });
});

export {
    create_wallet,
    deposit_money,
    transfer_money,
    get_balance,
    get_transactions,
    get_wallet_summary
};