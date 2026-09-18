import mongoose from "mongoose";

export const connectDB = async () => {
  try {
    const connectionInstance = await mongoose.connect(
      process.env.MONGO_URL,
      {
        dbName: "map",
      },
    );

    console.log(
      `\nMongoDB connected !!! DB HOST: ${connectionInstance.connection.host}`,
    );
  } catch (error) {
    console.error("MongoDB connection failed:");
    console.error(error);
    process.exit(1);
  }
};