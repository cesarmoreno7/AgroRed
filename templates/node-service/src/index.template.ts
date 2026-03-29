import cors from "cors";
import express from "express";
import helmet from "helmet";
import { createHealthRouter } from "./interface/http/routes/health.template.js";

const app = express();
const port = Number(process.env.PORT ?? 3000);

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(createHealthRouter("__SERVICE_NAME__"));

app.listen(port, () => {
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      service: "__SERVICE_NAME__",
      level: "info",
      message: "service.started",
      port
    })
  );
});

