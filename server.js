const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth");

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

app.use(authRoutes);

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});