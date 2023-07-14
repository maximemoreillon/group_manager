import dotenv from "dotenv"
dotenv.config()

export const { DEFAULT_BATCH_SIZE = 100 } = process.env
