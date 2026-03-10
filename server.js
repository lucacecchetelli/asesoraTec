import express from "express";
import session from "express-session";
import path from "path";
import { fileURLToPath } from "url";
import authRouter from "./routes/auth.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 4000;

// Middleware
app.use(express.json());

app.use(session({
    secret: "secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: false
    }
}));

// API routes
app.use("/", authRouter);

app.use(express.static(path.join(__dirname, "../asesoraTec"))); 

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

/* Server.js works only for the setup of the server
    NOT for users or authentication logic */