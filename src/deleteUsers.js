import dns from "dns";

dns.setServers(["8.8.8.8", "1.1.1.1"]);

import "dotenv/config";
import mongoose from "mongoose";

const deleteUsers = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URL, {
      dbName: "map",
    });

    console.log("MongoDB connected");

    const result = await mongoose.connection.db
      .collection("users")
      .deleteMany({});

    console.log(`Deleted ${result.deletedCount} users`);

    await mongoose.disconnect();
    console.log("MongoDB disconnected");
  } catch (error) {
    console.error("Delete failed:", error);
    process.exit(1);
  }
};

deleteUsers();