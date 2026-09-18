import dns from "dns";

dns.setServers(["8.8.8.8", "1.1.1.1"]);

import "dotenv/config";
import { app } from "./app.js";
import { connectDB } from "./db/index.js";

console.log(process.env.PORT);

const PORT = Number(process.env.PORT) || 5000;

connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server is running at port localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error(`MongoDB connection failed !!!`, error);
  });